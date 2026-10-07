import { describe, expect, it } from 'vitest';
import { formatArticleDate } from './article-date';

describe('formatArticleDate', () => {
  it('renders day, short month and 24h time in Paris time, whatever the build machine runs on', () => {
    expect(formatArticleDate('2026-10-07T12:32:00Z')).toBe('7 oct., 14:32');
    expect(formatArticleDate('2026-01-05T09:05:00Z')).toBe('5 janv., 10:05');
  });

  it('crosses a Paris day boundary with the date, never silently', () => {
    expect(formatArticleDate('2026-10-07T23:30:00Z')).toBe('8 oct., 01:30');
  });

  it('tolerates an unparseable date by showing nothing', () => {
    expect(formatArticleDate('not a date')).toBe('');
  });
});
