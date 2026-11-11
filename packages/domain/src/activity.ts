import type { CoverageGroup } from './index.ts';

/** One bin of a Story's coverage chronology (ADR-0032): Articles per
 * Coverage group in `[start, end)`. Computed by the pipeline
 * (pipeline/src/story-activity.ts) and embedded on the Story — Story file
 * and edition.json entry alike (issue #186, ADR-0043) — so every surface
 * (the web page today, the app next) renders the chart from the artifact
 * and never re-derives the binning math.
 *
 * The binning and its labels (web/src/story-activity.ts) must agree on
 * what counts as a day bin, so the threshold lives here with the type:
 * day bins are 23–25 h wide (Paris DST), hour bins 1 h. */
export const DAY_SCALE_MS = 86_400_000 / 2;

export interface ActivityBin {
  /** Bin start, epoch ms (inclusive). */
  start: number;
  /** Bin end, epoch ms (exclusive). */
  end: number;
  /** Article counts per Coverage group; unknown Outlets count in `total` only. */
  counts: Record<CoverageGroup, number>;
  /** Every Article in the bin — the same basis as `countedArticles()`. */
  total: number;
}
