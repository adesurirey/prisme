import type { Edition, Story } from '@prisme/domain';
import fixtureEdition from './__fixtures__/edition.json';

import { findStory, storyWebUrl } from './story';

/** The #179 fixture Edition — the same artifact shape the app fetches. */
function theEdition(): Edition {
  return fixtureEdition as unknown as Edition;
}

/** A minimal Story — the fields findStory/storyWebUrl read, fully typed. */
function aStory(id: string, slug: string): Story {
  return {
    id,
    slug,
    title: 'Sujet',
    createdAt: '2026-11-12T05:00:00.000Z',
    storyDay: '2026-11-12',
    articles: [],
  };
}

describe('the story seam (issue #199)', () => {
  test('findStory resolves a Story by id', () => {
    expect(findStory('b0a1d2e3f4a5', theEdition())?.slug).toBe(
      'budget-2027-en-commission',
    );
  });

  test('findStory searches past the first list — a Story riding only a later ranking still resolves', () => {
    // The fixture's ids ride all three lists, so they first-hit in Top —
    // this one rides ONLY Nouveau: a search stopped at the first list
    // misses it (review P2, #199).
    const edition: Edition = {
      builtAt: '2026-11-12T06:00:00.000Z',
      stories: [],
      feedStories: [],
      latestStories: [aStory('nouveau-seul', 'seul-dans-nouveau')],
    };
    expect(findStory('nouveau-seul', edition)?.slug).toBe('seul-dans-nouveau');
  });

  test('findStory misses an id the Edition does not carry', () => {
    expect(findStory('inconnu', theEdition())).toBeNull();
  });

  test('storyWebUrl builds the story page URL — the share target', () => {
    const story = findStory('b0a1d2e3f4a5', theEdition());
    expect(story && storyWebUrl(story)).toBe(
      'https://leprisme.info/2026-11-10/budget-2027-en-commission/',
    );
  });
});
