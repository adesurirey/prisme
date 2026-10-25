// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ActivityBin } from '../story-activity';
import ActivityChart from './ActivityChart';

/**
 * The Story page's coverage chronology: a stacked SVG histogram of
 * Articles per hour (or Paris day), segments bottom-to-top in fixed group
 * order, one hover title per bin, sparse Paris-time ticks — all prerendered,
 * zero client JS.
 */

const HOUR = 3_600_000;

const bin = (
  isoStart: string,
  total: number,
  counts: ActivityBin['counts'] = { gauche: 0, centre: 0, droite: 0 },
): ActivityBin => ({
  start: Date.parse(isoStart),
  end: Date.parse(isoStart) + HOUR,
  counts,
  total,
});

const bins: ActivityBin[] = [
  bin('2026-10-22T15:00:00Z', 0),
  bin('2026-10-22T16:00:00Z', 5, { gauche: 3, centre: 2, droite: 1 }),
  bin('2026-10-22T17:00:00Z', 0),
  bin('2026-10-22T18:00:00Z', 2, { gauche: 0, centre: 0, droite: 2 }),
];

describe('ActivityChart', () => {
  it('labels the chart with count, span and peak, and one hover title per bin', () => {
    const { container } = render(<ActivityChart bins={bins} />);
    const svg = container.querySelector('svg[role="img"]')!;
    expect(svg.getAttribute('aria-label')).toBe(
      'Chronologie des publications : 7 articles sur 4 heures, pic à 18h',
    );
    const titles = [...svg.querySelectorAll('title')].map((t) => t.textContent);
    expect(titles).toHaveLength(4);
    // 16:00 UTC = 18h Paris (CEST) — the reader's clock, not UTC.
    expect(titles[1]).toBe('18h · 5 articles · 3 gauche, 2 centre, 1 droite');
    expect(titles[0]).toBe('17h · aucun article');
  });

  it('paints one rect per nonzero group, bins then groups in fixed order', () => {
    const { container } = render(<ActivityChart bins={bins} />);
    const colored = [...container.querySelectorAll('rect')].filter((rect) =>
      (rect.getAttribute('fill') ?? '').startsWith('var(--'),
    );
    expect(colored.map((rect) => rect.getAttribute('fill'))).toEqual([
      'var(--gauche)',
      'var(--centre)',
      'var(--droite)',
      'var(--droite)',
    ]);
  });

  it('draws only the baseline — no mid gridline at ribbon height', () => {
    const { container } = render(<ActivityChart bins={bins} />);
    expect(container.querySelectorAll('line')).toHaveLength(1);
  });

  it('marks sparse ticks in Paris time, one per bin when few', () => {
    const { container } = render(<ActivityChart bins={bins} />);
    const ticks = [...container.querySelectorAll('[data-tick]')].map(
      (tick) => tick.textContent,
    );
    expect(ticks).toEqual(['17h', '18h', '19h', '20h']);
  });

  it('thins the ticks to about four on a day-scale axis', () => {
    const day = 86_400_000;
    const week: ActivityBin[] = Array.from({ length: 7 }, (_, i) => ({
      start: Date.UTC(2026, 9, 17 + i, 12),
      end: Date.UTC(2026, 9, 17 + i, 12) + day,
      counts: { gauche: 1, centre: 0, droite: 0 },
      total: 1,
    }));
    const { container } = render(<ActivityChart bins={week} />);
    const ticks = [...container.querySelectorAll('[data-tick]')].map(
      (tick) => tick.textContent,
    );
    expect(ticks.length).toBeLessThanOrEqual(4);
    expect(ticks[0]).toBe('17 oct.');
    expect(ticks.at(-1)).toBe('23 oct.');
  });
});
