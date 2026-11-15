/**
 * The three sorts of « À la une » (issue #180, ADR-0028/0041): the
 * artifact ships each pool precomputed — the app maps, never re-derives
 * (the Edition is a render contract, ADR-0043). Brûlant leads: it is
 * the default sort and the pager's first page (ADR-0039, restated for
 * the app in the #180 grilling). Chronology-first order: Nouveau (pure
 * chronology), Brûlant (chronology weighted by Coverage on two decay
 * clocks), Top (pure Coverage).
 */

import type { Edition, Story } from '@prisme/domain';

export interface Sort {
  key: 'brulant' | 'nouveau' | 'top';
  label: string;
}

/** The shipped sorts, Brûlant-first. */
export const SORTS: readonly Sort[] = [
  { key: 'brulant', label: 'Brûlant' },
  { key: 'nouveau', label: 'Nouveau' },
  { key: 'top', label: 'Top' },
] as const;

/** The default sort — Brûlant, the home reading (ADR-0039). */
export const DEFAULT_SORT_INDEX = 0;

/** One ordered list per sort, straight from the artifact's pools. */
export function sortLists(edition: Edition): Record<Sort['key'], Story[]> {
  return {
    brulant: edition.feedStories,
    nouveau: edition.latestStories,
    top: edition.stories,
  };
}
