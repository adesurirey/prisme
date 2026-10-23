import { describe, expect, it } from 'vitest';
import {
  type ActivityWindow,
  dayActivityWindow,
  weekActivityWindow,
} from './story-activity';

/**
 * The Story activity graph (chronologie de couverture): window and binning
 * rules. All windows are rolling, anchored at the edition's build time;
 * hour bins align to clock hours, day bins to Paris midnights — never the
 * build host's timezone (same rule as paris-date.ts).
 */

describe('dayActivityWindow', () => {
  it('is the rolling last 24 hours in 24 hourly bins, the last one partial', () => {
    // 14:23:45 UTC = 16:23:45 Paris (CEST). The last bin holds the
    // partial 14:00–14:23 hour; the axis starts at yesterday 15:00 UTC.
    const built = new Date('2026-10-23T14:23:45Z');
    const window: ActivityWindow = dayActivityWindow(built);
    expect(window.binMs).toBe(3_600_000);
    expect(window.label).toBe('24 h');
    expect(window.end).toBe(built.getTime());
    expect(window.start).toBe(Date.parse('2026-10-22T15:00:00Z'));
    // Exactly 24 bins, on the hour.
    expect((window.end - window.start) / window.binMs).toBeCloseTo(23.396, 3);
  });

  it('bins align to the clock hour, not the build second', () => {
    const built = new Date('2026-10-23T14:00:00Z');
    const window = dayActivityWindow(built);
    expect(window.start).toBe(Date.parse('2026-10-22T14:00:00Z'));
  });
});

describe('weekActivityWindow', () => {
  it('is the rolling last 7 days in 7 day bins aligned to Paris midnights', () => {
    const built = new Date('2026-10-23T14:23:45Z');
    const window: ActivityWindow = weekActivityWindow(built);
    expect(window.binMs).toBe(86_400_000);
    expect(window.label).toBe('7 jours');
    expect(window.end).toBe(built.getTime());
    // Paris midnight of the build day (CEST, UTC+2) is 22:00 UTC the day
    // before; six days earlier is the first bin's start.
    expect(window.start).toBe(Date.parse('2026-10-16T22:00:00Z'));
  });

  it('survives the October DST switch: every bin starts at a Paris midnight', () => {
    // Built after the switch (CET, UTC+1): the week reaches back over the
    // 25 octobre change, so bin starts are 23h and 24h apart — each one a
    // Paris midnight, never a fixed 24h stride.
    const built = new Date('2026-10-26T10:00:00Z');
    const window = weekActivityWindow(built);
    expect(window.start).toBe(Date.parse('2026-10-19T22:00:00Z'));
    expect(window.end).toBe(built.getTime());
    // Last bin: Paris midnight of the build day (CET, UTC+1).
    expect(window.end - Date.parse('2026-10-25T23:00:00Z')).toBeLessThan(
      86_400_000,
    );
  });

  it('survives the March DST switch the other way', () => {
    // 2026: Paris goes to CEST on 29 mars. Built 30 mars, the week reaches
    // back over the switch.
    const built = new Date('2026-03-30T10:00:00Z');
    const window = weekActivityWindow(built);
    // Paris midnight of 30 mars (CEST, UTC+2) is 22:00 UTC on the 29th.
    expect(window.end - Date.parse('2026-03-29T22:00:00Z')).toBeLessThan(
      86_400_000,
    );
    // Paris midnight of 24 mars (CET, UTC+1) is 23:00 UTC on the 23rd.
    expect(window.start).toBe(Date.parse('2026-03-23T23:00:00Z'));
  });
});

// ---------------------------------------------------------------------------
// Binning, life window, labels.

import type { Article, Outlet } from '@prisme/domain';
import {
  activityAriaLabel,
  activitySpanLabel,
  binTitle,
  hasActivity,
  lifeActivityWindow,
  MIN_ACTIVITY_ARTICLES,
  storyActivity,
} from './story-activity';

let nextId = 0;
const article = (outletId: string, publishedAt: string): Article =>
  ({
    id: `a${nextId++}`,
    outletId,
    headline: 'x',
    url: 'https://example.com',
    publishedAt,
    frontPage: false,
  }) as unknown as Article;

const outlet = (id: string, leaning: Outlet['leaning']): Outlet =>
  ({
    id,
    name: id,
    leaning,
    paywall: 'none',
    site: '',
    feeds: {},
    reach: { value: 1, unit: 'visits', source: 'ACPM', asOf: '2026-08' },
  }) as Outlet;

const BY_ID = new Map(
  ['gauche', 'centre', 'droite', 'centre-gauche'].map((l) => [
    `out-${l}`,
    outlet(`out-${l}`, l as Outlet['leaning']),
  ]),
);

describe('storyActivity', () => {
  it('bins Articles per hour and per Coverage group, excluding out-of-window ones', () => {
    const window: ActivityWindow = {
      start: Date.parse('2026-10-22T15:00:00Z'),
      end: Date.parse('2026-10-23T14:23:45Z'),
      binMs: 3_600_000,
    };
    const articles = [
      // In-window: 16h45 UTC = bin 16:00.
      article('out-gauche', '2026-10-22T16:45:00Z'),
      article('out-centre', '2026-10-22T16:50:00Z'),
      article('out-droite', '2026-10-22T16:55:00Z'),
      // centre-gauche folds into gauche (coverageGroup).
      article('out-centre-gauche', '2026-10-22T16:58:00Z'),
      // Same hour, another droite Article — totals count Articles, not Outlets.
      article('out-droite', '2026-10-22T16:59:00Z'),
      // Before the window: excluded, never clamped into the first bin.
      article('out-gauche', '2026-10-22T14:59:00Z'),
      // After the window: excluded.
      article('out-droite', '2026-10-23T14:24:00Z'),
    ];
    const bins = storyActivity(articles, BY_ID, window);
    expect(bins).toHaveLength(24);
    const bin16 = bins.find(
      (b) => b.start === Date.parse('2026-10-22T16:00:00Z'),
    )!;
    expect(bin16.total).toBe(5);
    expect(bin16.counts).toEqual({ gauche: 2, centre: 1, droite: 2 });
    const empty = bins.find(
      (b) => b.start === Date.parse('2026-10-22T17:00:00Z'),
    )!;
    expect(empty.total).toBe(0);
    expect(empty.counts).toEqual({ gauche: 0, centre: 0, droite: 0 });
    // Nothing before the first bin, nothing after the window end.
    expect(bins[0]!.start).toBe(window.start);
    expect(bins.at(-1)!.end).toBeLessThanOrEqual(window.end + 3_600_000);
  });
});

describe('lifeActivityWindow', () => {
  it('bins a short life hourly, aligned to the clock hour of each end', () => {
    const articles = [
      article('out-gauche', '2026-10-22T09:50:00Z'),
      article('out-droite', '2026-10-23T08:10:00Z'),
    ];
    const window = lifeActivityWindow(articles)!;
    expect(window.binMs).toBe(3_600_000);
    expect(window.start).toBe(Date.parse('2026-10-22T09:00:00Z'));
    expect(window.end).toBe(Date.parse('2026-10-23T09:00:00Z'));
  });

  it('bins a life beyond 48 hours per Paris day', () => {
    const articles = [
      article('out-gauche', '2026-10-12T10:00:00Z'),
      article('out-droite', '2026-10-19T18:00:00Z'),
    ];
    const window = lifeActivityWindow(articles)!;
    expect(window.binMs).toBe(86_400_000);
    expect(window.start).toBe(Date.parse('2026-10-11T22:00:00Z'));
    expect(window.end).toBe(Date.parse('2026-10-19T22:00:00Z'));
  });

  it('is null for a Story without Articles', () => {
    expect(lifeActivityWindow([])).toBeNull();
  });
});

describe('labels', () => {
  it('titles a bin with its Paris hour, count and per-group breakdown', () => {
    const bin: import('./story-activity').ActivityBin = {
      start: Date.parse('2026-10-22T14:00:00Z'),
      end: Date.parse('2026-10-22T15:00:00Z'),
      counts: { gauche: 3, centre: 2, droite: 1 },
      total: 6,
    };
    expect(binTitle(bin)).toBe(
      '16h · 6 articles · 3 gauche, 2 centre, 1 droite',
    );
  });

  it('titles an empty bin and a day bin', () => {
    expect(
      binTitle({
        start: Date.parse('2026-10-22T14:00:00Z'),
        end: Date.parse('2026-10-22T15:00:00Z'),
        counts: { gauche: 0, centre: 0, droite: 0 },
        total: 0,
      }),
    ).toBe('16h · aucun article');
    expect(
      binTitle({
        start: Date.parse('2026-10-21T22:00:00Z'),
        end: Date.parse('2026-10-22T22:00:00Z'),
        counts: { gauche: 1, centre: 0, droite: 0 },
        total: 1,
      }),
    ).toBe('22 oct. · 1 article · 1 gauche');
  });

  it('labels the sparkline with the window, count and peak', () => {
    const bins = [
      {
        start: Date.parse('2026-10-22T04:00:00Z'),
        end: Date.parse('2026-10-22T05:00:00Z'),
        counts: { gauche: 2, centre: 0, droite: 0 },
        total: 2,
      },
      {
        start: Date.parse('2026-10-22T05:00:00Z'),
        end: Date.parse('2026-10-22T06:00:00Z'),
        counts: { gauche: 0, centre: 0, droite: 5 },
        total: 5,
      },
      {
        start: Date.parse('2026-10-22T06:00:00Z'),
        end: Date.parse('2026-10-22T07:00:00Z'),
        counts: { gauche: 0, centre: 0, droite: 5 },
        total: 5,
      },
    ] as import('./story-activity').ActivityBin[];
    // Peak = first bin at the max (05:00Z and 06:00Z tie at 5): 05:00Z is
    // 7h Paris — the label names the reader's clock, not UTC.
    expect(activityAriaLabel(bins, '24 h')).toBe(
      '12 articles sur 24 h, pic à 7h',
    );
  });

  it('labels the singular and names day-scale peaks by date', () => {
    const bins = [
      {
        start: Date.parse('2026-10-20T22:00:00Z'),
        end: Date.parse('2026-10-21T22:00:00Z'),
        counts: { gauche: 0, centre: 0, droite: 1 },
        total: 1,
      },
      {
        start: Date.parse('2026-10-21T22:00:00Z'),
        end: Date.parse('2026-10-22T22:00:00Z'),
        counts: { gauche: 0, centre: 0, droite: 0 },
        total: 0,
      },
    ] as import('./story-activity').ActivityBin[];
    expect(activityAriaLabel(bins, '7 jours')).toBe(
      '1 article sur 7 jours, pic le 21 oct.',
    );
  });
});

describe('hasActivity / activitySpanLabel', () => {
  const bin = (total: number, start = 0, end = 3_600_000) =>
    ({
      start,
      end,
      counts: { gauche: total, centre: 0, droite: 0 },
      total,
    }) as import('./story-activity').ActivityBin;

  it('charts from four Articles on', () => {
    expect(MIN_ACTIVITY_ARTICLES).toBe(4);
    expect(hasActivity([bin(3), bin(0)])).toBe(false);
    expect(hasActivity([bin(3), bin(1)])).toBe(true);
  });

  it("names the bins' span for the chart's aria-label", () => {
    const hour = 3_600_000;
    // Hourly bins across a 14-hour life: 13 full bins plus the last one.
    const hourly = Array.from({ length: 14 }, (_, i) =>
      bin(1, i * hour, (i + 1) * hour),
    );
    expect(activitySpanLabel(hourly)).toBe('14 heures');
    const daily = [bin(1, 0, 86_400_000), bin(1, 86_400_000, 86_400_000 * 2)];
    expect(activitySpanLabel(daily)).toBe('2 jours');
  });
});
