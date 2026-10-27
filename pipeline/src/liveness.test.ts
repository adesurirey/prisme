import type { Article, Story } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import {
  COLLECTION_WINDOW_MS,
  INGESTION_CEILING_MS,
  INGESTION_FLOOR_MS,
  INGESTION_SILENCE_MS,
  ingestionIsOpen,
  ingestionWindowClosesAt,
  isLive,
  joinsIngestionWindow,
} from './liveness.ts';

const NOW = new Date('2026-10-07T14:00:00Z');

const article = (publishedAt: string, id = 'a1'): Article => ({
  id,
  outletId: 'le-parisien',
  headline: 'T',
  url: `https://www.leparisien.fr/${id}`,
  publishedAt,
  frontPage: false,
});

const story = (articles: Article[], id = 's1'): Story => ({
  id,
  slug: id,
  title: 'T',
  createdAt: NOW.toISOString(),
  storyDay: '2026-10-06',
  articles,
});

describe('the two windows are separate constants (ADR-0027)', () => {
  it('the collection window is exactly 24 hours — what a build gathers', () => {
    expect(COLLECTION_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('the Ingestion floor is 24 hours and the silence term 12 hours', () => {
    expect(INGESTION_FLOOR_MS).toBe(24 * 60 * 60 * 1000);
    expect(INGESTION_SILENCE_MS).toBe(12 * 60 * 60 * 1000);
  });

  it('the ceiling is 72 hours (ADR-0033)', () => {
    expect(INGESTION_CEILING_MS).toBe(72 * 60 * 60 * 1000);
  });
});

describe('ingestion window (ADR-0027, ADR-0033): [founding, min(max(founding + 24h, newest + 12h), founding + 72h)]', () => {
  it('is never shorter than founding + 24h: the floor term wins while it is the later', () => {
    // Founded 22:00Z, newest Article five hours later: the pure-rolling
    // 12h-from-newest rule would close the window at founding + 17h —
    // ADR-0027 measured that regression (252 of 339 Stories frozen
    // earlier) and rejected it. The floor holds: founding + 24h.
    const s = story([
      article('2026-10-06T22:00:00Z', 'a0'),
      article('2026-10-07T03:00:00Z', 'a2'),
    ]);
    expect(ingestionWindowClosesAt(s)).toBe(Date.parse('2026-10-07T22:00:00Z'));
  });

  it('extends to newest + 12h once that is later than the floor', () => {
    // Founded 22:00Z Oct 6, newest Article 20:00Z Oct 7 (founding + 22h):
    // the close is newest + 12h = 08:00Z Oct 8, past founding + 24h.
    const s = story([
      article('2026-10-06T22:00:00Z', 'a0'),
      article('2026-10-07T20:00:00Z', 'a2'),
    ]);
    expect(ingestionWindowClosesAt(s)).toBe(Date.parse('2026-10-08T08:00:00Z'));
  });

  it('each Article that joined pushed the close 12 hours past itself', () => {
    const solo = story([article('2026-10-06T22:00:00Z', 'a0')]);
    const grown = story([
      article('2026-10-06T22:00:00Z', 'a0'),
      article('2026-10-07T18:00:00Z', 'a2'),
    ]);
    expect(ingestionWindowClosesAt(solo)).toBe(
      Date.parse('2026-10-07T22:00:00Z'),
    );
    expect(ingestionWindowClosesAt(grown)).toBe(
      Date.parse('2026-10-08T06:00:00Z'),
    );
  });

  it('is open right at the founding instant', () => {
    expect(
      ingestionIsOpen(
        story([article('2026-10-06T22:00:00Z', 'a0')]),
        new Date('2026-10-06T22:00:00Z'),
      ),
    ).toBe(true);
  });

  it('is closed before the founding instant', () => {
    expect(
      ingestionIsOpen(
        story([article('2026-10-06T22:00:00Z', 'a0')]),
        new Date('2026-10-06T21:59:59Z'),
      ),
    ).toBe(false);
  });

  it('floor boundary: open at exactly founding + 24h, closed one second later', () => {
    const s = story([article('2026-10-06T22:00:00Z', 'a0')]);
    expect(ingestionIsOpen(s, new Date('2026-10-07T21:59:59Z'))).toBe(true);
    expect(ingestionIsOpen(s, new Date('2026-10-07T22:00:00Z'))).toBe(true);
    expect(ingestionIsOpen(s, new Date('2026-10-07T22:00:01Z'))).toBe(false);
  });

  it('silence boundary: open at exactly newest + 12h, closed one second later', () => {
    // In the extension regime (close = newest + 12h, later than the floor):
    // founded 22:00Z Oct 6, newest 20:00Z Oct 7, close 08:00Z Oct 8.
    const s = story([
      article('2026-10-06T22:00:00Z', 'a0'),
      article('2026-10-07T20:00:00Z', 'a2'),
    ]);
    expect(ingestionIsOpen(s, new Date('2026-10-08T07:59:59Z'))).toBe(true);
    expect(ingestionIsOpen(s, new Date('2026-10-08T08:00:00Z'))).toBe(true);
    expect(ingestionIsOpen(s, new Date('2026-10-08T08:00:01Z'))).toBe(false);
  });

  it('is closed for an empty or all-undated Story: no founding, no window', () => {
    expect(ingestionWindowClosesAt(story([]))).toBeUndefined();
    expect(ingestionIsOpen(story([]), NOW)).toBe(false);
    expect(joinsIngestionWindow(story([]), NOW.toISOString())).toBe(false);
    expect(ingestionIsOpen(story([article('not-a-date')]), NOW)).toBe(false);
    expect(
      joinsIngestionWindow(story([article('not-a-date')]), NOW.toISOString()),
    ).toBe(false);
  });

  it('an Article published the next morning joins an evening Story (the Trump/Zelensky shape)', () => {
    // Founded 2026-10-18 00:01 Paris (= 22:01 UTC Oct 17, the reference
    // Stories of issue #116): an Article published 2026-10-18 10:00 Paris
    // (08:00 UTC) — after midnight, well inside the window — joins.
    const s = story([article('2026-10-17T22:01:00Z', 'a0')]);
    expect(joinsIngestionWindow(s, '2026-10-18T08:00:00Z')).toBe(true);
  });

  it('an Article published exactly at the window close still joins; one second later does not', () => {
    const s = story([article('2026-10-06T22:00:00Z', 'a0')]);
    expect(joinsIngestionWindow(s, '2026-10-07T22:00:00Z')).toBe(true);
    expect(joinsIngestionWindow(s, '2026-10-07T22:00:01Z')).toBe(false);
  });

  it('an Article inside the silence extension joins up to newest + 12h, not a second later', () => {
    const s = story([
      article('2026-10-06T22:00:00Z', 'a0'),
      article('2026-10-07T20:00:00Z', 'a2'),
    ]);
    expect(joinsIngestionWindow(s, '2026-10-08T08:00:00Z')).toBe(true);
    expect(joinsIngestionWindow(s, '2026-10-08T08:00:01Z')).toBe(false);
  });

  it('an Article published before the founding never joins (strict, no pre-founding Articles) — even mid-extension', () => {
    const s = story([
      article('2026-10-06T22:00:00Z', 'a0'),
      article('2026-10-07T20:00:00Z', 'a2'),
    ]);
    expect(joinsIngestionWindow(s, '2026-10-06T21:59:59Z')).toBe(false);
    expect(joinsIngestionWindow(s, '2026-10-06T22:00:00Z')).toBe(true);
  });

  it('an Article with an unparseable date never joins', () => {
    const s = story([article('2026-10-06T22:00:00Z', 'a0')]);
    expect(joinsIngestionWindow(s, 'not-a-date')).toBe(false);
  });

  it('DST fall-back weekend: instant arithmetic, not wall-clock (Europe, last Sunday of October 2026)', () => {
    // Founded Saturday 2026-10-24 23:00 Paris = 21:00 UTC (CEST). The
    // clocks fall back Sunday 03:00 Paris → 02:00. The window closes
    // Sunday 22:00 Paris = 21:00 UTC (CET) — exactly 24h of elapsed time,
    // although the wall clock spans 25 hours of civil time.
    const s = story([article('2026-10-24T21:00:00Z', 'a0')]);
    // Sunday 22:30 Paris = 21:30 UTC (CET): 24.5h after the founding in
    // real elapsed time — past the window, even though the wall clock says
    // only 23.5h of civil time since 23:00 Saturday.
    expect(joinsIngestionWindow(s, '2026-10-25T20:29:00Z')).toBe(true);
    expect(joinsIngestionWindow(s, '2026-10-25T21:31:00Z')).toBe(false);
    expect(ingestionIsOpen(s, new Date('2026-10-25T20:59:00Z'))).toBe(true);
    expect(ingestionIsOpen(s, new Date('2026-10-25T21:01:00Z'))).toBe(false);
  });

  it('DST fall-back in the silence term: newest + 12h of elapsed time, not wall-clock', () => {
    // Founded Saturday 21:00 UTC (CEST), newest Article Sunday 10:00 UTC
    // (CET, after the fall-back): the close is Sunday 22:00 UTC — 25h of
    // elapsed time from the founding, 12h of elapsed time from the newest,
    // whatever the civil clocks did overnight.
    const s = story([
      article('2026-10-24T21:00:00Z', 'a0'),
      article('2026-10-25T10:00:00Z', 'a2'),
    ]);
    expect(ingestionIsOpen(s, new Date('2026-10-25T21:59:00Z'))).toBe(true);
    expect(ingestionIsOpen(s, new Date('2026-10-25T22:01:00Z'))).toBe(false);
  });

  it('DST spring-forward weekend: instant arithmetic, not wall-clock (Europe, last Sunday of March 2026)', () => {
    // Founded Saturday 2026-03-28 23:00 Paris = 22:00 UTC (CET). The clocks
    // jump Sunday 02:00 Paris → 03:00. Sunday 21:30 Paris = 20:30 UTC
    // (CEST): 22.5h after the founding in real elapsed time — inside the
    // window, even though the wall clock says 23h30 was not yet reached.
    const s = story([article('2026-03-28T22:00:00Z', 'a0')]);
    expect(joinsIngestionWindow(s, '2026-03-29T20:30:00Z')).toBe(true);
    expect(joinsIngestionWindow(s, '2026-03-29T22:01:00Z')).toBe(false);
  });
});

describe('the ceiling (ADR-0033): a chain ingests at most 72 hours', () => {
  const F = '2026-10-06T22:00:00Z';

  it('never binds while the newest Article is at most founding + 60h — the silence term stays under it', () => {
    // Founded 22:00Z Oct 6, newest Article 00:00Z Oct 9 (founding + 50h):
    // newest + 12h = founding + 62h, still under the ceiling — ADR-0027's
    // silence rule governs the common case untouched.
    const s = story([article(F, 'a0'), article('2026-10-09T00:00:00Z', 'a2')]);
    expect(ingestionWindowClosesAt(s)).toBe(Date.parse('2026-10-09T12:00:00Z'));
  });

  it('binds once the newest Article lands past founding + 60h: the close is founding + 72h, not newest + 12h', () => {
    // The Trappes shape: coverage never pauses, newest Article at
    // founding + 65h — the silence term would say founding + 77h; the
    // ceiling caps the chain at founding + 72h.
    const s = story([article(F, 'a0'), article('2026-10-09T15:00:00Z', 'a2')]);
    expect(ingestionWindowClosesAt(s)).toBe(Date.parse('2026-10-09T22:00:00Z'));
  });

  it('boundary equality: a newest Article exactly at founding + 60h closes at founding + 72h (both terms agree)', () => {
    const s = story([article(F, 'a0'), article('2026-10-09T10:00:00Z', 'a2')]);
    expect(ingestionWindowClosesAt(s)).toBe(Date.parse('2026-10-09T22:00:00Z'));
  });

  it('is open at exactly founding + 72h despite continuous coverage, closed one second later', () => {
    const s = story([article(F, 'a0'), article('2026-10-09T15:00:00Z', 'a2')]);
    expect(ingestionIsOpen(s, new Date('2026-10-09T21:59:59Z'))).toBe(true);
    expect(ingestionIsOpen(s, new Date('2026-10-09T22:00:00Z'))).toBe(true);
    expect(ingestionIsOpen(s, new Date('2026-10-09T22:00:01Z'))).toBe(false);
  });

  it('an Article published exactly at the ceiling still joins; one second later births an Episode instead', () => {
    const s = story([article(F, 'a0'), article('2026-10-09T15:00:00Z', 'a2')]);
    expect(joinsIngestionWindow(s, '2026-10-09T22:00:00Z')).toBe(true);
    expect(joinsIngestionWindow(s, '2026-10-09T22:00:01Z')).toBe(false);
  });

  it('DST fall-back under the ceiling: 72h of elapsed time, not wall-clock', () => {
    // Founded Saturday 2026-10-24 21:00 UTC (CEST); the clocks fall back
    // Sunday Oct 25. The ceiling closes Tuesday 21:00 UTC — exactly 72h of
    // elapsed time, 73h of civil time across the transition. The newest
    // Article at founding + 65h would have kept the silence rule open five
    // more hours; the ceiling ends the chain.
    const s = story([
      article('2026-10-24T21:00:00Z', 'a0'),
      article('2026-10-27T14:00:00Z', 'a2'),
    ]);
    expect(joinsIngestionWindow(s, '2026-10-27T21:00:00Z')).toBe(true);
    expect(joinsIngestionWindow(s, '2026-10-27T21:00:01Z')).toBe(false);
    expect(ingestionIsOpen(s, new Date('2026-10-27T20:59:00Z'))).toBe(true);
    expect(ingestionIsOpen(s, new Date('2026-10-27T21:01:00Z'))).toBe(false);
  });

  it('isLive drops a continuously covered Story at the ceiling (the Episode handoff, ADR-0030)', () => {
    // Founded 4 days ago, newest Article 7h ago — the mega-Story shape the
    // ceiling exists for: still live under the pure silence rule (newest
    // + 12h is in the future), frozen under the ceiling, so the birth
    // guard no longer absorbs same-event births and the Episode mechanism
    // takes over.
    const founding = new Date(NOW.getTime() - 96 * 3_600_000);
    const newest = new Date(NOW.getTime() - 7 * 3_600_000);
    const s = story([
      article(founding.toISOString(), 'a0'),
      article(newest.toISOString(), 'a2'),
    ]);
    expect(isLive(s, NOW)).toBe(false);
  });
});

describe('isLive', () => {
  it('is true for a Story founded just inside the window', () => {
    const fresh = new Date(NOW.getTime() - COLLECTION_WINDOW_MS + 1000);
    expect(isLive(story([article(fresh.toISOString())]), NOW)).toBe(true);
  });

  it('is false for a Story silent past its full day (the floor exit)', () => {
    // One Article, published at the founding, silence ever since: the
    // window closes at founding + 24h — the sharp exit of the floor term.
    const stale = new Date(NOW.getTime() - COLLECTION_WINDOW_MS - 1000);
    expect(isLive(story([article(stale.toISOString())]), NOW)).toBe(false);
  });

  it('is true more than 24h past the founding while the newest Article is less than 12h old (ADR-0027)', () => {
    // Founded 30h ago, newest Article 2h ago: the ADR-0026 rule froze this
    // Story (the close at founding + 24h passed 6h ago); the silence rule
    // keeps it open until newest + 12h. This reversal is the feature.
    const founding = new Date(NOW.getTime() - 30 * 3_600_000);
    const newest = new Date(NOW.getTime() - 2 * 3_600_000);
    expect(
      isLive(
        story([
          article(founding.toISOString(), 'a0'),
          article(newest.toISOString(), 'a2'),
        ]),
        NOW,
      ),
    ).toBe(true);
  });

  it('is live at exactly newest + 12h past a 24h-old founding (the silence boundary)', () => {
    const founding = new Date(NOW.getTime() - 30 * 3_600_000);
    const newest = new Date(NOW.getTime() - 12 * 3_600_000);
    expect(
      isLive(
        story([
          article(founding.toISOString(), 'a0'),
          article(newest.toISOString(), 'a2'),
        ]),
        NOW,
      ),
    ).toBe(true);
  });

  it('is false once the silence outlasts the extension', () => {
    // Founded 40h ago, newest Article 36h ago: the close is max(founding +
    // 24h, newest + 12h) = founding + 24h, 16h ago — frozen.
    const founding = new Date(NOW.getTime() - 40 * 3_600_000);
    const newest = new Date(NOW.getTime() - 36 * 3_600_000);
    expect(
      isLive(
        story([
          article(founding.toISOString(), 'a0'),
          article(newest.toISOString(), 'a2'),
        ]),
        NOW,
      ),
    ).toBe(false);
  });

  it('is true for a Story with several Articles all inside the window', () => {
    const early = new Date(NOW.getTime() - COLLECTION_WINDOW_MS + 60_000);
    const late = new Date(NOW.getTime() - 60_000);
    expect(
      isLive(
        story([
          article(early.toISOString()),
          article(late.toISOString(), 'a2'),
        ]),
        NOW,
      ),
    ).toBe(true);
  });

  it('is false for an empty Story', () => {
    expect(isLive(story([]), NOW)).toBe(false);
  });

  it('is false for an unparseable date', () => {
    expect(isLive(story([article('not-a-date')]), NOW)).toBe(false);
  });

  it('is false for a Story founded in the future (defensive; clock skew)', () => {
    const ahead = new Date(NOW.getTime() + 60_000);
    expect(isLive(story([article(ahead.toISOString())]), NOW)).toBe(false);
  });
});
