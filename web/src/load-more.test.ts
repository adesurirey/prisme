import { describe, expect, it } from 'vitest';
import { LOAD_MORE_INITIAL, LOAD_MORE_STEP, visibleCount } from './load-more';

describe('visibleCount', () => {
  it('shows the initial batch with zero clicks', () => {
    expect(visibleCount(100, 0)).toBe(LOAD_MORE_INITIAL);
  });

  it('reveals one step per click', () => {
    expect(visibleCount(100, 1)).toBe(LOAD_MORE_INITIAL + LOAD_MORE_STEP);
    expect(visibleCount(100, 2)).toBe(75);
  });

  it('never exceeds the total (the button disappears at the end)', () => {
    expect(visibleCount(60, 1)).toBe(50);
    expect(visibleCount(60, 2)).toBe(60);
    expect(visibleCount(60, 9)).toBe(60);
  });

  it('shows a capped sort whole — no tail, no click', () => {
    expect(visibleCount(25, 0)).toBe(25);
    expect(visibleCount(25, 1)).toBe(25);
  });

  it('shows everything when the Edition is smaller than the batch', () => {
    expect(visibleCount(12, 0)).toBe(12);
  });

  it('is 0 for an empty Edition', () => {
    expect(visibleCount(0, 0)).toBe(0);
  });

  it('never goes negative on a malformed click count', () => {
    expect(visibleCount(100, -5)).toBe(0);
  });
});
