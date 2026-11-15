import type { Edition } from '@prisme/domain';
import fixtureEdition from './data/__fixtures__/edition.json';

import { DEFAULT_SORT_INDEX, SORTS, sortLists } from './sorts';

/** The #179 fixture Edition — the same artifact shape the app fetches. */
function theEdition(): Edition {
  return fixtureEdition as unknown as Edition;
}

describe('the sorts of « À la une » (issue #195)', () => {
  test('Top | Brûlant | Tous — the #195 order', () => {
    expect(SORTS.map((sort) => sort.key)).toEqual([
      'top',
      'brulant',
      'nouveau',
    ]);
  });

  test('Brûlant stays the default — index 1 in the new order', () => {
    expect(SORTS[DEFAULT_SORT_INDEX].key).toBe('brulant');
  });

  test('each sort reads its own precomputed list from the artifact', () => {
    const lists = sortLists(theEdition());

    expect(lists.brulant).toBe(theEdition().feedStories);
    expect(lists.nouveau).toBe(theEdition().latestStories);
    expect(lists.top).toBe(theEdition().stories);
  });

  test('the labels are the reader-facing French names — Nouveau is « Tous »', () => {
    expect(SORTS.map((sort) => sort.label)).toEqual(['Top', 'Brûlant', 'Tous']);
  });
});
