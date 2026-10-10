import type { Story } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import { slugsToDelete } from './cleanup.ts';

const NOW = new Date('2026-10-06T11:00:00Z');

/**
 * The end-of-run cleanup (issue #75): a Story file is deleted iff the Story
 * is frozen (no Article in the 24h window) and never entered the Edition.
 * Live Stories — in or below the Edition cut — are never deleted.
 */

function story(id: string, slug: string, hoursAgo = 1): Story {
  return {
    id,
    slug,
    title: 'Sujet',
    createdAt: '2026-10-06T10:00:00Z',
    articles: [
      {
        id,
        outletId: 'lemonde',
        headline: `Titre ${id}`,
        url: `https://lemonde.fr/a/${id}`,
        publishedAt: new Date(
          NOW.getTime() - hoursAgo * 60 * 60 * 1000,
        ).toISOString(),
        frontPage: false,
      },
    ],
  };
}

describe('slugsToDelete', () => {
  it('deletes a frozen Story that never entered the Edition', () => {
    const s = story('s1', 's1', 30);
    expect(slugsToDelete([s], NOW)).toEqual(new Set(['s1']));
  });

  it('keeps a frozen Story that once entered the Edition', () => {
    const s = story('s1', 's1', 30);
    s.everInEdition = true;
    expect(slugsToDelete([s], NOW).size).toBe(0);
  });

  it('keeps a live Story below the Edition cut', () => {
    const s = story('s1', 's1', 1);
    expect(slugsToDelete([s], NOW).size).toBe(0);
  });

  it('keeps a live unflagged Story', () => {
    const s = story('s1', 's1', 23.9);
    expect(slugsToDelete([s], NOW).size).toBe(0);
  });

  it('is deterministic over the same state', () => {
    const stories = [story('s1', 's1', 30), story('s2', 's2', 30)];
    stories[1].everInEdition = true;
    expect(slugsToDelete(stories, NOW)).toEqual(new Set(['s1']));
    expect(slugsToDelete(stories, NOW)).toEqual(new Set(['s1']));
  });
});
