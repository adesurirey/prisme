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
 * build: nothing is written, the last committed Edition stays live. A merge
 * into an existing Story is only allowed when a Jev Membership check says
 * yes; but if every Membership check fails (the checker down, or a missing
 * key with checks pending), the build fails too: checks are the only guard
 * against permanent wrong merges, and a run where none of them answered is
 * not a run that can be trusted to write files. Checks are unbudgeted: the
 * gate's dedup ledger bounds every (Article, Story) pair to one check, so
 * the count is finite by construction (ADR-0012).
 *
 * Birth policy (ADR-0015): a Story is created only with at least two
 * Articles. An Article that matches nothing, whose Membership check is
 * refused or isolated-failed, or whose target is unknown or frozen stays
 * unassigned — written to no Story file, so the next build re-presents it
 * as fresh (the retry-ability the old split path destroyed: membership was
 * sticky, singletons never re-merge). A proposed Story reduced to its seed
 * alone is dropped before it can publish. A new Story proposed by the
 * Grouping model gets the seed guard (issue #36) first: across builds
 * against the most headline-similar live Stories, and within the build
 * against the other surviving seeds — so two same-event Articles proposed
 * as separate one-member Stories fold into one two-member Story instead of
 * both being dropped. A build-failing invariant (any created Story under
 * two Articles throws) keeps the policy true by construction.
 */
import { readdir, readFile } from 'node:fs/promises';
import type { Article, Section, Story, Topic } from '@prisme/domain';
import {
  newestFirst,
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
import { isLive, LIVE_WINDOW_MS } from './liveness.ts';
import { MembershipGate } from './membership-gate.ts';
import { ingestionIsOpen, parisDayKey } from './paris-day.ts';
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
  /** Stories with at least one live Article — what the Edition publishes. */
  live: Story[];
  /** Topics confirmed this build — threads that reached two Episodes; the
   * run merges them into data/topics.json (ADR-0024). */
  topics: ConfirmedTopic[];
}

function published(date: string): number {
  const t = Date.parse(date);
  return Number.isNaN(t) ? 0 : t;
}

/** True when the Story still has an Article inside the 24h window. */
export { isLive };

/** Deterministic Story order: newest Article first, ties by id. */
function byNewestArticle(a: Story, b: Story): number {
  const latest = (s: Story) =>
    Math.max(0, ...s.articles.map((a) => published(a.publishedAt)));
  return latest(b) - latest(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Articles inside the 24h window that no Story on disk claims yet, and
 * whose Publication day is still ingesting (ADR-0017): today's Articles,
 * plus yesterday's until 06:00 Paris — a 23h50 Article collected at 00:10
 * still finds its Story; past the window it stays out (Unassigned). */
function freshArticles(
  articles: Article[],
  existing: Story[],
  now: Date,
): Article[] {
  const cutoff = now.getTime() - LIVE_WINDOW_MS;
  const known = new Set(existing.flatMap((s) => s.articles.map((a) => a.id)));
  return articles.filter(
    (a) =>
      !known.has(a.id) &&
      published(a.publishedAt) > cutoff &&
      ingestionIsOpen(parisDayKey(a.publishedAt), now),
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
      published: published(m.publishedAt),
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
      published: published(m.publishedAt),
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
export function episodeContext(
  headlines: string[],
  existing: Story[],
  day: string,
): { title: string; storyDay: string } | undefined {
  const story = bestEpisodeMatch(headlines, existing, day);
  return story == null
    ? undefined
    : { title: story.title, storyDay: story.storyDay };
}

/** A Topic confirmed this build: a birth inherited it, so the thread has
 * reached two Episodes (ADR-0024). The run hands these to the registry
 * module, which owns the merge and mints the public slug — grouping itself
 * never sees registry state. */
export type ConfirmedTopic = Omit<Topic, 'slug'>;

/** Resolve the Topic of every Story born this build (ADR-0024), after the
 * Title pass and slug assignment. Every birth carries its Topic key for
 * life: the Episode it continues (lexicon proposes, Membership disposes —
 * a failed check throws and fails the build, ADR-0005) or, when it founds,
 * its own slug as a prospective key. A Topic exists from two Episodes, like
 * a Story exists from two Articles (ADR-0015): only inheritances confirm a
 * Topic, and only confirmed Topics reach the registry — a singleton story
 * never becomes one. A Story on disk without a topicId (the pre-Topics
 * archive) is never inherited from — no retro-assignment. */
async function resolveTopics(input: {
  births: Story[];
  existing: Story[];
  teasers: Map<string, string>;
  membership: MembershipChecker;
}): Promise<ConfirmedTopic[]> {
  const confirmed: ConfirmedTopic[] = [];
  for (const birth of input.births) {
    const episode = bestEpisodeMatch(
      birth.articles.map((a) => a.headline),
      input.existing,
      birth.storyDay,
    );
    if (episode?.topicId != null) {
      const seed = birth.articles[0]!;
      const verdict = await input.membership.belongs(
        {
          title: episode.title,
          section: episode.section,
          headlines: episode.articles.map((a) => a.headline),
        },
        { headline: seed.headline, teaser: input.teasers.get(seed.id) ?? '' },
      );
      if (verdict === 'failed')
        throw new Error(
          `Topic resolution failed: Membership could not answer whether Story ${birth.slug} continues Story ${episode.slug} (ADR-0024).`,
        );
      if (verdict === 'yes') {
        birth.topicId = episode.topicId;
        // The thread reached two Episodes: the Topic exists. The founding
        // Story on disk — frozen, final title — labels it, and its short
        // display label comes from the thread's own headlines (ADR-0024).
        // The public slug is not minted here: the registry module owns it
        // (ADR-0024), grouping never sees registry state.
        const labelPool = [
          episode.title,
          ...episode.articles.map((a) => a.headline),
          birth.title,
          ...birth.articles.map((a) => a.headline),
        ];
        confirmed.push({
          topicId: episode.topicId,
          title: episode.title,
          label: topicLabel(
            labelPool,
            input.existing.map((s) =>
              [s.title, ...s.articles.map((a) => a.headline)].join(' '),
            ),
          ),
          storyDay: episode.storyDay,
          createdAt: episode.createdAt,
        });
        continue;
      }
    }
    // No inheritable Episode (none matched, the pre-Topics archive, or
    // Membership refused): the birth founds a prospective Topic — its own
    // slug as key, no registry entry until a second Episode joins.
    birth.topicId = birth.slug;
  }
  return confirmed;
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

  /** The Stories the Grouping model sees and may receive Articles (ADR-0017):
   * only Stories whose ingestion window is still open — 06:00 Paris the day
   * after their day. Past it a Story is frozen (ADR-0005): invisible to the
   * model, unmergeable, whatever its 24h liveness. */
  const openSorted = () =>
    stories
      .filter((s) => ingestionIsOpen(s.storyDay, now))
      .sort(byNewestArticle);

  /** The belonging rule (ADR-0017): an Article may only join a Story of its
   * own Publication day (Europe/Paris day of its publishedAt). */
  const canJoin = (article: Article, story: Story): boolean =>
    parisDayKey(article.publishedAt) === story.storyDay;

  const articleDay = (a: Article): string => parisDayKey(a.publishedAt);

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

  // Note: a Story is never born from a single Article (ADR-0015) — newStory
  // is only called for model-proposed keys, and the two-Article minimum is
  // enforced by the drop pass and invariant below. Title and slug are
  // deferred to the Title pass: the slug derives from the final title
  // (ADR-0023), so a birth carries neither until the pass has answered.
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
    // Only open Stories (ADR-0017 ingestion window) are visible to the model;
    // frozen ones are closed (ADR-0005). Prompt text is unchanged — the pool
    // is what shrank to the current day.
    stories: openSorted().map((s) => ({
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

    // A Story is born on the Publication day of its founding Article — the
    // seed — fixed at creation (ADR-0017). An Article collected at 00:10 that
    // was published 23:50 the day before founds a Story of the day before.
    // A key no Article claimed never births a Story at all: the day can only
    // come from a founding Article, so there is nothing to create and nothing
    // to drop later (ADR-0015). Nothing downstream references a founderless
    // key — every lookup is gated on keyMembers having claimed it.
    const keyStories = new Map<string, Story>();
    for (const ns of proposal.newStories) {
      const founding = keyMembers.get(ns.key)?.[0];
      if (!founding) continue;
      keyStories.set(ns.key, newStory(articleDay(founding)));
    }

    // The belonging rule (ADR-0017) filters each key's members to the
    // founding day at claim time: a same-event Article published the next
    // day orphans instead of joining — and never spends a Membership check.
    for (const [key, members] of keyMembers) {
      const story = keyStories.get(key)!;
      keyMembers.set(
        key,
        members.filter((m) => articleDay(m) === story.storyDay),
      );
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
    // the seed first, so unrelated proposals never run a check (a fresh
    // build can propose hundreds of new Stories). A yes redirects
    // the seed into that Story: the proposed Story receives no seed and is
    // dropped before it can publish, and its further members are
    // re-targeted to the absorbing Story. Guard checks run first: an
    // unguarded seed creates a duplicate Story, which is worse than the
    // splits a starving merge would leave (ADR-0012 removed the budget).
    const absorbedInto = new Map<string, string>();
    // The Membership gate owns the verdict ledger and the
    // attempt/failure counters (ADR-0005, as amended; the budget is gone,
    // ADR-0012). Which pairs to ask
    // stays here — guard seeds first, then merge pairs by headline overlap.
    // A missing OPENROUTER_API_KEY arrives as the declared fail-when-pending
    // adapter (policy.ts): every attempt fails, so the total-failure rule
    // fires exactly when checks were pending.
    const gate = new MembershipGate({ checker: clients.membership });
    {
      // Guard candidates: existing Stories only (never the proposed keys),
      // open per the ingestion window (ADR-0017); a closed Story can never
      // absorb a seed. Other-day Stories are filtered per seed below.
      const live = stories
        .filter((s) => !created.includes(s) && ingestionIsOpen(s.storyDay, now))
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
        const ask: {
          target: string;
          story: MembershipStoryRef;
        }[] = [];
        for (const candidate of seedCandidates(
          seed,
          live.filter((s) => s.storyDay === articleDay(seed)),
        ))
          ask.push({
            target: candidate.id,
            story: {
              title: candidate.title,
              section: candidate.section,
              headlines: memberDigest(seed, candidate.articles),
            },
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
              story: {
                title: earlierHeadline,
                headlines: memberDigest(seed, keyMembers.get(earlier) ?? []),
              },
            });
        }
        for (const candidate of ask) {
          const yes =
            (await gate.ask({
              target: candidate.target,
              story: candidate.story,
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
        // Unknown, frozen (window closed), or other-day target: the model
        // only sees open Stories of matching days (ADR-0017).
        if (
          story == null ||
          !ingestionIsOpen(story.storyDay, now) ||
          !canJoin(article, story)
        ) {
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
        // seed (an absorbed seed's guard verdict is already recorded).
        const story = keyStories.get(target.slice(4))!;
        const members = keyMembers.get(target.slice(4))!;
        if (
          canJoin(article, story) &&
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

    // Stories below the two-Article birth minimum are dropped before they
    // ever publish (ADR-0015): no Article claimed (never proposed), or only
    // the seed joined (its members were refused). Their Articles are
    // orphaned — written to no Story file, they retry next build. An
    // existing Story may still grow from one Article to two: the minimum
    // governs births, not merges.
    for (const story of keyStories.values()) {
      if (story.articles.length < 2) {
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
        `Grouping: ${orphans.length} article(s) left unassigned — no Story is born from fewer than two Articles (ADR-0015); they retry next build.`,
      );

    // Invariant tripwire (ADR-0015): a Story born this build always has at
    // least two Articles. Unreachable while the drop pass above holds — its
    // job is to fail loudly if a future refactor reintroduces singleton
    // births, the corruption class no check caught in 2026-10.
    for (const story of created) {
      if (story.articles.length < 2)
        throw new Error(
          `No-singleton policy violated (ADR-0015): Story ${story.id} was created with ${story.articles.length} Article(s).`,
        );
    }

    // The Title pass (ADR-0023): one call per build, after resolution —
    // births are titled at creation (the slug will derive from the title),
    // and Stories that gained Articles may be re-titled while live. A
    // failed call propagates and fails the build: nothing has been written,
    // the last committed Edition stays live (same posture as Grouping).
    const births = [...keyStories.entries()]
      .filter(([, story]) => created.includes(story))
      .map(([key, story]) => ({
        key,
        headlines: story.articles.map((a) => a.headline),
        episode: episodeContext(
          story.articles.map((a) => a.headline),
          existing,
          story.storyDay,
        ),
      }));
    const updates = [...changedStories]
      .filter((s) => !created.includes(s))
      .sort(byNewestArticle)
      .map((s) => ({
        storyId: s.id,
        title: s.title,
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

  // Topics (ADR-0024): resolved after slugs — the Topic id is the founding
  // Story's slug — and before anything is written. A failed Membership
  // check throws and fails the build (ADR-0005).
  const topics = await resolveTopics({
    births: created,
    existing,
    teasers,
    membership: clients.membership,
  });

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
