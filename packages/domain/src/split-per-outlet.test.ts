import { describe, expect, it } from 'vitest';
import type { Article } from './index.ts';
import { splitPerOutlet } from './split-per-outlet.ts';

/** Minimal Articles: id, outletId, publishedAt is all the split looks at. */
function article(id: string, outletId: string, publishedAt: string): Article {
  return {
    id,
    outletId,
    headline: `Titre ${id}`,
    url: `https://example.com/${id}`,
    publishedAt,
    frontPage: false,
  };
}

describe('splitPerOutlet', () => {
  it("puts each Outlet's freshest Article in the head, newest first, and the rest in follow-ups, newest first", () => {
    const articles = [
      article('a1', 'libe', '2026-10-07T14:00:00Z'),
      article('a2', 'libe', '2026-10-07T09:00:00Z'),
      article('a3', 'figaro', '2026-10-07T15:00:00Z'),
      article('a4', 'figaro', '2026-10-07T08:00:00Z'),
      article('a5', 'figaro', '2026-10-07T07:00:00Z'),
      article('a6', 'humanite', '2026-10-07T10:00:00Z'),
    ];
    const { head, followUps } = splitPerOutlet(articles);
    expect(head.map((a) => a.id)).toEqual(['a3', 'a1', 'a6']);
    expect(followUps.map((a) => a.id)).toEqual(['a2', 'a4', 'a5']);
  });

  it('leaves an Outlet with a single Article entirely in the head, no follow-ups', () => {
    const articles = [article('a1', 'libe', '2026-10-07T14:00:00Z')];
    const { head, followUps } = splitPerOutlet(articles);
    expect(head.map((a) => a.id)).toEqual(['a1']);
    expect(followUps).toEqual([]);
  });

  it("breaks same-time ties by id, like newestFirst, when picking an Outlet's freshest", () => {
    const articles = [
      article('b', 'libe', '2026-10-07T14:00:00Z'),
      article('a', 'libe', '2026-10-07T14:00:00Z'),
    ];
    const { head, followUps } = splitPerOutlet(articles);
    expect(head.map((a) => a.id)).toEqual(['a']);
    expect(followUps.map((a) => a.id)).toEqual(['b']);
  });

  it('handles no Articles: empty head, empty follow-ups', () => {
    expect(splitPerOutlet([])).toEqual({ head: [], followUps: [] });
  });
});
