import type { Article, Story } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import { isLive } from './liveness.ts';
import {
  assembleEdition,
  rankStories,
  rankStoriesInWindow,
} from './ranking.ts';

/**
 * The Edition ranking (issue #37, ADR-0009 as amended by ADR-0011): Stories
 * order by Coverage — distinct Outlets with any Article on the Story, Opinion
 * pieces included — then by the newest Article, then deterministically.
 * Since ADR-0027 the Editions rank inside rolling windows
 * (rankStoriesInWindow, assembleEdition); rankStories is the whole-life
 * key. The ranked sorts are capped at 25 (spec #158, ending ADR-0022's
 * uncapped rule).
 */

function article(id: string, overrides: Partial<Article> = {}): Article {
  return {
    id,
    outletId: 'a',
    headline: `Titre ${id}`,
    url: `https://a.fr/${id}`,
    publishedAt: '2026-10-06T10:00:00Z',
    frontPage: false,
    kind: 'news',
    ...overrides,
  };
}

function story(
  id: string,
  articles: Article[],
  createdAt = '2026-10-06T10:00:00Z',
  storyDay = '2026-10-06',
): Story {
  return { id, slug: id, title: 'Sujet', createdAt, storyDay, articles };
}

// Noon Paris on day D+1 (10:00 UTC, CEST): Stories founded up to 24h ago
// are open — the ordinary in-day view of the Edition.
const DAY_NOON = new Date('2026-10-06T10:00:00Z');
// 00:30 Paris of day D+1 (22:30 UTC of D): the post-midnight view where the
// midnight gap appeared — an evening Story's Articles are still inside the
// rolling day window.
const NEXT_DAY_EARLY = new Date('2026-10-05T22:30:00Z');

const ranked = (stories: Story[]) => rankStories(stories).map((s) => s.id);

describe('rankStories', () => {
  it('orders by Coverage — reporting Outlets — regardless of Front-page flags', () => {
    const wide = story('wide', [
      article('1'),
      article('2', { outletId: 'b' }),
      article('3', { outletId: 'c' }),
    ]);
    const flagged = story('flagged', [
      article('4', { frontPage: true }),
      article('5', { frontPage: true }),
    ]);
    expect(ranked([flagged, wide])).toEqual(['wide', 'flagged']);
  });

  it('puts a wide Story with no Front-page Articles above fresh une-feed singletons (issue #37)', () => {
    const wide = story('wide', [
      article('1'),
      ...Array.from({ length: 14 }, (_, i) =>
        article(`w${i}`, { outletId: `o${i}` }),
      ),
    ]);
    const singletons = Array.from({ length: 19 }, (_, i) =>
      story(`s${i}`, [article(`a${i}`, { frontPage: true })]),
    );
    const rankedIds = ranked([wide, ...singletons]);
    expect(rankedIds[0]).toBe('wide');
    expect(rankedIds.slice(1)).toEqual(singletons.map((s) => s.id).sort());
  });

  it('uses Coverage — reporting Outlets', () => {
    const one = story('one', [article('1')]);
    const two = story('two', [article('2'), article('3', { outletId: 'b' })]);
    expect(ranked([one, two])).toEqual(['two', 'one']);
  });

  it('counts Opinion pieces toward Coverage (ADR-0011)', () => {
    const news = story('news', [article('1')]);
    const opinion = story('op', [
      article('2'),
      article('3', { outletId: 'b', kind: 'opinion' }),
      article('4', { kind: 'opinion' }),
    ]);
    expect(ranked([opinion, news])).toEqual(['op', 'news']);
  });

  it('still never counts not_news or unclassified Articles toward Coverage', () => {
    const news = story('news', [article('1')]);
    const junk = story('junk', [
      article('2', { kind: 'not_news' }),
      article('3', { outletId: 'b', kind: undefined }),
    ]);
    expect(ranked([junk, news])).toEqual(['news', 'junk']);
  });

  it('breaks Coverage ties by the newest Article', () => {
    const older = story('older', [
      article('1', { publishedAt: '2026-10-06T09:00:00Z' }),
    ]);
    const newer = story('newer', [
      article('2', { publishedAt: '2026-10-06T11:00:00Z' }),
    ]);
    expect(ranked([newer, older])).toEqual(['newer', 'older']);
  });

  it('breaks full ties by createdAt, then by id', () => {
    const early = story('early', [article('1')], '2026-10-06T08:00:00Z');
    const late = story('late', [article('2')], '2026-10-06T09:00:00Z');
    expect(ranked([late, early])).toEqual(['early', 'late']);
    expect(
      ranked([story('b', [article('1')]), story('a', [article('2')])]),
    ).toEqual(['a', 'b']);
  });
});

/**
 * The rolling-window ranking (ADR-0027, amending ADR-0009): the Coverage
 * key counted over the Articles published inside the window only — the
 * whole-life key above stays the archive and merge tooling's.
 */
describe('rankStoriesInWindow', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const rankedInDay = (stories: Story[]) =>
    rankStoriesInWindow(stories, DAY_MS, DAY_NOON).map((s) => s.id);

  it('counts Coverage inside the window: Outlets reporting outside it never count', () => {
    // 'thinned' was covered by five Outlets two days ago; only one is
    // still inside the window. The whole-life key would put it first; the
    // windowed key does not — a Story sinks as its Coverage thins.
    const thinned = story('thinned', [
      ...['b', 'c', 'd', 'e'].map((o) =>
        article(`t-${o}`, {
          outletId: o,
          publishedAt: '2026-10-04T10:00:00Z',
        }),
      ),
      article('t-a', { outletId: 'a' }),
    ]);
    const fresh = story('fresh', [
      article('f-a', { outletId: 'a' }),
      article('f-b', { outletId: 'b' }),
    ]);
    expect(rankedInDay([thinned, fresh])).toEqual(['fresh', 'thinned']);
  });

  it('counts an in-window Opinion piece toward Coverage (ADR-0011)', () => {
    const op = story('op', [
      article('1', { outletId: 'a' }),
      article('2', { outletId: 'b', kind: 'opinion' }),
      // An Opinion piece outside the window adds nothing.
      article('3', {
        outletId: 'c',
        kind: 'opinion',
        publishedAt: '2026-10-04T10:00:00Z',
      }),
    ]);
    const news = story('news', [article('4', { outletId: 'a' })]);
    expect(rankedInDay([news, op])).toEqual(['op', 'news']);
  });

  it('never counts not_news or unclassified Articles inside the window', () => {
    const junk = story('junk', [
      article('1', { kind: 'not_news' }),
      article('2', { outletId: 'b', kind: undefined }),
    ]);
    const news = story('news', [article('3')]);
    expect(rankedInDay([junk, news])).toEqual(['news', 'junk']);
  });

  it('breaks Coverage ties by the newest Article in the window — Articles outside never participate', () => {
    // 'a2' owns the newer in-window Article (08:00Z). 'b2' owns a
    // future-dated Article (11:00Z, an hour past the Edition instant —
    // defensive fixture): the whole-life key would read it as the newest
    // and lift 'b2'; the windowed key ignores it, for the tie-break and
    // for Coverage alike (both Stories stay at two Outlets).
    const a2 = story('a2', [
      article('1', { outletId: 'a', publishedAt: '2026-10-06T08:00:00Z' }),
      article('2', { outletId: 'b', publishedAt: '2026-10-06T07:00:00Z' }),
    ]);
    const b2 = story('b2', [
      article('3', { outletId: 'c', publishedAt: '2026-10-06T07:00:00Z' }),
      article('4', { outletId: 'd', publishedAt: '2026-10-06T07:00:00Z' }),
      article('5', { outletId: 'e', publishedAt: '2026-10-06T11:00:00Z' }),
    ]);
    expect(rankedInDay([b2, a2])).toEqual(['a2', 'b2']);
  });

  it('breaks full ties by createdAt, then by id', () => {
    const early = story(
      'early',
      [article('1', { publishedAt: '2026-10-06T09:00:00Z' })],
      '2026-10-06T08:00:00Z',
    );
    const late = story(
      'late',
      [article('2', { publishedAt: '2026-10-06T09:00:00Z' })],
      '2026-10-06T09:00:00Z',
    );
    expect(rankedInDay([late, early])).toEqual(['early', 'late']);
    expect(
      rankedInDay([story('b', [article('1')]), story('a', [article('2')])]),
    ).toEqual(['a', 'b']);
  });

  it('sorts Stories with no in-window Article last, deterministically', () => {
    const agedOut = story(
      'out',
      [article('1', { publishedAt: '2026-10-04T10:00:00Z' })],
      '2026-10-04T10:00:00Z',
    );
    const inWindow = story('in', [article('2')]);
    expect(rankedInDay([agedOut, inWindow])).toEqual(['in', 'out']);
  });
});

/**
 * The rolling-window Edition assembly (ADR-0027, amended by ADR-0029
 * and ADR-0036, re-sorted by spec #158): windows over ALL Stories —
 * frozen ones included. The pool admits a Story iff at least one of its
 * Articles was published inside the last 24 hours; Brûlant re-ranks the
 * pool by the double-decay key, Top by in-window Coverage, and both
 * ranked sorts are capped at 25 — Nouveau admits by founding instant
 * inside the last 24 hours, uncapped: the window is the cap. A Story
 * leaves la Une by decay — no Outlet reporting it inside the window —
 * never at a clock edge.
 */
describe('assembleEdition', () => {
  // At DAY_NOON the day window and Nouveau's founding window are both
  // [2026-10-05T10:00:00Z, 2026-10-06T10:00:00Z].
  const windows = (stories: Story[], now: Date = DAY_NOON) => {
    const { new: nouveau, hot, top } = assembleEdition(stories, now);
    return {
      new: nouveau.map((s) => s.id),
      hot: hot.map((s) => s.id),
      top: top.map((s) => s.id),
    };
  };
  /** `outlets` distinct-Outlets Articles all published at `publishedAt`. */
  const coveredBy = (
    prefix: string,
    outlets: number,
    publishedAt: string,
  ): Article[] =>
    Array.from({ length: outlets }, (_, i) =>
      article(`${prefix}${i}`, { outletId: `o${i}`, publishedAt }),
    );

  it('includes a frozen Story with an Article inside the window (ADR-0027)', () => {
    // Founded 2026-10-04T20:00Z, newest Article 2026-10-05T12:00Z: its
    // Ingestion window closed at max(founding + 24h, newest + 12h) =
    // 2026-10-06T00:00Z (the silence term wins), so the Story is frozen at
    // the Edition instant — but that Article is inside the day window, so
    // the Story stays on la Une: the Edition is a window over all Stories,
    // not the set of window-open ones.
    const frozen = {
      ...story(
        'frozen',
        [
          article('f1', { publishedAt: '2026-10-04T20:00:00Z' }),
          article('f2', { publishedAt: '2026-10-05T12:00:00Z' }),
        ],
        '2026-10-04T20:00:00Z',
        '2026-10-04',
      ),
      everInEdition: true,
    };
    expect(isLive(frozen, DAY_NOON)).toBe(false);
    // The frozen Story is on la Une in both ranked sorts — the Edition
    // is a window over all Stories, not the set of window-open ones.
    expect(windows([frozen])).toEqual({
      new: [],
      hot: ['frozen'],
      top: ['frozen'],
    });
  });

  it('excludes a Story with no Article in the window, however covered it was', () => {
    // Ten Outlets, eight days ago: past every window — the Story
    // left by decay, never by a clock (ADR-0027).
    const decayed = {
      ...story(
        'decayed',
        coveredBy('d', 10, '2026-09-28T10:00:00Z'),
        '2026-09-28T10:00:00Z',
        '2026-09-28',
      ),
      everInEdition: true,
    };
    expect(windows([decayed])).toEqual({ new: [], hot: [], top: [] });
  });

  it('has an Article in the day window at exactly 24h of age, out one second earlier', () => {
    // The window is inclusive at both ends: the boundary Article is in,
    // the one a second older has aged out of the pool — and its Story,
    // founded on it, out of Nouveau with it.
    const atEdge = story(
      'edge',
      [article('e', { publishedAt: '2026-10-05T10:00:00Z' })],
      '2026-10-05T10:00:00Z',
      '2026-10-05',
    );
    const justPast = story(
      'past',
      [article('p', { publishedAt: '2026-10-05T09:59:59Z' })],
      '2026-10-05T09:59:59Z',
      '2026-10-05',
    );
    expect(windows([justPast, atEdge])).toEqual({
      new: ['edge'],
      hot: ['edge'],
      top: ['edge'],
    });
  });

  it('admits every pool member under the cap: membership is uncapped, the ranked sorts are not', () => {
    const bigFresh = story(
      'big-fresh',
      coveredBy('bf', 10, '2026-10-06T09:00:00Z'),
    );
    const smallFresh = story(
      'small-fresh',
      coveredBy('sf', 2, '2026-10-06T08:00:00Z'),
    );
    expect(windows([smallFresh, bigFresh])).toEqual({
      new: ['big-fresh', 'small-fresh'],
      hot: ['big-fresh', 'small-fresh'],
      top: ['big-fresh', 'small-fresh'],
    });
  });

  it('never gates membership on everInEdition', () => {
    const never = story('never', [article('2')]);
    expect(windows([never]).top).toEqual(['never']);
  });

  it('is rolling, not calendar-day: an overnight Article keeps a Story on la Une at 00:30', () => {
    // At 00:30 Paris of day D+1 both windows still reach back to
    // 00:30 of day D: both the evening Story and one born right after
    // midnight rank in every sort (the issue #75 shape — no clock edge,
    // no thin morning edition); the newest in-window Article breaks
    // their one-Outlet tie, the founding instant orders Nouveau.
    const evening = {
      ...story(
        'evening',
        [article('1', { publishedAt: '2026-10-05T20:00:00Z' })],
        '2026-10-05T20:00:00Z',
        '2026-10-05',
      ),
      everInEdition: true,
    };
    const lateBorn = {
      ...story(
        'late-born',
        [article('2', { publishedAt: '2026-10-05T22:01:00Z' })],
        '2026-10-05T22:01:00Z',
        '2026-10-06',
      ),
      everInEdition: false,
    };
    expect(windows([evening, lateBorn], NEXT_DAY_EARLY)).toEqual({
      new: ['late-born', 'evening'],
      hot: ['late-born', 'evening'],
      top: ['late-born', 'evening'],
    });
  });

  it('a Story sinks out of the pool as its Articles age past 24h', () => {
    // Founded 21:00Z of day D by ten Outlets: at 20:59:59Z of D+1 its
    // Articles are one second short of 24h of age — still on la Une; one
    // second later they have aged out of every sort, however important
    // the Story (ADR-0027: decay, never a clock).
    const evening = {
      ...story(
        'evening',
        coveredBy('e', 10, '2026-10-05T21:00:00Z'),
        '2026-10-05T21:00:00Z',
        '2026-10-05',
      ),
      everInEdition: true,
    };
    expect(windows([evening], new Date('2026-10-06T20:59:59Z'))).toEqual({
      new: ['evening'],
      hot: ['evening'],
      top: ['evening'],
    });
    expect(windows([evening], new Date('2026-10-06T21:00:01Z'))).toEqual({
      new: [],
      hot: [],
      top: [],
    });
  });

  it('ranks two days’ Stories together by the in-window key', () => {
    // At 00:30 of D+1 both Stories have Articles inside the window:
    // one ranked pool, ordered by in-window Coverage.
    const wideYesterday = {
      ...story(
        'wide-d',
        [
          article('1', { publishedAt: '2026-10-05T20:00:00Z' }),
          article('2', { outletId: 'b', publishedAt: '2026-10-05T21:00:00Z' }),
        ],
        '2026-10-05T20:00:00Z',
        '2026-10-05',
      ),
      everInEdition: false,
    };
    const narrowToday = story(
      'narrow-d1',
      [article('3', { publishedAt: '2026-10-05T22:10:00Z' })],
      '2026-10-05T22:10:00Z',
      '2026-10-06',
    );
    expect(windows([narrowToday, wideYesterday], NEXT_DAY_EARLY).top).toEqual([
      'wide-d',
      'narrow-d1',
    ]);
  });

  it('keeps a future-dated Article out of every window (defensive)', () => {
    // Membership follows Article instants, not storyDay: a hand-edited
    // file from a future day with a future-dated Article ranks nowhere —
    // the window's upper bound does the guard ADR-0026's storyDay check
    // used to do.
    const future = story(
      'future',
      [article('1', { publishedAt: '2026-10-06T11:00:00Z' })],
      '2026-10-06T11:00:00Z',
      '2026-10-07',
    );
    expect(windows([future])).toEqual({ new: [], hot: [], top: [] });
  });

  it('is deterministic across builds: the same Stories in any input order give the same windows', () => {
    const stories = [
      story('s1', [article('1', { publishedAt: '2026-10-06T08:00:00Z' })]),
      story(
        's2',
        [
          article('2', { publishedAt: '2026-10-06T09:00:00Z' }),
          article('3', { outletId: 'b', publishedAt: '2026-10-06T09:30:00Z' }),
        ],
        '2026-10-06T09:00:00Z',
      ),
      story(
        's3',
        [article('4', { publishedAt: '2026-10-05T11:00:00Z' })],
        '2026-10-05T11:00:00Z',
      ),
    ];
    const first = windows(stories);
    expect(windows([...stories].reverse())).toEqual(first);
  });
});

/**
 * The Nouveau window (spec #158, widening ADR-0029's twelve hours):
 * every Story whose founding instant (ADR-0026) falls within the rolling
 * last 24 hours, ranked latest-first, uncapped — the window is the cap.
 * Members are by construction always a subset of the 24-hour pool
 * (founding-bounded membership: a Story founded inside 24 h has its
 * founding Article — its earliest — inside the window too).
 */
describe('assembleEdition — Nouveau (spec #158)', () => {
  const nouveau = (stories: Story[], now: Date = DAY_NOON) =>
    assembleEdition(stories, now).new.map((s) => s.id);

  it('admits by founding instant: founded exactly 24h ago is in, one second earlier is out', () => {
    const atEdge = story(
      'at-24h',
      [article('e', { publishedAt: '2026-10-05T10:00:00Z' })],
      '2026-10-05T10:00:00Z',
    );
    const justPast = story(
      'past-24h',
      [article('p', { publishedAt: '2026-10-05T09:59:59Z' })],
      '2026-10-05T09:59:59Z',
    );
    expect(nouveau([justPast, atEdge])).toEqual(['at-24h']);
  });

  it('never admits an older-founded Story for a fresh Article: membership follows the founding', () => {
    // Founded 26h ago, still reported (its newest Article is one hour
    // old): on la Une in both ranked sorts, but not Nouveau — the
    // window's question is "what was just founded", not "what is being
    // reported".
    const growing = story(
      'growing',
      [
        article('old', { publishedAt: '2026-10-05T08:00:00Z' }),
        article('new', { outletId: 'b', publishedAt: '2026-10-06T09:00:00Z' }),
      ],
      '2026-10-05T08:00:00Z',
    );
    const windows = assembleEdition([growing], DAY_NOON);
    expect(windows.new.map((s) => s.id)).toEqual([]);
    expect(windows.top.map((s) => s.id)).toEqual(['growing']);
  });

  it('is uncapped: any single-Outlet Story founded in the window ranks', () => {
    const stories = Array.from({ length: 30 }, (_, i) =>
      story(
        `s${String(i).padStart(2, '0')}`,
        [article(`a${i}`, { publishedAt: '2026-10-06T03:00:00Z' })],
        '2026-10-06T03:00:00Z',
      ),
    );
    expect(nouveau(stories)).toHaveLength(30);
  });

  it('ranks latest-first, differently from the Coverage-ordered Top', () => {
    // The wide Story ranks first on Coverage; the narrow scoop founded a
    // hour later tops Nouveau — founding desc beats every other tier.
    const wide = story(
      'wide',
      [
        article('w0', { publishedAt: '2026-10-06T08:00:00Z' }),
        ...['b', 'c'].map((o) =>
          article(`w-${o}`, {
            outletId: o,
            publishedAt: '2026-10-06T08:30:00Z',
          }),
        ),
      ],
      '2026-10-06T08:00:00Z',
    );
    const scoop = story(
      'scoop',
      [article('s0', { publishedAt: '2026-10-06T09:30:00Z' })],
      '2026-10-06T09:30:00Z',
    );
    const windows = assembleEdition([scoop, wide], DAY_NOON);
    expect(windows.top.map((s) => s.id)).toEqual(['wide', 'scoop']);
    expect(windows.new.map((s) => s.id)).toEqual(['scoop', 'wide']);
  });

  it('is always a subset of the pool — the tested invariant (ADR-0029, founding-bounded)', () => {
    // A mixed archive under the cap, so the capped slices equal the
    // pool: a frozen day-old Story, an old-founded Story still growing,
    // one founded 25 hours ago — just outside the founding window, its
    // fresh Article still inside the day window — two founded inside
    // the window. Non-empty on purpose: the invariant must not pass
    // vacuously. A Story founded inside 24 h has all its Articles inside
    // 24 h, so Nouveau ⊆ pool by construction.
    const frozen = {
      ...story(
        'frozen',
        [article('f', { publishedAt: '2026-10-05T08:00:00Z' })],
        '2026-10-05T08:00:00Z',
        '2026-10-05',
      ),
      everInEdition: true,
    };
    const growing = story(
      'growing',
      [
        article('g0', { publishedAt: '2026-10-05T08:30:00Z' }),
        article('g1', { outletId: 'b', publishedAt: '2026-10-06T09:00:00Z' }),
      ],
      '2026-10-05T08:30:00Z',
    );
    const twentyFiveHoursOld = story(
      '25h',
      [
        article('n', { publishedAt: '2026-10-05T09:00:00Z' }),
        article('n2', { outletId: 'b', publishedAt: '2026-10-06T09:30:00Z' }),
      ],
      '2026-10-05T09:00:00Z',
    );
    const young = (id: string, hour: number) =>
      story(
        id,
        [article(`${id}-a`, { publishedAt: `2026-10-06T0${hour}:00:00Z` })],
        `2026-10-06T0${hour}:00:00Z`,
      );
    const stories = [
      frozen,
      growing,
      twentyFiveHoursOld,
      young('young-3', 3),
      young('young-7', 7),
    ];
    const {
      new: nouveauStories,
      hot,
      top,
    } = assembleEdition(stories, DAY_NOON);
    const nouveauIds = nouveauStories.map((s) => s.id);
    const hotIds = new Set(hot.map((s) => s.id));
    const topIds = new Set(top.map((s) => s.id));
    expect(nouveauIds.length).toBeGreaterThan(0);
    expect(nouveauIds.every((id) => hotIds.has(id))).toBe(true);
    expect(nouveauIds.every((id) => topIds.has(id))).toBe(true);
    expect(nouveauIds).toEqual(['young-7', 'young-3']);
  });

  it('keeps a future-dated founding out of Nouveau too (defensive)', () => {
    const future = story(
      'future',
      [article('1', { publishedAt: '2026-10-06T11:00:00Z' })],
      '2026-10-06T11:00:00Z',
      '2026-10-07',
    );
    expect(nouveau([future])).toEqual([]);
  });
});

/**
 * The ranked sorts (spec #158): Brûlant re-ranks the 24-hour pool by the
 * double-decay key, Top by in-window Coverage — and both are capped at
 * 25: the slice keeps the key's order, it never re-decides membership.
 * Nouveau alone stays uncapped and carries everything.
 */
describe('assembleEdition — Brûlant and Top caps (spec #158)', () => {
  const cap = (stories: Story[], now: Date = DAY_NOON) => {
    const { hot, top } = assembleEdition(stories, now);
    return {
      hot: hot.map((s) => s.id),
      top: top.map((s) => s.id),
    };
  };
  /** 30 one-Outlet Stories founded together: full ties everywhere, so
   * every key falls through to id asc — a deterministic order the cap
   * slices. */
  const thirtyTied = () =>
    Array.from({ length: 30 }, (_, i) =>
      story(
        `s${String(i).padStart(2, '0')}`,
        [article(`a${i}`, { publishedAt: '2026-10-06T03:00:00Z' })],
        '2026-10-06T03:00:00Z',
      ),
    );

  it('caps Brûlant and Top at 25 — the first 25 of each key’s order, never a different membership', () => {
    const stories = thirtyTied();
    const first25 = stories.slice(0, 25).map((s) => s.id);
    expect(cap(stories)).toEqual({ hot: first25, top: first25 });
  });

  it('leaves the Story ranked 26th out of both capped sorts, in the pool and in Nouveau', () => {
    const stories = thirtyTied();
    const windows = assembleEdition(stories, DAY_NOON);
    const ranked26th = 's25';
    const hotIds = new Set(windows.hot.map((s) => s.id));
    const topIds = new Set(windows.top.map((s) => s.id));
    expect(hotIds.has(ranked26th)).toBe(false);
    expect(topIds.has(ranked26th)).toBe(false);
    // Still a pool member and a Nouveau member — only the page is capped,
    // not the news: Nouveau carries the tail.
    expect(windows.new.map((s) => s.id)).toContain(ranked26th);
  });

  it('re-ranks the pool with both clocks: founding age can flip the Coverage order', () => {
    // 'squatter' carries 4 Outlets and was heard from again half an hour
    // ago, but was founded 20 h before the build — Top ranks it first on
    // Coverage, the founding clock sinks it under the fresh three-Outlet
    // scoop (spec #158, the key of the same counter-example in the domain
    // tests).
    const squatter = story(
      'squatter',
      [
        article('sq-old', {
          outletId: 'a',
          publishedAt: '2026-10-05T14:00:00Z',
        }),
        ...['b', 'c', 'd'].map((o) =>
          article(`sq-${o}`, {
            outletId: o,
            publishedAt: '2026-10-06T09:30:00Z',
          }),
        ),
      ],
      '2026-10-05T14:00:00Z',
    );
    const scoop = story(
      'scoop',
      [
        article('sc-a', { publishedAt: '2026-10-06T09:00:00Z' }),
        article('sc-b', {
          outletId: 'b',
          publishedAt: '2026-10-06T09:00:00Z',
        }),
        article('sc-c', {
          outletId: 'c',
          publishedAt: '2026-10-06T09:00:00Z',
        }),
      ],
      '2026-10-06T09:00:00Z',
    );
    const windows = assembleEdition([scoop, squatter], DAY_NOON);
    expect(windows.top.map((s) => s.id)).toEqual(['squatter', 'scoop']);
    expect(windows.hot.map((s) => s.id)).toEqual(['scoop', 'squatter']);
  });

  it('admits an old-founded Story still covered into Brûlant and Top — no founding bound, unlike Nouveau', () => {
    // Founded three days ago, reported again this morning: a pool
    // member in both ranked sorts, but not Nouveau — the pages carry
    // the previous days' still-covered Stories (ADR-0036's premise,
    // kept by spec #158).
    const carried = story(
      'carried',
      [
        article('old', { publishedAt: '2026-10-03T10:00:00Z' }),
        article('new', { outletId: 'b', publishedAt: '2026-10-06T08:00:00Z' }),
      ],
      '2026-10-03T10:00:00Z',
    );
    const windows = assembleEdition([carried], DAY_NOON);
    expect(windows.new.map((s) => s.id)).toEqual([]);
    expect(windows.hot.map((s) => s.id)).toEqual(['carried']);
    expect(windows.top.map((s) => s.id)).toEqual(['carried']);
  });

  it('caps deterministically: the same Stories in any input order give the same 25', () => {
    const stories = thirtyTied();
    const first = cap(stories);
    expect(cap([...stories].reverse())).toEqual(first);
  });
});
