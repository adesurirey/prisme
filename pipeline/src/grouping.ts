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
 * Failure policy (ADR-0005, as amended in issue #40): a failed Grouping
 * call — HTTP, unparseable after retries, or a missing key — fails the
 * build: nothing is written, the last committed Edition stays live, and a
 * degraded build no longer writes one-Article Story files (the 2026-10-08
 * builds showed one 429 corrupting the archive with 456 singletons that
 * membership is sticky and never re-merge). A merge into an existing
 * Story is only allowed when a Jev Membership check says yes (up to 20
 * checks per build); a refused, capped-out or isolated failed check
 * splits — but if every Membership check fails (the checker down, or a
 * missing key with checks pending), the build fails too: checks are the
 * only guard against permanent wrong merges, and a run where none of
 * them answered is not a run that can be trusted to write files. A new
 * Story proposed by the Grouping model gets the same guard (issue #36):
 * its seed is checked before the Story is created — across builds against
 * the most headline-similar live Stories (a proposed singleton must not
 * duplicate a live Story the model failed to merge into), and within the
 * build against the other surviving seeds (same-event Articles proposed as
 * separate new Stories must not each become one) — so no path creates a
 * Story without a Membership check. Only the seed of a Story that survived
 * both guards joins unconditionally; every further member is checked
 * against the seed (a thematic mega-Story must not form unchecked) and
 * demoted Articles split into singletons the next build can re-group.
 */
import { readdir, readFile } from 'node:fs/promises';
import type { Article, Section, Story } from '@prisme/domain';
import {
  newestFirst,
  parseStoryFile,
  reconcileSlugs,
  slugFor,
} from '@prisme/domain';
import type { MembershipChecker } from './decision-model.ts';
import { storySection } from './edition.ts';
import type { GroupingModel, GroupingProposal } from './gemini.ts';
import { MembershipGate } from './membership-gate.ts';

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
  /** Membership-check budget for this build; default MAX_MEMBERSHIP_CHECKS. */
  maxChecks?: number;
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
  const latest = (s: Story) =>
    Math.max(0, ...s.articles.map((a) => published(a.publishedAt)));
  return latest(b) - latest(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Articles inside the 24h window that no Story on disk claims yet. */
function freshArticles(
  articles: Article[],
  existing: Story[],
  now: Date,
): Article[] {
  const cutoff = now.getTime() - LIVE_WINDOW_MS;
  const known = new Set(existing.flatMap((s) => s.articles.map((a) => a.id)));
  return articles.filter(
    (a) => !known.has(a.id) && published(a.publishedAt) > cutoff,
  );
}

/**
 * Seed guard (issue #36): the proposed new-Story seeds are the only
 * Articles that would reach a Story without a Membership check. Before a
 * proposed Story keeps its seed, the seed is checked against this many
 * live Stories — the most headline-similar ones. The token-overlap score
 * below only bounds which Stories are worth a check; the Membership model
 * still decides.
 */
const MAX_SEED_CANDIDATES = 2;

/** Function words the overlap score ignores (French + English). */
const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'apres',
  'are',
  'au',
  'aux',
  'avec',
  'by',
  'ce',
  'cela',
  'ces',
  'cet',
  'cette',
  'chez',
  'comme',
  'dans',
  'de',
  'des',
  'du',
  'elle',
  'elles',
  'en',
  'est',
  'et',
  'etait',
  'ete',
  'for',
  'from',
  'il',
  'ils',
  'in',
  'is',
  'je',
  'la',
  'le',
  'les',
  'leur',
  'lui',
  'ma',
  'mais',
  'me',
  'mes',
  'moi',
  'mon',
  'ne',
  'ni',
  'nos',
  'notre',
  'nous',
  'of',
  'on',
  'ou',
  'par',
  'pas',
  'pendant',
  'plus',
  'pour',
  'qu',
  'que',
  'qui',
  'quoi',
  'sa',
  'sans',
  'se',
  'ses',
  'son',
  'sous',
  'sur',
  'ta',
  'te',
  'tes',
  'the',
  'toi',
  'ton',
  'tu',
  'un',
  'une',
  'vers',
  'votre',
  'vous',
  'was',
  'were',
  'with',
  'y',
]);

/** Lowercase, accent-stripped content tokens of a headline.
 * Exported for the grouping benchmark's dup-seed detector (issue #41). */
export function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    // Strip accents before the stopword check: the list is written
    // unaccented (ete, apres, …), so checking the raw form first lets
    // accented French function words through as content tokens.
    const word = raw.normalize('NFD').replace(/\p{M}/gu, '');
    if (word.length < 2 || STOPWORDS.has(word)) continue;
    out.add(word);
  }
  return out;
}

/** Jaccard overlap of two token sets: shared / total. Exported for the
 * grouping benchmark (issue #41). */
export function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return shared / (a.size + b.size - shared);
}

/**
 * The live Stories a proposed new-Story seed is Membership-checked against
 * before its Story is created (issue #36): the most headline-similar live
 * Stories, scored by the best overlap with the Story's title or any of its
 * Articles' headlines — a lone generic title hides a concrete event, the
 * recent Articles carry it. The score only bounds which Stories are worth
 * a check; the Membership model still decides.
 */
function seedCandidates(seed: Article, live: Story[]): Story[] {
  const seedTokens = tokens(seed.headline);
  if (seedTokens.size === 0) return [];
  return live
    .map((story) => ({
      story,
      score: Math.max(
        overlap(seedTokens, tokens(story.title)),
        ...story.articles.map((a) => overlap(seedTokens, tokens(a.headline))),
      ),
    }))
    .filter((c) => c.score > 0)
    .sort(
      (x, y) =>
        y.score - x.score ||
        (x.story.id < y.story.id ? -1 : x.story.id > y.story.id ? 1 : 0),
    )
    .slice(0, MAX_SEED_CANDIDATES)
    .map((c) => c.story);
}

export async function groupStories(
  input: GroupingInput,
): Promise<GroupingOutcome> {
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

  const liveSorted = () =>
    stories.filter((s) => isLive(s, now)).sort(byNewestArticle);

  if (fresh.length === 0) {
    // Nothing new: nothing changes (issue #5 acceptance criterion).
    return { stories, changed: new Set<string>(), live: liveSorted() };
  }

  const maxChecks = input.maxChecks ?? MAX_MEMBERSHIP_CHECKS;

  const merge = (story: Story, article: Article): void => {
    story.articles = [...story.articles, article].sort(newestFirst);
    changedStories.add(story);
  };

  const newStory = (title: string): Story => {
    const id = makeId();
    const slug = slugFor(title, id, taken);
    taken.add(slug);
    const story: Story = {
      id,
      slug,
      title,
      createdAt: now.toISOString(),
      articles: [],
    };
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

  // Failure policy (ADR-0005, as amended): without a Grouping model the
  // build fails instead of degrading — the degrade path wrote one-Article
  // Story files that membership stickiness makes permanent.
  if (clients.grouping == null)
    throw new Error(
      'Grouping failed: GEMINI_API_KEY is not set — the build writes no Story files (ADR-0005, as amended).',
    );

  const groupingInput = {
    // Only live Stories are visible to the model; frozen ones are closed (ADR-0005).
    stories: liveSorted().map((s) => ({
      id: s.id,
      title: s.title,
      section: s.section,
    })),
    articles: fresh.map((a) => ({
      id: a.id,
      headline: a.headline,
      teaser: teasers.get(a.id) ?? '',
      section: a.section,
    })),
  };
  // A failed Grouping call propagates and fails the build (ADR-0005, as
  // amended): the client has already retried — a 429 with a ~45 s backoff —
  // and nothing has been written yet, so the last committed Edition stays
  // live and CI goes red instead of the archive silently rotting.
  const proposal = await clients.grouping.group(groupingInput);

  if (proposal == null) {
    // The client contract is to throw on failure; a null proposal from a
    // misbehaving model is treated like one (issue #40).
    throw new Error('Grouping failed: the model returned no proposal.');
  }
  {
    const keyStories = new Map<string, Story>();
    for (const ns of proposal.newStories)
      keyStories.set(ns.key, newStory(ns.title));

    // First assignment wins per Article (the model must not double-assign).
    const assignmentOf = new Map<
      string,
      GroupingProposal['assignments'][number]
    >();
    for (const a of proposal.assignments) {
      if (!assignmentOf.has(a.articleId)) assignmentOf.set(a.articleId, a);
    }

    // Fresh Articles claimed for each new Story, in fresh order: the first
    // is the seed and joins unconditionally, the rest are checked against it.
    const keyMembers = new Map<string, Article[]>();
    for (const article of fresh) {
      const a = assignmentOf.get(article.id);
      if (a == null || a.storyId != null) continue;
      if (a.newStoryKey != null && keyStories.has(a.newStoryKey)) {
        const list = keyMembers.get(a.newStoryKey) ?? [];
        list.push(article);
        keyMembers.set(a.newStoryKey, list);
      }
    }

    // Seed guard (issue #36). The seed was the one Article that bypassed
    // every Membership check, so three same-event Articles proposed as
    // separate new Stories in one build never had their headlines compared
    // (the Nobel triple-split), and a proposed singleton could duplicate a
    // live Story the model failed to merge into (the lycéens singletons).
    // Before a proposed new Story keeps its seed, the seed gets the same
    // Jev Membership question a merge gets — cross-build candidates first
    // (an existing Story beats a new twin), then the surviving earlier
    // seeds of this build — each candidate filtered to a token overlap with
    // the seed first, so unrelated proposals never spend the check budget
    // (a fresh build can propose hundreds of new Stories). A yes redirects
    // the seed into that Story: the proposed Story receives no seed and is
    // dropped before it can publish, and its further members are
    // re-targeted to the absorbing Story. Guard checks spend the shared
    // check budget first: starving a merge splits, which self-heals on the
    // next build, while an unguarded seed creates a duplicate Story.
    const absorbedInto = new Map<string, string>();
    // The Membership gate owns the check budget, the verdict ledger and the
    // attempt/failure counters (ADR-0005, as amended). Which pairs to ask
    // stays here — guard seeds first, then merge pairs by headline overlap.
    // A missing checker becomes an always-throwing adapter: every attempt
    // fails, so the total-failure rule fires whenever checks were pending.
    const gate = new MembershipGate({
      checker: clients.membership ?? {
        label: 'none',
        async belongs() {
          throw new Error('Membership checker unavailable');
        },
      },
      budget: maxChecks,
    });
    {
      const live = liveSorted();
      const keyOrder = proposal.newStories.map((ns) => ns.key);
      const seedTokensOf = new Map<string, Set<string>>();
      const seedHeadlineOf = new Map<string, string>();
      for (const key of keyOrder) {
        const members = keyMembers.get(key);
        if (members == null || members.length === 0) continue;
        const seed = members[0]!;
        const seedTokens = tokens(seed.headline);
        seedTokensOf.set(key, seedTokens);
        seedHeadlineOf.set(key, seed.headline);
        const ask: { target: string; title: string; section?: Section }[] = [];
        for (const candidate of seedCandidates(seed, live))
          ask.push({
            target: candidate.id,
            title: candidate.title,
            section: candidate.section,
          });
        for (const earlier of keyOrder) {
          if (earlier === key) break;
          // An absorbed key's seed already lives in its absorber; the
          // absorber's own story is among the cross-build candidates.
          if (absorbedInto.has(earlier)) continue;
          const earlierHeadline = seedHeadlineOf.get(earlier);
          const earlierTokens = seedTokensOf.get(earlier);
          if (
            earlierHeadline != null &&
            earlierTokens != null &&
            overlap(seedTokens, earlierTokens) > 0
          )
            ask.push({ target: `key:${earlier}`, title: earlierHeadline });
        }
        for (const candidate of ask) {
          if (gate.budgetLeft <= 0) break;
          const yes =
            (await gate.ask({
              target: candidate.target,
              story: { title: candidate.title, section: candidate.section },
              article: seed,
              teaser: teasers.get(seed.id) ?? '',
              label: `Seed check failed: ${seed.id} → ${candidate.target}`,
            })) === 'yes';
          if (yes) {
            absorbedInto.set(key, candidate.target);
            break;
          }
        }
      }
    }

    // Membership checks are bounded and deterministic: every merge into an
    // existing Story is checked, and so is every non-seed member of a new
    // Story — the model's own confidence never bypasses the check (a generic
    // Story title makes it easy to be confidently wrong). Targets are Story
    // ids, or `key:<newStoryKey>` for new Stories (checked against the seed
    // Article, not the proposed title, which may itself be thematic) — or,
    // for a seed-guard-absorbed key, the absorbing Story. Guard checks ran
    // first; the rest of the budget goes to these. Pairs are prioritized by
    // headline overlap with their target — the most obvious duplicates get
    // the remaining budget before borderline pairs do — ties by (articleId,
    // target); the rest split.
    const targetOfKey = (key: string): string =>
      absorbedInto.get(key) ?? `key:${key}`;
    const pairScores = new Map<string, number>();
    const pairScore = (pair: { articleId: string; target: string }): number => {
      const cached = pairScores.get(`${pair.articleId}|${pair.target}`);
      if (cached != null) return cached;
      const article = fresh.find((a) => a.id === pair.articleId);
      const articleTokens = article
        ? tokens(article.headline)
        : new Set<string>();
      let best = 0;
      if (articleTokens.size > 0) {
        const headlines = pair.target.startsWith('key:')
          ? [keyMembers.get(pair.target.slice(4))?.[0]?.headline ?? '']
          : [byId.get(pair.target)].flatMap((s) =>
              s
                ? [s.title, ...s.articles.slice(0, 8).map((a) => a.headline)]
                : [],
            );
        for (const headline of headlines)
          best = Math.max(best, overlap(articleTokens, tokens(headline)));
      }
      pairScores.set(`${pair.articleId}|${pair.target}`, best);
      return best;
    };
    const mergePairs = [
      ...proposal.assignments
        .filter((a) => a.storyId != null)
        .map((a) => ({ articleId: a.articleId, target: a.storyId! })),
      ...[...keyMembers.entries()].flatMap(([key, members]) =>
        members
          .slice(1)
          .map((a) => ({ articleId: a.id, target: targetOfKey(key) })),
      ),
    ]
      .sort(
        (x, y) =>
          pairScore(y) - pairScore(x) ||
          (x.articleId < y.articleId
            ? -1
            : x.articleId > y.articleId
              ? 1
              : 0) ||
          (x.target < y.target ? -1 : x.target > y.target ? 1 : 0),
      )
      .slice(0, Math.max(0, gate.budgetLeft));
    for (const pair of mergePairs) {
      const article = fresh.find((a) => a.id === pair.articleId);
      if (article == null) continue;
      // New-Story checks are anchored on the seed Article: the proposed
      // title may be generic, the seed headline is the concrete event.
      const story = pair.target.startsWith('key:')
        ? {
            title: keyMembers.get(pair.target.slice(4))![0].headline,
            section: undefined,
          }
        : byId.get(pair.target);
      if (story == null) continue;
      await gate.ask({
        target: pair.target,
        story,
        article,
        teaser: teasers.get(article.id) ?? '',
        label: `Membership check failed: ${pair.articleId} → ${pair.target}`,
      });
    }

    // Total failure (ADR-0005, as amended): when not a single Membership
    // check answered — the checker down, or missing with checks pending —
    // the build fails. Nothing has been written yet, and isolated failures
    // (some checks answered) never reach this path.
    if (gate.allAttemptsFailed)
      throw new Error(
        `Membership failed: all ${gate.checksUsed} checks failed — the build writes no Story files.`,
      );

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
        if (gate.verdict(article.id, assignment.storyId) === 'yes') {
          merge(story, article);
        } else {
          split(article);
        }
        continue;
      }
      const newStoryKey = assignment.newStoryKey;
      if (newStoryKey == null || !keyMembers.has(newStoryKey)) {
        split(article);
        continue;
      }
      // A guard absorption retargets the whole key: either an existing
      // Story id, or the surviving new Story the key was folded into.
      const target = absorbedInto.get(newStoryKey) ?? `key:${newStoryKey}`;
      if (target.startsWith('key:')) {
        // The seed joins its surviving model-proposed Story unconditionally;
        // every further member must pass the Membership check against the
        // seed (an absorbed seed's guard verdict is already recorded).
        const story = keyStories.get(target.slice(4))!;
        const members = keyMembers.get(target.slice(4))!;
        if (
          members[0].id === article.id ||
          gate.verdict(article.id, target) === 'yes'
        ) {
          merge(story, article);
        } else {
          split(article);
        }
      } else {
        // Absorbed into an existing Story: the seed's guard verdict and
        // every further member's checked verdict were recorded up front.
        const story = byId.get(target);
        if (story != null && gate.verdict(article.id, target) === 'yes') {
          merge(story, article);
        } else {
          split(article);
        }
      }
    }

    console.log(
      `Membership: ${gate.checksUsed} checks this build (budget ${
        maxChecks === Infinity ? 'none' : maxChecks
      }).`,
    );

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
      if (story != null && changedStories.has(story))
        story.title = update.title;
    }
  }

  // Within-build slug collisions are re-resolved by the settled rule (Q9):
  // across builds the existing file wins, within a build the smallest Story
  // id keeps the bare slug — deterministic from ids, never by proposal order
  // (the split path orders by feed order, so it needs this too). Story
  // titles are already final here. Both Stories stay in changedStories, so
  // both files are written under their final names.
  reconcileSlugs(created, taken);

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
      const raw = JSON.parse(await readFile(new URL(name, dir), 'utf8'));
      const story = parseStoryFile(raw, name);
      if (story != null) stories.push(story);
    } catch {
      console.warn(`Skipping unreadable story file: ${name}`);
    }
  }
  return stories;
}
