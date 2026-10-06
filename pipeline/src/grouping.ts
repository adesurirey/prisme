/**
 * Incremental Story grouping (issue #5). Each build starts from the Story
 * files on disk: Articles already in a Story stay there (membership is
 * sticky), and only new Articles — under 24 hours old, absent from every
 * Story — are assigned, by the Grouping model, to a live Story or a new one.
 *
 * A Story keeps its full Article history forever (ADR-0005): the 24h window
 * only governs liveness. A Story with no live Articles has frozen — it is
 * passed through untouched and never shown to the model; a later Article
 * about the same event starts a new Story.
 *
 * Failure policy (ADR-0005): a failed Grouping call — or a missing key —
 * degrades to one-Article Stories, which self-heal on the next build (they
 * are live Stories the model can merge into). A low-confidence merge gets a
 * Jev Membership check; a refused, capped-out or failed check splits.
 */
import { readFile, readdir } from 'node:fs/promises';
import type { Article, Section, Story } from '@prisme/domain';
import { newestFirst } from '@prisme/domain';
import type { GroupingModel, GroupingProposal } from './gemini.ts';
import { storySection, slugify } from './edition.ts';
import type { MembershipChecker } from './decision-model.ts';

/** Merges at or above this confidence skip the Membership check (ADR-0005). */
export const CONFIDENCE_THRESHOLD = 0.75;
/** At most this many Membership checks per build; the rest split (ADR-0005). */
export const MAX_MEMBERSHIP_CHECKS = 20;
/** An Article younger than this keeps its Story live (ADR-0005). */
const LIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface GroupingClients {
  grouping: GroupingModel | null;
  membership: MembershipChecker | null;
}

export interface GroupingInput {
  /** Today's collected Articles: not_news dropped, kind and section attached. */
  articles: Article[];
  /** Feed teasers, in memory only (ADR-0003); empty strings allowed. */
  teasers: Map<string, string>;
  /** Every Story file on disk, live and frozen. */
  existing: Story[];
  now: Date;
  /** Random 12-hex Story id source; injectable for tests. */
  makeId: () => string;
  clients: GroupingClients;
}

export interface GroupingOutcome {
  /** The full Story set: updated, created, and frozen Stories passed through. */
  stories: Story[];
  /** Slugs of Stories whose file must be rewritten (new or actually changed). */
  changed: Set<string>;
  /** Stories with at least one live Article — what the Edition publishes. */
  live: Story[];
}

function published(date: string): number {
  const t = Date.parse(date);
  return Number.isNaN(t) ? 0 : t;
}

/** True when the Story still has an Article inside the 24h window. */
export function isLive(story: Story, now: Date): boolean {
  const cutoff = now.getTime() - LIVE_WINDOW_MS;
  return story.articles.some((a) => published(a.publishedAt) > cutoff);
}

/** Deterministic Story order: newest Article first, ties by id. */
function byNewestArticle(a: Story, b: Story): number {
  const latest = (s: Story) => Math.max(0, ...s.articles.map((a) => published(a.publishedAt)));
  return latest(b) - latest(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Articles inside the 24h window that no Story on disk claims yet. */
function freshArticles(articles: Article[], existing: Story[], now: Date): Article[] {
  const cutoff = now.getTime() - LIVE_WINDOW_MS;
  const known = new Set(existing.flatMap((s) => s.articles.map((a) => a.id)));
  return articles.filter((a) => !known.has(a.id) && published(a.publishedAt) > cutoff);
}

/**
 * Pick a slug for a new Story: the bare slugified title when free, else a
 * Story-id suffix, extending the slice when even that is taken. This claim is
 * provisional — the reconciliation below re-resolves within-build collisions
 * by the settled rule (smallest Story id keeps the bare slug).
 */
function slugFor(title: string, id: string, taken: Set<string>): string {
  const base = slugify(title) || 'sujet';
  if (!taken.has(base)) return base;
  return suffixSlug(base, id, taken);
}

/** The id-suffix fallback chain for one base slug, from the Story's own id. */
function suffixSlug(base: string, id: string, taken: Set<string>): string {
  for (const size of [6, 8, 12]) {
    const candidate = `${base}-${id.slice(0, size)}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${id}`;
}

export async function groupStories(input: GroupingInput): Promise<GroupingOutcome> {
  const { articles, teasers, existing, now, makeId, clients } = input;
  const fresh = freshArticles(articles, existing, now);
  /** Stories to write back, tracked as objects so slug reassignment is safe. */
  const changedStories = new Set<Story>();
  const taken = new Set(existing.map((s) => s.slug));
  // Working copies: Story files are never mutated in place; only changed
  // Stories are written back.
  const stories = existing.map((s) => ({ ...s }));
  const byId = new Map(stories.map((s) => [s.id, s]));
  /** Stories created this build, for the slug reconciliation below. */
  const created: Story[] = [];
  // storySection resolves by Article id: every Article on hand feeds the map.
  const sectionById = new Map<string, Section | undefined>();
  for (const story of stories) {
    for (const a of story.articles) sectionById.set(a.id, a.section);
  }
  for (const a of articles) sectionById.set(a.id, a.section);
  const sectionOf = (id: string): Section | undefined => sectionById.get(id);

  const liveSorted = () => stories.filter((s) => isLive(s, now)).sort(byNewestArticle);

  if (fresh.length === 0) {
    // Nothing new: nothing changes (issue #5 acceptance criterion).
    return { stories, changed: new Set<string>(), live: liveSorted() };
  }

  const merge = (story: Story, article: Article): void => {
    story.articles = [...story.articles, article].sort(newestFirst);
    changedStories.add(story);
  };

  const newStory = (title: string): Story => {
    const id = makeId();
    const slug = slugFor(title, id, taken);
    taken.add(slug);
    const story: Story = { id, slug, title, createdAt: now.toISOString(), articles: [] };
    stories.push(story);
    byId.set(id, story);
    created.push(story);
    changedStories.add(story);
    return story;
  };

  /** A split: the Article found no acceptable Story, so it starts one. */
  const split = (article: Article): void => {
    const story = newStory(article.headline);
    merge(story, article);
  };

  const groupingInput = {
    // Only live Stories are visible to the model; frozen ones are closed (ADR-0005).
    stories: liveSorted().map((s) => ({ id: s.id, title: s.title, section: s.section })),
    articles: fresh.map((a) => ({
      id: a.id,
      headline: a.headline,
      teaser: teasers.get(a.id) ?? '',
      section: a.section,
    })),
  };
  let proposal: GroupingProposal | null = null;
  try {
    proposal = clients.grouping ? await clients.grouping.group(groupingInput) : null;
  } catch (reason) {
    // A thrown error (config 4xx, network) degrades exactly like a null
    // proposal (ADR-0005): the build never fails on the free tier.
    console.warn(
      `Grouping failed: ${reason instanceof Error ? reason.message : reason} — degrading to one-Article Stories.`,
    );
  }

  if (proposal == null) {
    // Degraded path (ADR-0005): no model or failed call. Each new Article
    // starts its own Story — a live Story the model can merge into next build.
    for (const article of fresh) split(article);
  } else {
    const keyStories = new Map<string, Story>();
    for (const ns of proposal.newStories) keyStories.set(ns.key, newStory(ns.title));

    // First assignment wins per Article (the model must not double-assign).
    const assignmentOf = new Map<string, GroupingProposal['assignments'][number]>();
    for (const a of proposal.assignments) {
      if (!assignmentOf.has(a.articleId)) assignmentOf.set(a.articleId, a);
    }

    // Membership checks are bounded and deterministic: low-confidence merges
    // into existing Stories, sorted by (articleId, storyId), first 20 only.
    const lowPairs = proposal.assignments
      .filter((a) => a.storyId != null && a.confidence < CONFIDENCE_THRESHOLD)
      .map((a) => ({ articleId: a.articleId, storyId: a.storyId! }))
      .sort(
        (x, y) =>
          (x.articleId < y.articleId ? -1 : x.articleId > y.articleId ? 1 : 0) ||
          (x.storyId < y.storyId ? -1 : x.storyId > y.storyId ? 1 : 0),
      )
      .slice(0, MAX_MEMBERSHIP_CHECKS);
    const verdicts = new Map<string, boolean | null>();
    for (const pair of lowPairs) {
      const story = byId.get(pair.storyId);
      const article = fresh.find((a) => a.id === pair.articleId);
      let verdict: boolean | null = null;
      if (story && article && clients.membership) {
        try {
          verdict = await clients.membership.belongs(
            { title: story.title, section: story.section },
            { headline: article.headline, teaser: teasers.get(article.id) ?? '' },
          );
        } catch (reason) {
          // A thrown check is a failed check: refuse the merge (ADR-0005).
          console.warn(
            `Membership check failed: ${pair.articleId} → ${pair.storyId} — ${
              reason instanceof Error ? reason.message : reason
            }`,
          );
        }
      }
      verdicts.set(`${pair.articleId}|${pair.storyId}`, verdict);
    }

    for (const article of fresh) {
      const assignment = assignmentOf.get(article.id);
      if (assignment == null) {
        split(article);
        continue;
      }
      if (assignment.storyId != null) {
        const story = byId.get(assignment.storyId);
        // Unknown or frozen target: the model only sees live Stories.
        if (story == null || !isLive(story, now)) {
          split(article);
          continue;
        }
        if (assignment.confidence >= CONFIDENCE_THRESHOLD) {
          merge(story, article);
          continue;
        }
        if (verdicts.get(`${article.id}|${assignment.storyId}`) === true) {
          merge(story, article);
        } else {
          split(article);
        }
        continue;
      }
      const story = assignment.newStoryKey != null ? keyStories.get(assignment.newStoryKey) : undefined;
      // The model created this Story for the Article — no Membership check.
      if (story != null) merge(story, article);
      else split(article);
    }

    // Key Stories no Article claimed are dropped before they ever publish.
    for (const story of keyStories.values()) {
      if (story.articles.length === 0) {
        stories.splice(stories.indexOf(story), 1);
        byId.delete(story.id);
        created.splice(created.indexOf(story), 1);
        changedStories.delete(story);
        taken.delete(story.slug);
      }
    }

    // Titles may be re-proposed for Stories that gained Articles (ADR-0005);
    // the slug is fixed at creation and never changes.
    for (const update of proposal.titleUpdates) {
      const story = byId.get(update.storyId);
      if (story != null && changedStories.has(story)) story.title = update.title;
    }
  }

  // Within-build slug collisions are re-resolved by the settled rule (Q9):
  // across builds the existing file wins, within a build the smallest Story
  // id keeps the bare slug — deterministic from ids, never by proposal order
  // (the degrade path splits in feed order, so it needs this too). Only the
  // bare slug is contested; suffixes are id-specific. Story titles are
  // already final here, so the base is recomputed from them.
  const byBase = new Map<string, Story[]>();
  for (const story of created) {
    const base = slugify(story.title) || 'sujet';
    const group = byBase.get(base);
    if (group) group.push(story);
    else byBase.set(base, [story]);
  }
  for (const [base, group] of byBase) {
    if (group.length < 2) continue;
    const holder = group.find((s) => s.slug === base);
    if (holder == null) continue; // an existing file owns the bare slug
    const smallest = group.reduce((a, b) => (a.id < b.id ? a : b));
    if (smallest === holder) continue;
    // The smallest id takes the bare slug; the previous holder falls back to
    // a suffix from its own id. Both stay in changedStories, so both files
    // are written under their final names.
    smallest.slug = base;
    holder.slug = suffixSlug(base, holder.id, taken);
  }

  // The Story Section is the majority of its Articles' Sections — recomputed
  // once, after all merges.
  for (const story of changedStories) {
    const section = storySection(story.articles, sectionOf);
    if (section) story.section = section;
    else delete story.section;
  }

  return {
    stories,
    changed: new Set([...changedStories].map((s) => s.slug)),
    live: liveSorted(),
  };
}

/**
 * Load every Story file on disk — live and frozen. A malformed or unreadable
 * file is skipped with a warning, never fatal: the rest of the archive stays
 * usable. An absent directory (first build) means no Stories yet.
 */
export async function loadStories(dir: URL): Promise<Story[]> {
  let files: string[];
  try {
    files = (await readdir(dir)).filter((name) => name.endsWith('.json'));
  } catch {
    return [];
  }
  const stories: Story[] = [];
  for (const name of files) {
    try {
      const raw = JSON.parse(await readFile(new URL(name, dir), 'utf8')) as Partial<Story>;
      if (
        typeof raw.id === 'string' &&
        typeof raw.slug === 'string' &&
        typeof raw.title === 'string' &&
        Array.isArray(raw.articles)
      ) {
        stories.push(raw as Story);
      } else {
        console.warn(`Skipping malformed story file: ${name}`);
      }
    } catch {
      console.warn(`Skipping unreadable story file: ${name}`);
    }
  }
  return stories;
}