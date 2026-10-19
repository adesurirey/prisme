import { describe, expect, it } from 'vitest';
import { parisDayKey } from './paris-day.ts';

describe('parisDayKey', () => {
  it('gives the Europe/Paris civil date of an instant', () => {
    // 22:10 UTC on Oct 6 is already 00:10 in Paris on Oct 7.
    expect(parisDayKey('2026-10-06T22:10:00Z')).toBe('2026-10-07');
    expect(parisDayKey('2026-10-06T21:50:00Z')).toBe('2026-10-06');
  });

  it('keys an Article dated at the start of its Paris day to that day', () => {
    expect(parisDayKey('2026-10-06T22:00:00Z')).toBe('2026-10-07'); // 00:00 Paris
  });
});
