// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ActivityBin } from '../story-activity';
import ActivitySparkline from './ActivitySparkline';

/**
 * The card's tiny sparkline: monochrome (currentColor), no leaning split —
 * just the Story's Article flow across the edition's window. Empty bins are
 * faint hairline stubs so the 24-slot rhythm stays readable; the aria line
 * carries the numbers the eye gets (« 8 articles sur 24 h, pic à 18h »).
 */

const HOUR = 3_600_000;

const bin = (startHour: number, total: number): ActivityBin => ({
  start: Date.parse('2026-10-22T00:00:00Z') + startHour * HOUR,
  end: Date.parse('2026-10-22T00:00:00Z') + (startHour + 1) * HOUR,
  counts: { gauche: total, centre: 0, droite: 0 },
  total,
});

const bins: ActivityBin[] = [bin(0, 0), bin(1, 2), bin(2, 5), bin(3, 1)];

describe('ActivitySparkline', () => {
  it('labels the line with count, window and peak', () => {
    const { container } = render(
      <ActivitySparkline bins={bins} windowLabel="24 h" />,
    );
    const svg = container.querySelector('svg[role="img"]')!;
    // Peak: the 5 bin starts at 02:00 UTC = 4h Paris.
    expect(svg.getAttribute('aria-label')).toBe(
      '8 articles sur 24 h, pic à 4h',
    );
  });

  it('draws one bar per active bin and one faint stub per empty bin', () => {
    const { container } = render(
      <ActivitySparkline bins={bins} windowLabel="24 h" />,
    );
    const rects = [...container.querySelectorAll('rect')];
    expect(rects).toHaveLength(4);
    const bars = rects.filter((r) => r.getAttribute('opacity') == null);
    const stubs = rects.filter((r) => r.getAttribute('opacity') != null);
    expect(bars).toHaveLength(3);
    expect(stubs).toHaveLength(1);
    expect(bars.every((r) => r.getAttribute('fill') === 'currentColor')).toBe(
      true,
    );
  });

  it('scales bar heights to the busiest bin', () => {
    const { container } = render(
      <ActivitySparkline bins={bins} windowLabel="24 h" />,
    );
    const bars = [...container.querySelectorAll('rect')].filter(
      (r) => r.getAttribute('opacity') == null,
    );
    const heights = bars.map((r) => Number(r.getAttribute('height')));
    // Bin totals 2, 5, 1 → the 5 bin is exactly full height (18).
    expect(Math.max(...heights)).toBe(18);
    expect(heights).toContain((2 / 5) * 18);
    expect(heights).toContain((1 / 5) * 18);
  });
});
