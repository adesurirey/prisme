import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatArticleDate, formatStoryDate } from './article-date';

describe('formatArticleDate', () => {
  afterEach(() => vi.useRealTimers());

  it('renders the bare clock for an Article published today, Paris time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T12:00:00Z')); // 14:00 in Paris
    expect(formatArticleDate('2026-10-07T12:32:00Z')).toBe('14:32');
  });

  it('says "hier à" for an Article published the day before, Paris time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T09:00:00Z')); // 8 October in Paris
    expect(formatArticleDate('2026-10-07T21:11:00Z')).toBe('hier à 23:11');
  });

  it('renders day, short month and 24h time for anything older', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T12:00:00Z'));
    expect(formatArticleDate('2026-10-07T12:32:00Z')).toBe('7 oct., 14:32');
    expect(formatArticleDate('2026-01-05T09:05:00Z')).toBe('5 janv., 10:05');
  });

  it("compares Paris days, not the build host's days", () => {
    vi.useFakeTimers();
    // 2026-10-07 22:30 UTC is already 8 October in Paris; a UTC host would
    // still call it the 7th. "Yesterday" is a Paris day or it is nothing.
    vi.setSystemTime(new Date('2026-10-07T22:30:00Z')); // 8 oct. 00:30 in Paris
    // A UTC host would call "now" the 7th and label this today; Paris says
    // yesterday. "Yesterday" is a Paris day or it is nothing.
    expect(formatArticleDate('2026-10-07T14:00:00Z')).toBe('hier à 16:00');
  });

  it('crosses a Paris day boundary with the date, never silently', () => {
    expect(formatArticleDate('2026-10-07T23:30:00Z')).toBe('8 oct., 01:30');
  });

  it('tolerates an unparseable date by showing nothing', () => {
    expect(formatArticleDate('not a date')).toBe('');
  });
});

describe('formatStoryDate', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps the Article scales, with today as a bare clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T12:00:00Z')); // 14:00 in Paris
    expect(formatStoryDate({ publishedAt: '2026-10-07T12:32:00Z' })).toBe(
      '14:32',
    );
    expect(formatStoryDate({ publishedAt: '2026-10-06T21:11:00Z' })).toBe(
      'hier à 23:11',
    );
  });

  it('keeps the full date for an older Story, where it must stand out', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T12:00:00Z'));
    expect(formatStoryDate({ publishedAt: '2026-10-07T12:32:00Z' })).toBe(
      '7 oct., 14:32',
    );
  });

  it('never invents a clock time for an Undated Article (ADR-0007)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T12:00:00Z')); // 14:00 in Paris
    // publishedAt is the end of the Publication day, not a real clock time.
    expect(
      formatStoryDate({
        publishedAt: '2026-10-07T21:59:00Z',
        dayPrecision: true,
      }),
    ).toBe("aujourd'hui");
    expect(
      formatStoryDate({
        publishedAt: '2026-10-06T21:59:00Z',
        dayPrecision: true,
      }),
    ).toBe('hier');
    expect(
      formatStoryDate({
        publishedAt: '2026-10-01T21:59:00Z',
        dayPrecision: true,
      }),
    ).toBe('1 oct.');
  });

  it('tolerates an unparseable date by showing nothing', () => {
    expect(formatStoryDate({ publishedAt: 'not a date' })).toBe('');
  });
});
