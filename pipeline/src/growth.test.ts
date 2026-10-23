import { describe, expect, it } from 'vitest';
import { grewAtLeast } from './growth.ts';

/**
 * The shared growth gate (ADR-0027): the one arithmetic behind both the
 * Summaries gate (summarize.ts) and the retitle gate (grouping.ts).
 */
describe('grewAtLeast', () => {
  it('passes a Story the pass has never seen (births always pass)', () => {
    expect(grewAtLeast(undefined, 2)).toBe(true);
  });

  it('fires at exactly 25% growth (the gate is « at least »)', () => {
    expect(grewAtLeast(8, 10)).toBe(true);
    expect(grewAtLeast(100, 125)).toBe(true);
  });

  it('does not fire below 25% growth', () => {
    expect(grewAtLeast(1000, 1249)).toBe(false); // 24.9 %
    expect(grewAtLeast(9, 10)).toBe(false); // ≈ 11 %
    expect(grewAtLeast(10, 10)).toBe(false); // no growth
  });
});
