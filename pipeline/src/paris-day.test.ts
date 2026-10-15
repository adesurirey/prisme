import { describe, expect, it } from 'vitest';
import {
  ingestionIsOpen,
  ingestionWindowClosesAt,
  parisDayKey,
} from './paris-day.ts';

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

describe('ingestionWindowClosesAt', () => {
  it('closes at 06:00 Europe/Paris the day after the Story day', () => {
    // Oct is CEST (UTC+2): 06:00 Paris = 04:00 UTC.
    expect(ingestionWindowClosesAt('2026-10-06')).toBe(
      '2026-10-07T04:00:00.000Z',
    );
  });

  it('handles winter time (CET, UTC+1)', () => {
    expect(ingestionWindowClosesAt('2026-01-15')).toBe(
      '2026-01-16T05:00:00.000Z',
    );
  });

  it('handles the DST transition day (clocks changed at 02:00/03:00, before 06:00)', () => {
    // Last Sunday of March 2026 is the 29th: that day is already CEST at noon.
    expect(ingestionWindowClosesAt('2026-03-28')).toBe(
      '2026-03-29T04:00:00.000Z',
    );
  });
});

describe('ingestionIsOpen', () => {
  it('a Story of day D is open at 00:10 Paris the day after (23:50 Article joins it)', () => {
    // 2026-10-06T22:10Z = 2026-10-07 00:10 Paris.
    expect(
      ingestionIsOpen('2026-10-06', new Date('2026-10-06T22:10:00Z')),
    ).toBe(true);
  });

  it('is closed at 06:00 Paris the day after (boundary, strict)', () => {
    expect(
      ingestionIsOpen('2026-10-06', new Date('2026-10-07T04:00:00Z')),
    ).toBe(false);
  });

  it('is still open one minute before the boundary', () => {
    expect(
      ingestionIsOpen('2026-10-06', new Date('2026-10-07T03:59:00Z')),
    ).toBe(true);
  });

  it('a Story of two days ago is closed: a late-collected old Article stays Unassigned', () => {
    expect(
      ingestionIsOpen('2026-10-04', new Date('2026-10-06T22:10:00Z')),
    ).toBe(false);
  });
});
