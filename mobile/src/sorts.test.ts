import type { Edition } from '@prisme/domain';
import fixtureEdition from './data/__fixtures__/edition.json';

import { SORTS, sortLists } from './sorts';

/** The #179 fixture Edition — the same artifact shape the app fetches. */
function theEdition(): Edition {
  return fixtureEdition as unknown as Edition;
}

describe('the sorts of « À la une » (issue #180)', () => {
  test('Brûlant leads — the default sort is the pager’s first page', () => {
    expect(SORTS.map((sort) => sort.key)).toEqual([
      'brulant',
      'nouveau',
      'top',
    ]);
  });

  test('each sort reads its own precomputed list from the artifact', () => {
    const lists = sortLists(theEdition());

    expect(lists.brulant).toBe(theEdition().feedStories);
    expect(lists.nouveau).toBe(theEdition().latestStories);
    expect(lists.top).toBe(theEdition().stories);
  });

  test('the labels are the reader-facing French names', () => {
    expect(SORTS.map((sort) => sort.label)).toEqual([
      'Brûlant',
      'Nouveau',
      'Top',
    ]);
  });
});
