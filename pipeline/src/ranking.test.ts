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
 * pieces included — then by the newest Article, then deterministically. The
 * Edition is uncapped (ADR-0022). Since ADR-0027 the Editions rank inside
 * rolling windows (rankStoriesInWindow, assembleEdition); rankStories is the
 * whole-life key.
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
 * The rolling-window Edition assembly (ADR-0027, amended by ADR-0029):
 * windows over ALL Stories — frozen ones included. « Aujourd'hui » (the
 * last 24 hours, uncapped, the home) and « 7 jours » (the last 7 days,
 * floored to Stories covered by ≥ 10 Outlets in the window) admit a Story
 * iff at least one of its Articles was published inside the window;
 * « En direct » (the last 12 hours) admits a Story iff its founding instant
 * falls inside the window. A Story leaves la Une by decay — no Outlet
 * reporting it inside the window — never at a clock edge.
 */
describe('assembleEdition', () => {
  // At DAY_NOON the day window is [2026-10-05T10:00:00Z, 2026-10-06T10:00:00Z],
  // the week window [2026-09-29T10:00:00Z, 2026-10-06T10:00:00Z] and the
  // En direct window [2026-10-05T22:00:00Z, 2026-10-06T10:00:00Z].
  const windows = (stories: Story[], now: Date = DAY_NOON) => {
    const { latest, day, week } = assembleEdition(stories, now);
    return {
      latest: latest.map((s) => s.id),
      day: day.map((s) => s.id),
      week: week.map((s) => s.id),
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
    // 2026-10-05T20:00Z (the floor term wins), so the Story is frozen at
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
    // The frozen Story is on la Une; the week claim is left to the floor
    // tests below — at one Outlet this Story stays under its cut.
    expect(windows([frozen]).day).toEqual(['frozen']);
  });

  it('excludes a Story with no Article in the window, however covered it was', () => {
    // Ten Outlets, eight days ago: past even the week window — the Story
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
    expect(windows([decayed])).toEqual({ latest: [], day: [], week: [] });
  });

  it('has an Article in the day window at exactly 24h of age, out one second earlier', () => {
    // The window is inclusive at both ends: the boundary Article is in,
    // the one a second older has aged out of « Aujourd'hui » (both stay in
    // the week window, but one Outlet each keeps them below its floor).
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
      latest: [],
      day: ['edge'],
      week: [],
    });
  });

  it('is uncapped: every Story with an Article in the window ranks (ADR-0022)', () => {
    const stories = Array.from({ length: 60 }, (_, i) =>
      story(`s${String(i).padStart(2, '0')}`, [article(`a${i}`)]),
    );
    expect(windows(stories).day).toHaveLength(60);
  });
  it('carries both windows: a below-floor day Story, an aged-out-of-day week Story', () => {
    const bigFresh = story(
      'big-fresh',
      coveredBy('bf', 10, '2026-10-06T09:00:00Z'),
    );
    const smallFresh = story(
      'small-fresh',
      coveredBy('sf', 2, '2026-10-06T08:00:00Z'),
    );
    const bigOld = {
      ...story(
        'big-old',
        coveredBy('bo', 10, '2026-10-03T10:00:00Z'),
        '2026-10-03T10:00:00Z',
        '2026-10-03',
      ),
      everInEdition: true,
    };
    expect(windows([smallFresh, bigOld, bigFresh])).toEqual({
      latest: ['big-fresh', 'small-fresh'],
      day: ['big-fresh', 'small-fresh'],
      week: ['big-fresh', 'big-old'],
    });
  });

  it('spans the week window exactly: 7 days of age is in, one second less is out', () => {
    const atEdge = {
      ...story(
        'edge',
        coveredBy('e', 10, '2026-09-29T10:00:00Z'),
        '2026-09-29T10:00:00Z',
        '2026-09-29',
      ),
      everInEdition: true,
    };
    const justPast = {
      ...story(
        'past',
        coveredBy('p', 10, '2026-09-29T09:59:59Z'),
        '2026-09-29T09:59:59Z',
        '2026-09-29',
      ),
      everInEdition: true,
    };
    expect(windows([justPast, atEdge]).week).toEqual(['edge']);
  });

  it('floors « 7 jours » at ten Outlets publishing in the window', () => {
    const nine = {
      ...story(
        'nine',
        coveredBy('n', 9, '2026-10-03T10:00:00Z'),
        '2026-10-03T10:00:00Z',
        '2026-10-03',
      ),
      everInEdition: true,
    };
    const ten = {
      ...story(
        'ten',
        coveredBy('t', 10, '2026-10-03T10:00:00Z'),
        '2026-10-03T10:00:00Z',
        '2026-10-03',
      ),
      everInEdition: true,
    };
    const eleven = {
      ...story(
        'eleven',
        coveredBy('el', 11, '2026-10-03T10:00:00Z'),
        '2026-10-03T10:00:00Z',
        '2026-10-03',
      ),
      everInEdition: true,
    };
    expect(windows([nine, ten, eleven]).week).toEqual(['eleven', 'ten']);
  });

  it('never lets a not_news Article carry a Story over the floor (ADR-0009)', () => {
    // Ten distinct Outlets in the window, one of them not_news: nine
    // reporting Outlets — below the floor.
    const articles = Array.from({ length: 10 }, (_, i) =>
      article(`nn${i}`, {
        outletId: `o${i}`,
        publishedAt: '2026-10-03T10:00:00Z',
        kind: i === 9 ? 'not_news' : 'news',
      }),
    );
    const notNewsTenth = {
      ...story('nn', articles, '2026-10-03T10:00:00Z', '2026-10-03'),
      everInEdition: true,
    };
    const tenReporting = {
      ...story(
        'tr',
        coveredBy('tr', 10, '2026-10-03T10:00:00Z'),
        '2026-10-03T10:00:00Z',
        '2026-10-03',
      ),
      everInEdition: true,
    };
    expect(windows([notNewsTenth, tenReporting]).week).toEqual(['tr']);
  });

  it('never gates membership on everInEdition', () => {
    const never = story('never', [article('2')]);
    expect(windows([never]).day).toEqual(['never']);
  });

  it('is rolling, not calendar-day: an overnight Article keeps a Story on la Une at 00:30', () => {
    // At 00:30 Paris of day D+1 the day window still reaches back to
    // 00:30 of day D: both the evening Story and one born right after
    // midnight rank (the issue #75 shape — no clock edge, no thin
    // morning edition); the newest in-window Article breaks their
    // one-Outlet tie.
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
    expect(windows([evening, lateBorn], NEXT_DAY_EARLY).day).toEqual([
      'late-born',
      'evening',
    ]);
  });

  it('a Story sinks out of « Aujourd’hui » as its Articles age past 24h, and stays in « 7 jours »', () => {
    // Founded 21:00Z of day D by ten Outlets: at 20:59:59Z of D+1 its
    // Articles are one second short of 24h of age — still on la Une; one
    // second later they have aged out of the day window, however
    // important, and only the week window still holds the Story.
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
      latest: [],
      day: ['evening'],
      week: ['evening'],
    });
    expect(windows([evening], new Date('2026-10-06T21:00:01Z'))).toEqual({
      latest: [],
      day: [],
      week: ['evening'],
    });
  });

  it('ranks two days’ Stories together by the in-window key', () => {
    // At 00:30 of D+1 both Stories have Articles inside the day window:
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
    expect(windows([narrowToday, wideYesterday], NEXT_DAY_EARLY).day).toEqual([
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
    expect(windows([future])).toEqual({
      latest: [],
      day: [],
      week: [],
    });
  });
});

/**
 * The « En direct » window (ADR-0029): every Story whose founding instant
 * (ADR-0026) falls within the rolling last 12 hours, ranked latest-first,
 * uncapped and unfloored — the window is the cap. Members are by
 * construction always ingestion-live and always a subset of
 * « Aujourd’hui ».
 */
describe('assembleEdition — « En direct » (ADR-0029)', () => {
  const latest = (stories: Story[], now: Date = DAY_NOON) =>
    assembleEdition(stories, now).latest.map((s) => s.id);

  it('admits by founding instant: founded exactly 12h ago is in, one second earlier is out', () => {
    const atEdge = story(
      'at-12h',
      [article('e', { publishedAt: '2026-10-05T22:00:00Z' })],
      '2026-10-05T22:00:00Z',
    );
    const justPast = story(
      'past-12h',
      [article('p', { publishedAt: '2026-10-05T21:59:59Z' })],
      '2026-10-05T21:59:59Z',
    );
    expect(latest([justPast, atEdge])).toEqual(['at-12h']);
  });

  it('never admits an older-founded Story for a fresh Article: membership follows the founding', () => {
    // Founded 14h ago, still widely reported (its newest Article is one
    // hour old): on la Une in every Coverage window, but not En direct —
    // the window's question is "what was just founded", not "what is
    // being reported".
    const growing = story('growing', [
      article('old', { publishedAt: '2026-10-05T20:00:00Z' }),
      article('new', {
        outletId: 'b',
        publishedAt: '2026-10-06T09:00:00Z',
      }),
    ]);
    const windows = assembleEdition([growing], DAY_NOON);
    expect(windows.latest.map((s) => s.id)).toEqual([]);
    expect(windows.day.map((s) => s.id)).toEqual(['growing']);
  });

  it('is uncapped and unfloored: any single-Outlet Story founded in the window ranks', () => {
    const stories = Array.from({ length: 30 }, (_, i) =>
      story(
        `s${String(i).padStart(2, '0')}`,
        [article(`a${i}`, { publishedAt: '2026-10-06T03:00:00Z' })],
        '2026-10-06T03:00:00Z',
      ),
    );
    expect(latest(stories)).toHaveLength(30);
  });

  it('ranks latest-first, differently from the Coverage-ordered « Aujourd’hui »', () => {
    // The wide Story ranks first on Coverage; the narrow scoop founded a
    // hour later tops En direct — founding desc beats every other tier.
    const wide = story('wide', [
      article('w0', { publishedAt: '2026-10-06T08:00:00Z' }),
      ...['b', 'c'].map((o) =>
        article(`w-${o}`, {
          outletId: o,
          publishedAt: '2026-10-06T08:30:00Z',
        }),
      ),
    ]);
    const scoop = story(
      'scoop',
      [article('s0', { publishedAt: '2026-10-06T09:30:00Z' })],
      '2026-10-06T09:30:00Z',
    );
    const windows = assembleEdition([scoop, wide], DAY_NOON);
    expect(windows.day.map((s) => s.id)).toEqual(['wide', 'scoop']);
    expect(windows.latest.map((s) => s.id)).toEqual(['scoop', 'wide']);
  });

  it('is always a subset of « Aujourd’hui » — the tested invariant (ADR-0029)', () => {
    // A mixed archive: a frozen day-old Story, an old-founded Story still
    // growing, one founded 13 hours ago — just outside the window, inside
    // the day — two founded inside the window. Non-empty on purpose: the
    // invariant must not pass vacuously.
    const frozen = {
      ...story(
        'frozen',
        [article('f', { publishedAt: '2026-10-05T08:00:00Z' })],
        '2026-10-05T08:00:00Z',
        '2026-10-05',
      ),
      everInEdition: true,
    };
    const growing = story('growing', [
      article('g0', { publishedAt: '2026-10-05T20:00:00Z' }),
      article('g1', {
        outletId: 'b',
        publishedAt: '2026-10-06T09:00:00Z',
      }),
    ]);
    const thirteenHoursOld = story(
      '13h',
      [article('n', { publishedAt: '2026-10-05T21:00:00Z' })],
      '2026-10-05T21:00:00Z',
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
      thirteenHoursOld,
      young('young-3', 3),
      young('young-7', 7),
    ];
    const { latest, day } = assembleEdition(stories, DAY_NOON);
    const latestIds = latest.map((s) => s.id);
    const dayIds = new Set(day.map((s) => s.id));
    expect(latestIds.length).toBeGreaterThan(0);
    expect(latestIds.every((id) => dayIds.has(id))).toBe(true);
    expect(latestIds).toEqual(['young-7', 'young-3']);
  });

  it('keeps a future-dated founding out of « En direct » too (defensive)', () => {
    const future = story(
      'future',
      [article('1', { publishedAt: '2026-10-06T11:00:00Z' })],
      '2026-10-06T11:00:00Z',
      '2026-10-07',
    );
    expect(latest([future])).toEqual([]);
  });
});
