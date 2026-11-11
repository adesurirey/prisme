import type { ActivityBin } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import {
  activityAriaLabel,
  activitySpanLabel,
  binTitle,
} from './story-activity';

/**
 * The render-side labels of the Story's coverage chronology: reader-clock
 * stamps, hover titles and aria lines over the pipeline-embedded bins
 * (issue #186 — the binning math itself is tested in
 * pipeline/src/story-activity.test.ts). Paris hours and dates, never the
 * build host's timezone.
 */

describe('labels', () => {
  it('titles a bin with its Paris hour, count and per-group breakdown', () => {
    const bin: ActivityBin = {
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

  it('labels the chart with the window, count and peak', () => {
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
    ] as ActivityBin[];
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
    ] as ActivityBin[];
    expect(activityAriaLabel(bins, '7 jours')).toBe(
      '1 article sur 7 jours, pic le 21 oct.',
    );
  });
});

describe('activitySpanLabel', () => {
  const bin = (total: number, start = 0, end = 3_600_000) =>
    ({
      start,
      end,
      counts: { gauche: total, centre: 0, droite: 0 },
      total,
    }) as ActivityBin;

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
