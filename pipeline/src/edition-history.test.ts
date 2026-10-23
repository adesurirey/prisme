import type { Story } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import { slugsToDelete } from './cleanup.ts';
import { updateEditionHistory } from './edition-history.ts';

const NOW = new Date('2026-10-06T11:00:00Z');

/**
 * The Edition history (issue #75): `everInEdition` is a sticky Story-level
 * flag — true the moment a Story ranks into either Edition window, never
 * unset, so the flag survives the Story's freezing and the never-entered
 * deletion rule (cleanup.ts) keeps working. A frozen Story that ranks into
 * a window is stamped too (ADR-0027: windows span frozen Stories); a
 * frozen non-member is passed through untouched — its content is never
 * edited (ADR-0005).
 */

function story(id: string, slug = id, hoursAgo = 1): Story {
  return {
    id,
    slug,
    title: 'Sujet',
    createdAt: '2026-10-06T10:00:00Z',
    storyDay: '2026-10-06',
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

  it('never touches a frozen Story that is not a window member', () => {
    const s = story('s1', 's1', 30);
    const result = updateEditionHistory([s], new Set(), NOW);
    expect(result.stories[0].everInEdition).toBeUndefined();
    expect(result.changed.size).toBe(0);
  });

  it('stamps a frozen Story that ranks into a window, so cleanup keeps its file (spec #121 review)', () => {
    // A > 24h pipeline outage can birth-and-freeze a Story no build ever
    // saw live; its newest Article (3 days old) still ranks it into the
    // « 7 jours » window — the Story is linked on /7-jours/ this build.
    const s = story('s1', 's1', 72);
    const result = updateEditionHistory([s], new Set(['s1']), NOW);
    expect(result.stories[0].everInEdition).toBe(true);
    expect(result.changed).toEqual(new Set(['s1']));
    expect(slugsToDelete(result.stories, NOW).size).toBe(0);
  });

  it('leaves a frozen never-ranked Story outside both windows unstamped — cleanup still deletes it', () => {
    const s = story('s1', 's1', 8 * 24);
    const result = updateEditionHistory([s], new Set(), NOW);
    expect(result.stories[0].everInEdition).toBeUndefined();
    expect(slugsToDelete(result.stories, NOW)).toEqual(new Set(['s1']));
  });

  it('does not mutate the input Stories', () => {
    const s = story('s1');
    const original = structuredClone(s);
    updateEditionHistory([s], new Set(['s1']), NOW);
    expect(s).toEqual(original);
  });
});
