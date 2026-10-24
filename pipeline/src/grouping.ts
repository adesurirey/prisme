/**
 * Incremental Story grouping (issue #5). Each build starts from the Story
 * files on disk: Articles already in a Story stay there (membership is
 * sticky), and only new Articles — under 24 hours old, absent from every
 * Story — are assigned, by the Grouping model, to a live Story or a new one.
 *
 * A Story ingests until silence (ADR-0027): the Ingestion window is
 * `[founding, max(founding + 24h, newest + 12h)]` in instant arithmetic,
 * where the founding instant is the earliest `publishedAt` among the
 * Story's Articles and the newest its latest — both derived on demand,
 * never stored. Every Story keeps at least its full day (ADR-0026's
 * floor); each Article that joins extends it by 12 hours while that is
 * later than founding + 24h. A Story whose window has closed has frozen:
 * it is passed through untouched, never shown to the model, and a later
 * Article about the same event starts a new Story (its Episode,
 * ADR-0018). Its full Article history is kept forever (ADR-0005).
 *
 * Failure policy (ADR-0005, as amended in issue #40): a failed Grouping
 * call — HTTP, unparseable after retries, or a missing key — fails the
 * build: nothing is written, the last committed Edition stays live. A merge
 * into an existing Story is only allowed when a Jev Membership check says
 * yes; but if every Membership check fails (the checker down, or a missing
 * key with checks pending), the build fails too: checks are the only guard
 * against permanent wrong merges, and a run where none of them answered is
 * not a run that can be trusted to write files. Checks are unbudgeted: the
 * gate's dedup ledger bounds every (Article, Story) pair to one check, so
 * the count is finite by construction (ADR-0012).
 *
 * Birth policy (ADR-0015, amended by ADR-0027): a Story is created only
 * with at least two Articles from at least two distinct Outlets (an
 * Opinion piece counts, ADR-0011). An Article that matches nothing, whose
 * Membership check is refused or isolated-failed, or whose target is
 * unknown or frozen stays unassigned — written to no Story file, so the
 * next build re-presents it as fresh (the retry-ability the old split path
 * destroyed: membership was sticky, singletons never re-merge). A proposed
 * Story reduced to its seed alone, or whose members are all one Outlet, is
 * dropped before it can publish. A new Story proposed by the Grouping
 * model gets the birth guard (issue #36, ADR-0030) first: across builds,
 * the whole claimed bunch is checked against every live Story sharing a
 * content token with it — a live Story beats a new twin of her own
 * event — and within the build against the other surviving seeds, so two
 * same-event Articles proposed as separate one-member Stories fold into
 * one two-member Story instead of both being dropped. A build-failing
 * invariant (any created Story under two Articles or two Outlets throws)
 * keeps the policy true by construction.
 */
import { readdir, readFile } from 'node:fs/promises';
import type { Article, Section, Story, Topic } from '@prisme/domain';
import {
  foundingInstant,
  grewAtLeast,
  newestFirst,
  parseInstant,
  parseStoryFile,
  reconcileSlugs,
  slugFor,
} from '@prisme/domain';
import type {
  MembershipChecker,
  MembershipStoryRef,
} from './decision-model.ts';
import { storySection } from './edition.ts';
import type { GroupingModel, GroupingProposal } from './gemini.ts';
import {
  COLLECTION_WINDOW_MS,
  ingestionIsOpen,
  isLive,
  joinsIngestionWindow,
} from './liveness.ts';
import { MembershipGate, type MembershipVerdict } from './membership-gate.ts';
import { parisDayKey } from './paris-day.ts';
import { runPool } from './pool.ts';
import type { TitlePassModel } from './title-pass.ts';
import { topicLabel } from './topic-label.ts';

/** Above this many checks in one build, the run log warns (ADR-0012). */
export const MEMBERSHIP_CHECKS_WARN = 2000;

export interface GroupingClients {
  /** Live: resolveModels (policy.ts) fails the build before this point. */
  grouping: GroupingModel;
  /** Live or the declared fail-when-pending adapter (policy.ts). */
  membership: MembershipChecker;
  /** Live: writes every Story title after resolution (ADR-0023). */
  titles: TitlePassModel;
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
  /** Stories whose Ingestion window is open — what the Edition publishes. */
  live: Story[];
  /** Topics confirmed this build — threads that reached two Episodes; the
   * run merges them into data/topics.json (ADR-0024). */
  topics: ConfirmedTopic[];
}

/** True when the Story's Ingestion window is open (ADR-0027). */
export { isLive };

/** Deterministic Story order: newest Article first, ties by id. An
 * unparseable instant sorts oldest (0), like the old NaN→0 guard. */
function byNewestArticle(a: Story, b: Story): number {
  const latest = (s: Story) =>
    Math.max(0, ...s.articles.map((a) => parseInstant(a.publishedAt) ?? 0));
  return latest(b) - latest(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Articles inside the rolling 24h collection window that no Story on disk
 * claims yet (ADR-0027): freshness is the collection window alone — decoupled
 * from the Ingestion window, which is longer while coverage continues — and
 * window containment is enforced where it belongs, at membership time. An
 * Article whose target Story's window rejects it stays Unassigned and is
 * re-presented next build. */
function freshArticles(
  articles: Article[],
  existing: Story[],
  now: Date,
): Article[] {
  const cutoff = now.getTime() - COLLECTION_WINDOW_MS;
  const known = new Set(existing.flatMap((s) => s.articles.map((a) => a.id)));
  return articles.filter(
    (a) => !known.has(a.id) && (parseInstant(a.publishedAt) ?? 0) > cutoff,
  );
}

/** The birth minimum (ADR-0015, amended by ADR-0027): a Story is born only
 * from at least two Articles from at least two distinct Outlets — an
 * Opinion piece counts toward the birth like any Article (ADR-0011). The
 * Grouping model never sees Outlet ids (ADR-0003), so the Outlet dimension
 * lives here, not in the prompt: the drop pass and the build-failing
 * invariant share this one rule. */
export function meetsBirthMinimum(
  articles: Pick<Article, 'outletId'>[],
): boolean {
  return (
    articles.length >= 2 && new Set(articles.map((a) => a.outletId)).size >= 2
  );
}

/**
 * Birth-guard checks in flight at once (ADR-0030): the candidate checks
 * of one proposed Story are independent, and a busy morning's birth faces
 * a dozen-plus qualifying live Stories (archive replay: median 11, max 36
 * on a healthy archive) — sequential awaits would add minutes to the
 * build.
 */
const GUARD_CHECK_CONCURRENCY = 8;

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
/** The match key of one raw word: lowercased, accent-stripped — undefined
 * for stopwords and sub-2-char words, which carry no content signal. Shared
 * by tokens() and the Topic label (ADR-0024), which must agree on what
 * counts as a content word. */
export function wordKey(raw: string): string | undefined {
  const word = raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (word.length < 2 || STOPWORDS.has(word)) return undefined;
  return word;
}

export function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.split(/[^\p{L}\p{N}]+/u)) {
    const key = wordKey(raw);
    if (key != null) out.add(key);
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

/** How many member headlines the Grouping model sees per Story (ADR-0018). */
export const LATEST_HEADLINES = 3;

/** A Story's latest member headlines, newest first (ADR-0018): what the
 * Story already reports, so the model can tell a distinct sub-fact from the
 * Story's own fact. Exported for the grouping fixtures, which feed the same
 * prompt. */
export function latestHeadlines(
  members: { headline: string; publishedAt: string }[],
  count = LATEST_HEADLINES,
): string[] {
  return members
    .map((m, order) => ({
      headline: m.headline,
      published: parseInstant(m.publishedAt) ?? 0,
      order,
    }))
    .sort((x, y) => y.published - x.published || x.order - y.order)
    .slice(0, count)
    .map((m) => m.headline);
}

/** How many member headlines a Membership check sees (ADR-0018). */
export const MEMBER_DIGEST_SIZE = 5;

/** The member-headline digest a Membership check sees (ADR-0018): up to
 * five member headlines, most token-overlapping with the candidate Article
 * first — recency as tie-break, original order as final tie-break. The
 * candidate itself never appears in its own digest (a check would read its
 * own headline and answer trivially). Purely local selection: no model
 * call, no extra check; the checker still decides. Recency alone would
 * blind the check to sub-facts whose Articles are older than the Story's
 * newest five. Exported for tests. */
export function memberDigest(
  article: { id: string; headline: string },
  members: { id: string; headline: string; publishedAt: string }[],
): string[] {
  const articleTokens = tokens(article.headline);
  return members
    .filter((m) => m.id !== article.id)
    .map((m, order) => ({
      headline: m.headline,
      score: overlap(articleTokens, tokens(m.headline)),
      published: parseInstant(m.publishedAt) ?? 0,
      order,
    }))
    .sort(
      (x, y) =>
        y.score - x.score || y.published - x.published || x.order - y.order,
    )
    .slice(0, MEMBER_DIGEST_SIZE)
    .map((m) => m.headline);
}

/**
 * The live Stories a proposed new-Story bunch is checked against before
 * its Story is created (issue #36, ADR-0030): every Story sharing at
 * least one content token with any bunch headline — scored by the best
 * overlap only to order the asking, never to cut the list. A lexical
 * top-k crowded the true twin out on the 2026-10-24 manifestations
 * morning (issue #140): the same-subject different-fact Stories of a hot
 * news cycle outscore the same-fact twin for every bunch member, so a
 * cap of two spent its checks on near-misses the checker correctly
 * refused. The any-overlap bound only keeps unrelated Stories away; the
 * Membership model still decides. Exported for tests.
 */
export function bunchCandidates(members: Article[], live: Story[]): Story[] {
  const bunchTokens = members.map((m) => tokens(m.headline));
  if (bunchTokens.every((t) => t.size === 0)) return [];
  return live
    .map((story) => ({
      story,
      score: Math.max(
        0,
        ...bunchTokens.flatMap((t) => [
          overlap(t, tokens(story.title)),
          ...story.articles.map((a) => overlap(t, tokens(a.headline))),
        ]),
      ),
    }))
    .filter((c) => c.score > 0)
    .sort(
      (x, y) =>
        y.score - x.score ||
        (x.story.id < y.story.id ? -1 : x.story.id > y.story.id ? 1 : 0),
    )
    .map((c) => c.story);
}

/**
 * The candidate Story's member digest for a birth-guard check (ADR-0030):
 * up to five headlines, most token-overlapping with the proposed bunch
 * first — like memberDigest, but ranked against the whole bunch, so the
 * digest surfaces what the live Story already reports about THIS event
 * (the dispositif headlines against a manifestations bunch, not the
 * Story's five newest). Exported for tests.
 */
export function bunchDigest(
  bunch: Pick<Article, 'headline'>[],
  members: { headline: string; publishedAt: string }[],
): string[] {
  const bunchTokens = bunch.map((b) => tokens(b.headline));
  return members
    .map((m, order) => ({
      headline: m.headline,
      score: Math.max(
        0,
        ...bunchTokens.map((t) => overlap(t, tokens(m.headline))),
      ),
      published: parseInstant(m.publishedAt) ?? 0,
      order,
    }))
    .sort(
      (x, y) =>
        y.score - x.score || y.published - x.published || x.order - y.order,
    )
    .slice(0, MEMBER_DIGEST_SIZE)
    .map((m) => m.headline);
}

/** Below this token overlap a Story on disk is not the previous episode of
 * a new cluster: the context line would attach an unrelated subject
 * (ADR-0023). Higher than the seed guard's any-overlap bound because a
 * wrong episode only misleads the title, while a skipped guard check
 * creates a duplicate Story. */
export const EPISODE_MIN_OVERLAP = 0.25;

/** A Story on disk older than this many days before the birth's day is no
 * longer the previous episode (ADR-0024): the Title pass context claims to
 * be the episode the reader already saw, and an old match is not that —
 * while for Topics, inheriting from a stale Story is where a weak lexical
 * match compounds into a permanent wrong thread. Generous against the
 * observed 0–3 day range of true links, so sagas that breathe (weekend
 * pauses) keep their thread; revised by the episode backtest as the archive
 * grows. An event resuming after the window founds a new Topic. */
export const EPISODE_MAX_AGE_DAYS = 7;

/** The oldest storyDay an episode may have for a birth of `day`. */
function episodeCutoff(day: string): string {
  return new Date(Date.parse(day) - EPISODE_MAX_AGE_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** The most headline-similar Story on disk for a new cluster of `day`: the
 * previous episode of the same event. Scored like the seed guard — the best
 * overlap of any cluster headline with the Story's title or any of its member
 * headlines. Only Stories within the age window count (ADR-0024): strictly
 * not-after the birth's day, and no older than EPISODE_MAX_AGE_DAYS. The
 * Story itself is never in `existing` (it is born this build). Exported for
 * tests; also drives Topic assignment (ADR-0024). */
export function bestEpisodeMatch(
  headlines: string[],
  existing: Story[],
  day: string,
): Story | undefined {
  const cutoff = episodeCutoff(day);
  let best: { story: Story; score: number } | undefined;
  for (const headline of headlines) {
    const headlineTokens = tokens(headline);
    if (headlineTokens.size === 0) continue;
    for (const story of existing) {
      if (story.storyDay > day || story.storyDay < cutoff) continue;
      const score = Math.max(
        overlap(headlineTokens, tokens(story.title)),
        ...story.articles.map((a) =>
          overlap(headlineTokens, tokens(a.headline)),
        ),
      );
      if (score >= EPISODE_MIN_OVERLAP && (best == null || score > best.score))
        best = { story, score };
    }
  }
  return best?.story;
}

/** The previous episode as the Title pass consumes it (ADR-0023): title and
 * day only — the Title pass never sees Story ids. */
/** A Topic confirmed this build: a birth inherited it, so the thread has
 * reached two Episodes (ADR-0024). The run hands these to the registry
 * module, which owns the merge and mints the public slug — grouping itself
 * never sees registry state. */
export type ConfirmedTopic = Omit<Topic, 'slug'>;

/** Resolve the Topic of every Story born this build (ADR-0024), BEFORE the
 * Title pass: the Title pass's episode context is only fed a Jev-confirmed
 * thread — a refused match is a new subject, and its title must not anchor
 * on the refused episode. The confirmed threads also give the pass each
 * thread's display label, finer context than a lone episode title. Births
 * are untitled here, so a founding Topic's key is the birth's id (slugs do
 * not exist yet — they derive from the pass's titles). Every birth carries
 * its Topic key for life: the Episode it continues (lexicon proposes,
 * Membership disposes — a failed check throws and fails the build,
 * ADR-0005) or its own id as a prospective key. A Topic exists from two
 * Episodes, like a Story exists from two Articles (ADR-0015): only
 * inheritances confirm a Topic, and only confirmed Topics reach the
 * registry. A Story on disk without a topicId (the pre-Topics archive) is
 * never inherited from — no retro-assignment. Exported for the topic replay
 * tool, which walks the archive through this exact code. */
export async function resolveTopics(input: {
  births: Story[];
  existing: Story[];
  membership: MembershipChecker;
}): Promise<{
  topics: ConfirmedTopic[];
  episodeOf: Map<Story, { title: string; storyDay: string; subject?: string }>;
}> {
  const topics: ConfirmedTopic[] = [];
  const episodeOf = new Map<
    Story,
    { title: string; storyDay: string; subject?: string }
  >();
  for (const birth of input.births) {
    const episode = bestEpisodeMatch(
      birth.articles.map((a) => a.headline),
      input.existing,
      birth.storyDay,
    );
    if (episode?.topicId != null) {
      // The whole thread goes to the check, oldest first (ADR-0024): the
      // subject is broader than its last episode — a political reaction is
      // judged against the war, not against the strike story it lexically
      // matched. Each episode is bounded to its most birth-relevant
      // headlines, so a long thread never blows up the payload.
      const episodes = input.existing
        .filter((s) => s.topicId === episode.topicId)
        .sort(
          (a, b) =>
            a.storyDay.localeCompare(b.storyDay) ||
            a.createdAt.localeCompare(b.createdAt),
        )
        .map((s) => ({
          title: s.title,
          section: s.section,
          headlines: memberDigest(birth.articles[0]!, s.articles),
        }));
      // The birth is untitled at this point (the Title pass runs next) —
      // its headlines carry the subject, like any Membership payload.
      const verdict = await input.membership.sameSubject(episodes, {
        title: birth.title,
        section: birth.section,
        headlines: birth.articles.map((a) => a.headline),
      });
      if (verdict === 'failed')
        throw new Error(
          `Topic resolution failed: Membership could not answer whether Story ${birth.id} continues the subject of Story ${episode.slug} (ADR-0024).`,
        );
      if (verdict === 'yes') {
        birth.topicId = episode.topicId;
        // The thread reached two Episodes: the Topic exists. The founding
        // Story on disk — frozen, final title — labels it; the pool is the
        // thread's own headlines plus the untitled birth's (ADR-0024). The
        // public slug is not minted here: the registry module owns it.
        const label = topicLabel(
          [
            episode.title,
            ...episode.articles.map((a) => a.headline),
            ...birth.articles.map((a) => a.headline),
          ],
          input.existing.map((s) =>
            [s.title, ...s.articles.map((a) => a.headline)].join(' '),
          ),
        );
        topics.push({
          topicId: episode.topicId,
          title: episode.title,
          storyDay: episode.storyDay,
          createdAt: episode.createdAt,
          label,
        });
        // The Title pass anchors on this episode — Jev-confirmed, labelled.
        episodeOf.set(birth, {
          title: episode.title,
          storyDay: episode.storyDay,
          subject: label,
        });
        continue;
      }
    }
    // No inheritable Episode (none matched, the pre-Topics archive, or
    // Membership refused): the birth founds a prospective Topic — its own
    // id as key (no slug exists yet), no registry entry until a second
    // Episode joins. Its title gets no episode context.
    birth.topicId = birth.id;
  }
  return { topics, episodeOf };
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

  /** The live Stories — those whose Ingestion window is open (ADR-0027):
   * the same set the Grouping model sees and the Edition publishes. */
  const liveSorted = () =>
    stories.filter((s) => isLive(s, now)).sort(byNewestArticle);

  /** The belonging rule (ADR-0026, extended by ADR-0027): an Article joins
   * a Story iff its publishedAt falls inside the Story's Ingestion window
   * `[founding, max(founding + 24h, newest + 12h)]` — strictly, with no
   * pre-founding Articles. */
  const canJoin = (
    article: Article,
    target: Pick<Story, 'articles'>,
  ): boolean => joinsIngestionWindow(target, article.publishedAt);

  // Topics confirmed this build, hoisted over the two resolution paths
  // below (the no-fresh-Articles path confirms nothing) — with the episode
  // context each confirmed-thread birth feeds the Title pass.
  let topics: ConfirmedTopic[] = [];
  let episodeOf = new Map<
    Story,
    { title: string; storyDay: string; subject?: string }
  >();

  if (fresh.length === 0) {
    // Nothing new: nothing changes (issue #5 acceptance criterion).
    return {
      stories,
      changed: new Set<string>(),
      live: liveSorted(),
      topics: [],
    };
  }

  const merge = (story: Story, article: Article): void => {
    story.articles = [...story.articles, article].sort(newestFirst);
    changedStories.add(story);
  };

  // Note: a Story is never born from a single Article or a single Outlet's
  // Articles (ADR-0015, ADR-0027) — newStory is only called for
  // model-proposed keys, and the birth minimum is enforced by the drop pass
  // and invariant below. Title and slug are deferred to the Title pass: the
  // slug derives from the final title (ADR-0023), so a birth carries
  // neither until the pass has answered.
  const newStory = (storyDay: string): Story => {
    const id = makeId();
    const story: Story = {
      id,
      slug: '',
      title: '',
      createdAt: now.toISOString(),
      storyDay,
      articles: [],
    };
    stories.push(story);
    byId.set(id, story);
    created.push(story);
    changedStories.add(story);
    return story;
  };

  /** Articles left unassigned this build (ADR-0015): written to no Story
   * file, so the next build re-presents them as fresh. Logged below. */
  const orphans: string[] = [];
  /** A refused, mis-targeted, or unmatched Article stays unassigned — it
   * never births a one-Article Story (ADR-0015). */
  const orphan = (article: Article): void => {
    orphans.push(article.id);
  };

  const groupingInput = {
    // Only window-open Stories (ADR-0027) are visible to the model; frozen
    // ones are closed (ADR-0005). Prompt text is unchanged — the pool is
    // what moved from day-based to window-based.
    stories: liveSorted().map((s) => ({
      id: s.id,
      title: s.title,
      section: s.section,
      latestHeadlines: latestHeadlines(s.articles),
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
      if (
        a.newStoryKey != null &&
        proposal.newStories.some((ns) => ns.key === a.newStoryKey)
      ) {
        const list = keyMembers.get(a.newStoryKey) ?? [];
        list.push(article);
        keyMembers.set(a.newStoryKey, list);
      }
    }

    // A Story is born on the Publication day of its founding Article,
    // fixed at creation (ADR-0017). An Article collected at 00:10 that was
    // published 23:50 the day before founds a Story of the day before. A
    // key no Article claimed never births a Story at all: the day can only
    // come from a founding Article, so there is nothing to create and
    // nothing to drop later (ADR-0015). Nothing downstream references a
    // founderless key — every lookup is gated on keyMembers having claimed
    // it. The founding instant (ADR-0026) is the earliest publishedAt
    // among the key's claimed Articles — not the first-claimed member:
    // `fresh` is newest-first (collect.ts), so the earliest-published
    // member anchors the window and the Story day, and every later join
    // respects it — stable for the Story's life since no member may
    // precede the founding. Only the build-time window anchor comes from
    // the claimed set: the Story day itself is re-derived from the
    // admitted members below (issue #142) — a claimed-then-refused member
    // must not pick the Story's public day.
    const keyStories = new Map<string, Story>();
    const keyFounding = new Map<string, number>();
    for (const ns of proposal.newStories) {
      const members = keyMembers.get(ns.key);
      if (members == null || members.length === 0) continue;
      // The founding instant is THE one computation — the same
      // foundingInstant the window arithmetic runs on (ADR-0026).
      const founding = foundingInstant({ articles: members });
      if (founding == null) continue;
      keyStories.set(
        ns.key,
        newStory(parisDayKey(new Date(founding).toISOString())),
      );
      keyFounding.set(ns.key, founding);
    }

    // The belonging rule (ADR-0026, ADR-0027) filters each key's members
    // to the founding's Ingestion window at claim time: nothing precedes
    // the founding — it is the earliest member — and the close,
    // max(founding + 24h, newest + 12h), is at least the newest member +
    // 12h, so the whole proposed cohort sits inside it (fresh Articles
    // span less than a day of publishedAt — the collection window). The
    // filter stands as the rule's guard. Against an existing Story the
    // strict lower bound does refuse: an Article published before that
    // Story's founding stays Unassigned — re-presented next build, never
    // stored into the Story it matched (ADR-0017's 23h50 motivating
    // example is the accepted cost: it orphans instead of joining a Story
    // founded after it).
    for (const [key, members] of keyMembers) {
      const founding = keyFounding.get(key);
      if (founding == null) continue;
      keyMembers.set(
        key,
        members.filter((m) => canJoin(m, { articles: members })),
      );
    }

    // Birth guard (issue #36, ADR-0030). A proposed new Story must not be
    // born beside a live Story already carrying its event: while a Story
    // is live, same-event chain coverage joins her (ADR-0030) — only a
    // distinct fact births, in parallel if it must. Before a proposed
    // Story keeps its claimed bunch, the whole bunch gets the Membership
    // question a merge gets (a legitimately narrow seed must not decide
    // for its Story, issue #140): cross-build candidates first (an
    // existing Story beats a new twin), then the surviving earlier seeds
    // of this build — the #36 Nobel triple-split and singleton twins. A
    // yes redirects the key into that Story: the proposed Story receives
    // no seed and is dropped before it can publish, and its further
    // members are re-targeted to the absorbing Story and checked there
    // individually. Guard checks run first: an unguarded birth creates a
    // duplicate Story, which is worse than the splits a starving merge
    // would leave (ADR-0012 removed the budget).
    const absorbedInto = new Map<string, string>();
    // The Membership gate owns the verdict ledger and the
    // attempt/failure counters (ADR-0005, as amended; the budget is gone,
    // ADR-0012). Which pairs to ask stays here — guard checks first, then
    // merge pairs by headline overlap. A missing OPENROUTER_API_KEY
    // arrives as the declared fail-when-pending adapter (policy.ts): every
    // attempt fails, so the total-failure rule fires exactly when checks
    // were pending.
    const gate = new MembershipGate({ checker: clients.membership });
    {
      // Guard candidates: existing Stories only (never the proposed keys),
      // open per the Ingestion window (ADR-0027); a closed Story can never
      // absorb a birth. Stories whose window does not contain the seed are
      // filtered per key below. Candidates are every live Story sharing at
      // least one content token with the bunch — never a lexical top-k
      // (ADR-0030): on the 2026-10-24 manifestations morning the true twin
      // ranked 4th of 12 behind three same-subject different-fact Stories,
      // so both top-2 checks went to near-misses the checker correctly
      // refused and the duplicate was born (issue #140). Same-subject
      // neighbours reliably outscore the same-fact twin; the any-overlap
      // bound only keeps unrelated Stories away, and the Membership model
      // still decides. The checks of one key are pooled — they are
      // independent, and a birth can face dozens of candidates.
      const live = stories
        .filter((s) => !created.includes(s) && isLive(s, now))
        .sort(byNewestArticle);
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
        // The ask list is order-fixed before the pool runs; the first yes
        // in list order absorbs, whatever the completion order.
        const ask: {
          target: string;
          ask: () => Promise<MembershipVerdict>;
        }[] = [];
        for (const candidate of bunchCandidates(
          members,
          live.filter((s) => canJoin(seed, s)),
        ))
          ask.push({
            target: candidate.id,
            ask: () =>
              gate.absorbs({
                target: candidate.id,
                story: {
                  title: candidate.title,
                  section: candidate.section,
                  headlines: bunchDigest(members, candidate.articles),
                },
                bunch: {
                  title: seed.headline,
                  headlines: members.map((m) => m.headline),
                },
                seedId: seed.id,
                label: `Guard check failed: ${seed.id} → ${candidate.id}`,
              }),
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
            ask.push({
              target: `key:${earlier}`,
              ask: () =>
                gate.ask({
                  target: `key:${earlier}`,
                  story: {
                    title: earlierHeadline,
                    headlines: memberDigest(
                      seed,
                      keyMembers.get(earlier) ?? [],
                    ),
                  },
                  article: seed,
                  teaser: teasers.get(seed.id) ?? '',
                  label: `Seed check failed: ${seed.id} → key:${earlier}`,
                }),
            });
        }
        const verdicts = new Map<string, MembershipVerdict>();
        await runPool(ask, GUARD_CHECK_CONCURRENCY, async (entry) => {
          verdicts.set(entry.target, await entry.ask());
        });
        for (const entry of ask)
          if (verdicts.get(entry.target) === 'yes') {
            absorbedInto.set(key, entry.target);
            break;
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
    // first; every merge pair is checked — no budget caps the list (ADR-0012).
    // Pairs are prioritized by headline overlap with their target — a tiebreak
    // only, since every pair is asked — ties by (articleId, target).
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
    ].sort(
      (x, y) =>
        pairScore(y) - pairScore(x) ||
        (x.articleId < y.articleId ? -1 : x.articleId > y.articleId ? 1 : 0) ||
        (x.target < y.target ? -1 : x.target > y.target ? 1 : 0),
    );
    for (const pair of mergePairs) {
      const article = fresh.find((a) => a.id === pair.articleId);
      if (article == null) continue;
      // New-Story checks are anchored on the seed Article: the proposed
      // title may be generic, the seed headline is the concrete event.
      let story: MembershipStoryRef | undefined;
      if (pair.target.startsWith('key:')) {
        const members = keyMembers.get(pair.target.slice(4))!;
        story = {
          title: members[0].headline,
          headlines: memberDigest(article, members),
        };
      } else {
        const target = byId.get(pair.target);
        if (target == null) continue;
        story = {
          title: target.title,
          section: target.section,
          headlines: memberDigest(article, target.articles),
        };
      }
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
        orphan(article);
        continue;
      }
      if (assignment.storyId != null) {
        const story = byId.get(assignment.storyId);
        if (story == null) {
          orphan(article);
          continue;
        }
        // Frozen (window closed), or out-of-window target: the model only
        // sees open Stories, and an Article joins only inside the target's
        // Ingestion window (ADR-0027).
        if (!ingestionIsOpen(story, now) || !canJoin(article, story)) {
          orphan(article);
          continue;
        }
        if (gate.verdict(article.id, assignment.storyId) === 'yes') {
          merge(story, article);
        } else {
          orphan(article);
        }
        continue;
      }
      const newStoryKey = assignment.newStoryKey;
      if (newStoryKey == null || !keyMembers.has(newStoryKey)) {
        orphan(article);
        continue;
      }
      // A guard absorption retargets the whole key: either an existing
      // Story id, or the surviving new Story the key was folded into.
      const target = absorbedInto.get(newStoryKey) ?? `key:${newStoryKey}`;
      if (target.startsWith('key:')) {
        // The seed joins its surviving model-proposed Story unconditionally;
        // every further member must pass the Membership check against the
        // seed (an absorbed seed's guard verdict is already recorded). The
        // window is anchored on the key's whole claimed member set (ADR-0027):
        // its founding is the earliest member, not the seed — fresh is
        // newest-first, so the partially built Story would mis-anchor it.
        const story = keyStories.get(target.slice(4))!;
        const members = keyMembers.get(target.slice(4))!;
        if (
          canJoin(article, { articles: members }) &&
          (members[0].id === article.id ||
            gate.verdict(article.id, target) === 'yes')
        ) {
          merge(story, article);
        } else {
          orphan(article);
        }
      } else {
        // Absorbed into an existing Story: the seed's guard verdict and
        // every further member's checked verdict were recorded up front.
        const story = byId.get(target);
        if (
          story != null &&
          canJoin(article, story) &&
          gate.verdict(article.id, target) === 'yes'
        ) {
          merge(story, article);
        } else {
          orphan(article);
        }
      }
    }

    console.log(
      `Membership: ${gate.checksUsed} check(s) this build (Stories born: ${created.length}, Stories live: ${stories.length}).`,
    );
    if (gate.checksUsed > MEMBERSHIP_CHECKS_WARN)
      console.warn(
        `⚠ Membership: ${gate.checksUsed} checks in one build is unusual — inspect the Grouping proposal for a combinatorial blowup (ADR-0012).`,
      );

    // Stories below the birth minimum are dropped before they ever
    // publish (ADR-0015, amended by ADR-0027): no Article claimed (never
    // proposed), only the seed joined (its members were refused), or all
    // members from one Outlet — the Grouping model never sees Outlet ids,
    // so the Outlet dimension is enforced here. Their Articles are
    // orphaned — written to no Story file, they retry each build until a
    // second Outlet covers the event or they age out of the collection
    // window. An existing Story may still grow from Articles of one
    // Outlet: the minimum governs births, not merges.
    for (const story of keyStories.values()) {
      if (!meetsBirthMinimum(story.articles)) {
        for (const a of story.articles)
          if (!orphans.includes(a.id)) orphans.push(a.id);
        stories.splice(stories.indexOf(story), 1);
        byId.delete(story.id);
        created.splice(created.indexOf(story), 1);
        changedStories.delete(story);
      }
    }
    // After the drop pass, so the count includes the dropped Stories' own
    // Articles — every unassigned Article retries next build (ADR-0015).
    if (orphans.length > 0)
      console.log(
        `Grouping: ${orphans.length} article(s) left unassigned — no Story is born from fewer than two Articles or fewer than two Outlets (ADR-0015, ADR-0027); they retry next build.`,
      );

    // Invariant tripwire (ADR-0015, amended by ADR-0027): a Story born
    // this build always has at least two Articles from at least two
    // distinct Outlets. Unreachable while the drop pass above holds — its
    // job is to fail loudly if a future refactor reintroduces singleton or
    // single-Outlet births, the corruption class no check caught in 2026-10.
    for (const story of created) {
      if (!meetsBirthMinimum(story.articles))
        throw new Error(
          `Birth minimum violated (ADR-0015, ADR-0027): Story ${story.id} was created with ${story.articles.length} Article(s) from ${new Set(story.articles.map((a) => a.outletId)).size} Outlet(s).`,
        );
    }

    // The Story day is re-derived from the admitted Articles (ADR-0017,
    // issue #142): newStory anchors the day on the claimed founding
    // instant — the earliest publishedAt among claimed members, taken
    // before any Membership verdict — so a claimed-then-refused member can
    // precede every admitted one and ghost-anchor the Story's public day
    // (its URL and archive page) on an Article that never joined. Nothing
    // downstream has read the day yet (Topics resolve next, the Title pass
    // after), so re-fixing it from the final member set is still "fixed at
    // creation" (ADR-0017).
    for (const story of created) {
      const founding = foundingInstant(story);
      if (founding != null)
        story.storyDay = parisDayKey(new Date(founding).toISOString());
    }

    // Topics (ADR-0024): resolved BEFORE the Title pass — the pass's
    // episode context is only fed a Jev-confirmed thread, with its display
    // label; a refused match is a new subject and gets no episode context.
    // A failed Membership check throws and fails the build (ADR-0005).
    ({ topics, episodeOf: episodeOf } = await resolveTopics({
      births: created,
      existing,
      membership: clients.membership,
    }));

    // The Title pass (ADR-0023): one call per build, after resolution —
    // births are titled at creation (the slug will derive from the title),
    // and live Stories that grew enough may be re-titled. ADR-0027 gates
    // the retitle list on ≥ 25% growth since the Story's last title pass,
    // so titles of long-running Stories stop re-firing hourly; a gated
    // retitle, when it fires, still sees the Story's whole headline set —
    // the title names the event, not its latest development. A
    // failed call propagates and fails the build: nothing has been written,
    // the last committed Edition stays live (same posture as Grouping).
    const births = [...keyStories.entries()]
      .filter(([, story]) => created.includes(story))
      .map(([key, story]) => ({
        key,
        headlines: story.articles.map((a) => a.headline),
        episode: episodeOf.get(story),
      }));
    // The retitle gate (ADR-0027): the shared growth gate (grewAtLeast,
    // domain package) — the same arithmetic as the Summaries gate — a Story with
    // no watermark yet (born before ADR-0027) passes once and is stamped
    // below. Only the frequency is gated: the payload built below is the
    // whole headline set, never windowed or truncated.
    const retitled = [...changedStories]
      .filter((s) => !created.includes(s))
      .filter((s) => grewAtLeast(s.titledArticleCount, s.articles.length))
      .sort(byNewestArticle);
    const updates = retitled.map((s) => ({
      storyId: s.id,
      title: s.title,
      // Stored order (newest first): the payload is the whole headline set,
      // never windowed or truncated — the founding anchor is the prompt's
      // update rule, and replaying this story's decision point showed
      // reordering oldest-first *weakens* that anchor (the payload's last
      // line reads as the title-worthy fact).
      headlines: s.articles.map((a) => a.headline),
    }));
    if (births.length > 0 || updates.length > 0) {
      const titled = await clients.titles.title({ births, updates });
      if (titled == null)
        throw new Error('Title pass failed: the model returned no titles.');
      const titleOfKey = new Map(titled.titles.map((t) => [t.key, t.title]));
      for (const [key, story] of keyStories) {
        if (!created.includes(story)) continue;
        const title = titleOfKey.get(key);
        if (title == null)
          throw new Error(
            `Title pass failed: no title for new Story key ${key} — a Story is never written untitled.`,
          );
        story.title = title;
        // The retitle watermark (ADR-0027): the pass titled this birth
        // over its whole Article set — later retitles fire only on ≥ 25%
        // further growth from here.
        story.titledArticleCount = story.articles.length;
      }
      // Retitles only touch Stories that gained Articles (the input set);
      // never a Story born this build, whose title just came from the pass.
      // The slug, assigned below, never changes afterwards (ADR-0005).
      for (const update of titled.titleUpdates) {
        const story = byId.get(update.storyId);
        if (
          story != null &&
          changedStories.has(story) &&
          !created.includes(story)
        )
          story.title = update.title;
      }
      // The watermark is stamped for every Story the pass saw — a declined
      // retitle (the model kept the current title) passed over the whole
      // headline set too, so it re-enters only on ≥ 25% further growth,
      // not next build (ADR-0027). Every stamped Story is in
      // changedStories, so the watermark rides the Story file out.
      for (const story of retitled)
        story.titledArticleCount = story.articles.length;
    }
  }

  // Slugs are derived from the final titles and fixed at creation
  // (ADR-0005): a later retitle of a live Story never re-derives them.
  for (const story of created) {
    story.slug = slugFor(story.title, story.id, taken);
    taken.add(story.slug);
  }

  // Within-build slug collisions are re-resolved by the settled rule (Q9):
  // across builds the existing file wins, within a build the smallest Story
  // id keeps the bare slug — deterministic from ids, never by proposal order.
  // Story titles are already final here. Both Stories stay in changedStories,
  // so both files are written under their final names.
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
    topics,
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
