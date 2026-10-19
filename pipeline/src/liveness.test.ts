import type { Article, Story } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import {
  foundingInstant,
  ingestionIsOpen,
  ingestionWindowClosesAt,
  isLive,
  joinsIngestionWindow,
  LIVE_WINDOW_MS,
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

describe('LIVE_WINDOW_MS', () => {
  it('is exactly 24 hours', () => {
    expect(LIVE_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe('foundingInstant (ADR-0026)', () => {
  it('is the earliest publishedAt among the Story’s Articles', () => {
    expect(
      foundingInstant(
        story([
          article('2026-10-06T12:00:00Z', 'a2'),
          article('2026-10-06T10:00:00Z', 'a1'),
          article('2026-10-06T11:00:00Z', 'a3'),
        ]),
      ),
    ).toBe(Date.parse('2026-10-06T10:00:00Z'));
  });

  it('is derived on demand, never stored: no field carries it', () => {
    const s = story([article('2026-10-06T10:00:00Z')]);
    expect(Object.keys(s)).not.toContain('founding');
  });

  it('is undefined for an empty or all-undated Story', () => {
    expect(foundingInstant(story([]))).toBeUndefined();
    expect(foundingInstant(story([article('not-a-date')]))).toBeUndefined();
  });

  it('ignores an unparseable date among dated ones', () => {
    expect(
      foundingInstant(
        story([article('not-a-date', 'a0'), article('2026-10-06T10:00:00Z')]),
      ),
    ).toBe(Date.parse('2026-10-06T10:00:00Z'));
  });
});

describe('ingestion window (ADR-0026): [founding, founding + 24h]', () => {
  it('closes 24 hours after the founding instant, whatever the wall clock', () => {
    // 22:00 UTC Oct 6 + 24h = 22:00 UTC Oct 7 — no 06:00 Paris cut.
    expect(ingestionWindowClosesAt(Date.parse('2026-10-06T22:00:00Z'))).toBe(
      Date.parse('2026-10-07T22:00:00Z'),
    );
  });

  it('is open right at the founding instant', () => {
    expect(
      ingestionIsOpen(
        Date.parse('2026-10-06T22:00:00Z'),
        new Date('2026-10-06T22:00:00Z'),
      ),
    ).toBe(true);
  });

  it('is closed at the window close + ε (sharp exit)', () => {
    const founding = Date.parse('2026-10-06T21:59:59Z');
    expect(ingestionIsOpen(founding, new Date('2026-10-07T21:59:59Z'))).toBe(
      true,
    );
    expect(ingestionIsOpen(founding, new Date('2026-10-07T22:00:00Z'))).toBe(
      false,
    );
  });

  it('is closed before the founding instant', () => {
    expect(
      ingestionIsOpen(
        Date.parse('2026-10-06T22:00:00Z'),
        new Date('2026-10-06T21:59:59Z'),
      ),
    ).toBe(false);
  });

  it('an Article published the next morning joins an evening Story (the Trump/Zelensky shape)', () => {
    // Founded 2026-10-18 00:01 Paris (= 22:01 UTC Oct 17, the reference
    // Stories of issue #116): an Article published 2026-10-18 10:00 Paris
    // (08:00 UTC) — after midnight, well inside the window — joins.
    const founding = Date.parse('2026-10-17T22:01:00Z');
    expect(joinsIngestionWindow(founding, '2026-10-18T08:00:00Z')).toBe(true);
  });

  it('an Article published exactly at the window close still joins; one second later does not', () => {
    const founding = Date.parse('2026-10-06T22:00:00Z');
    expect(joinsIngestionWindow(founding, '2026-10-07T22:00:00Z')).toBe(true);
    expect(joinsIngestionWindow(founding, '2026-10-07T22:00:01Z')).toBe(false);
  });

  it('an Article published before the founding never joins (strict, no pre-founding Articles)', () => {
    const founding = Date.parse('2026-10-06T22:00:00Z');
    expect(joinsIngestionWindow(founding, '2026-10-06T21:59:59Z')).toBe(false);
  });

  it('DST fall-back weekend: instant arithmetic, not wall-clock (Europe, last Sunday of October 2026)', () => {
    // Founded Saturday 2026-10-24 23:00 Paris = 21:00 UTC (CEST). The
    // clocks fall back Sunday 03:00 Paris → 02:00. The window closes
    // Sunday 22:00 Paris = 21:00 UTC (CET) — exactly 24h of elapsed time,
    // although the wall clock spans 25 hours of civil time.
    const founding = Date.parse('2026-10-24T21:00:00Z');
    // Sunday 22:30 Paris = 21:30 UTC (CET): 24.5h after the founding in
    // real elapsed time — past the window, even though the wall clock says
    // only 23.5h of civil time since 23:00 Saturday.
    expect(joinsIngestionWindow(founding, '2026-10-25T20:29:00Z')).toBe(true);
    expect(joinsIngestionWindow(founding, '2026-10-25T21:31:00Z')).toBe(false);
    expect(ingestionIsOpen(founding, new Date('2026-10-25T20:59:00Z'))).toBe(
      true,
    );
    expect(ingestionIsOpen(founding, new Date('2026-10-25T21:01:00Z'))).toBe(
      false,
    );
  });

  it('DST spring-forward weekend: instant arithmetic, not wall-clock (Europe, last Sunday of March 2026)', () => {
    // Founded Saturday 2026-03-28 23:00 Paris = 22:00 UTC (CET). The clocks
    // jump Sunday 02:00 Paris → 03:00. Sunday 21:30 Paris = 20:30 UTC
    // (CEST): 22.5h after the founding in real elapsed time — inside the
    // window, even though the wall clock says 23h30 was not yet reached.
    const founding = Date.parse('2026-03-28T22:00:00Z');
    expect(joinsIngestionWindow(founding, '2026-03-29T20:30:00Z')).toBe(true);
    expect(joinsIngestionWindow(founding, '2026-03-29T22:01:00Z')).toBe(false);
  });
});

describe('isLive', () => {
  it('is true for a Story founded just inside the window', () => {
    const fresh = new Date(NOW.getTime() - LIVE_WINDOW_MS + 1000);
    expect(isLive(story([article(fresh.toISOString())]), NOW)).toBe(true);
  });

  it('is false for a Story founded just past the window (sharp 24h exit)', () => {
    const stale = new Date(NOW.getTime() - LIVE_WINDOW_MS - 1000);
    expect(isLive(story([article(stale.toISOString())]), NOW)).toBe(false);
  });

  it('is false for a Story with an Article inside its window but whose window has closed', () => {
    // Founded 24h + 1s ago, an Article published one minute before the
    // close (so one minute ago): the recency rule would call it live, the
    // window rule freezes it — the sharp exit at the close (ADR-0026).
    const founding = NOW.getTime() - LIVE_WINDOW_MS - 1000;
    const beforeClose = new Date(founding + LIVE_WINDOW_MS - 60_000);
    expect(
      isLive(
        story([
          article(new Date(founding).toISOString(), 'a0'),
          article(beforeClose.toISOString(), 'a2'),
        ]),
        NOW,
      ),
    ).toBe(false);
  });

  it('is true for a Story with several Articles all inside the window', () => {
    const early = new Date(NOW.getTime() - LIVE_WINDOW_MS + 60_000);
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
