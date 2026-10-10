import type { Story } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import { updateEditionHistory } from './edition-history.ts';

const NOW = new Date('2026-10-06T11:00:00Z');

/**
 * The Edition history (issue #75): `everInEdition` is a sticky Story-level
 * flag — true the moment the Story ranks into the Edition, never unset while
 * the Story lives. Frozen Stories are passed through untouched (ADR-0005).
 */

function story(id: string, slug = id, hoursAgo = 1): Story {
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

describe('updateEditionHistory', () => {
  it('sets the flag on Edition members', () => {
    const s = story('s1');
    const result = updateEditionHistory([s], new Set(['s1']), NOW);
    expect(result.stories[0].everInEdition).toBe(true);
    expect(result.changed).toEqual(new Set(['s1']));
  });

  it('keeps the flag on members not in this Edition', () => {
    const s = story('s1');
    s.everInEdition = true;
    const result = updateEditionHistory([s], new Set(), NOW);
    expect(result.stories[0].everInEdition).toBe(true);
    expect(result.changed.size).toBe(0);
  });

  it('leaves unflagged non-members untouched (absent flag equals false)', () => {
    const s = story('s1');
    const result = updateEditionHistory([s], new Set(), NOW);
    expect(result.stories[0].everInEdition).toBeUndefined();
    expect(result.changed.size).toBe(0);
  });

  it('never touches a frozen Story', () => {
    const s = story('s1', 's1', 30);
    const result = updateEditionHistory([s], new Set(['s1']), NOW);
    expect(result.stories[0].everInEdition).toBeUndefined();
    expect(result.changed.size).toBe(0);
  });

  it('does not mutate the input Stories', () => {
    const s = story('s1');
    const original = structuredClone(s);
    updateEditionHistory([s], new Set(['s1']), NOW);
    expect(s).toEqual(original);
  });
});
