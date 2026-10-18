import {
  type CoverageGroup,
  coverageGroup,
  coverageOrder,
  reportingArticleCounts,
  reportingOutletIds,
  VOLUME_WEIGHT_EXPONENT,
} from './coverage.ts';
import type { Article, Outlet, Reach } from './index.ts';

/**
 * The Exposure rules (issue #88, spec #86; volume weighting — ADR-0026):
 * a second reading of the same coverage bar, Reach- and volume-weighted.
 * Each distinct reporting Outlet weighs the square root of its Reach times
 * the square root of its number of reporting Articles; a Coverage group's
 * Exposition is its weight sum over the Story's total. Volume reads both
 * influence — an Outlet that commits editorial resources to a Story
 * signals its importance — and reader exposure: an Outlet's readers see
 * the Story as many times as the Outlet writes about it. The sqrt
 * compressions bound the gap one mega-Outlet with a mega-feed can open.
 * Outlets missing from the config are ignored, as in `coverageCounts`:
 * no Reach, no weight.
 *
 * A Story with no reporting Outlet gets all-zero shares: upstream, that
 * reuses the existing "not covered" bar state — no special branch here.
 * Every figure is monthly web visits — ACPM-certified where the Outlet is
 * certified, otherwise a flagged estimate; the sqrt compressions bound the
 * gap a single off figure can introduce. Candidates for the final exponents
 * (brut / sqrt / log, Reach and volume) will be graded against real Stories
 * via `pnpm backtest:exposure` and recorded in the ADR — the constants are
 * the single place to change.
 */

/**
 * The compression exponent applied to Reach before summing (spec #86,
 * user story 15): 0.5 is the sqrt first cut — a named constant so the
 * method can be compared and changed in one place.
 */
export const EXPOSURE_COMPRESSION_EXPONENT = 0.5;

/** The minimal shape exposureShares reads off an Outlet: Leaning + Reach. */
export type ExposureOutlet = Pick<Outlet, 'leaning'> & {
  reach: Reach;
};

/**
 * Shares of Exposition per Coverage group, in [0, 1] and summing to 1 —
 * or all zeros when no reporting Outlet carries a Reach.
 */
export function exposureShares(
  articles: Article[],
  outletById: Map<string, ExposureOutlet>,
): Record<CoverageGroup, number> {
  const articleCounts = reportingArticleCounts(articles);
  const sums: Record<CoverageGroup, number> = {
    gauche: 0,
    centre: 0,
    droite: 0,
  };
  let total = 0;
  for (const id of reportingOutletIds(articles)) {
    const outlet = outletById.get(id);
    if (!outlet) continue;
    const weight =
      outlet.reach.value ** EXPOSURE_COMPRESSION_EXPONENT *
      (articleCounts.get(id) ?? 0) ** VOLUME_WEIGHT_EXPONENT;
    sums[coverageGroup(outlet.leaning)] += weight;
    total += weight;
  }
  if (total === 0) return sums;
  for (const group of coverageOrder) {
    sums[group] /= total;
  }
  return sums;
}
