/**
 * The three sorts of « À la une » (issue #195, ADR-0028/0041): the
 * artifact ships each pool precomputed — the app maps, never re-derives
 * (the Edition is a render contract, ADR-0043). Fixed order Top | Brûlant
 * | Nouveau; Brûlant stays the default (ADR-0039). Coverage-first
 * order: Top (pure Coverage), Brûlant (chronology weighted by Coverage
 * on two decay clocks), Nouveau (pure chronology — the documented
 * vocabulary: GLOSSARY, brand, web).
 */

import type { Edition, Story } from '@prisme/domain';

export interface Sort {
  key: 'brulant' | 'nouveau' | 'top';
  label: string;
}

/** The shipped sorts, Top | Brûlant | Nouveau. */
export const SORTS: readonly Sort[] = [
  { key: 'top', label: 'Top' },
  { key: 'brulant', label: 'Brûlant' },
  { key: 'nouveau', label: 'Nouveau' },
] as const;

/** The default sort — Brûlant, the home reading (ADR-0039); index 1. */
export const DEFAULT_SORT_INDEX = 1;

/** One ordered list per sort, straight from the artifact's pools. */
export function sortLists(edition: Edition): Record<Sort['key'], Story[]> {
  return {
    brulant: edition.feedStories,
    nouveau: edition.latestStories,
    top: edition.stories,
  };
}
