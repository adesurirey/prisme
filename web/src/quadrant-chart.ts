import { type Leaning, leaningOrder, type Outlet } from '@prisme/domain';
import { outletsByLeaning } from './leaning-chart';

/**
 * The classement page's quadrant variant: the five Leaning bands on the
 * x-axis (Gauche at the left), sourced Reach on the y-axis on a log
 * scale, bottom to top — every Outlet is a plate placed in its band
 * column at its reach height. Same contract as `leaning-chart.ts`: pure
 * placement logic, the `.astro` component is markup only.
 *
 * Leaning stays a band, never a score (ADR-0001); the y-axis is the only
 * continuous dimension, and it is log-scaled because the reach figures
 * span nearly three decades of monthly visits.
 *
 * Plates are big enough to carry a logo, so neighbours whose reach sits
 * within a fraction of a decade would overlap. Each column is therefore
 * dodged (map-label style): plates hang below the one above at a fixed
 * spacing until they clear, then the crowded run is lifted to stay
 * inside the plot — no overlap by construction, and isolated plates
 * keep their exact reach height.
 */

/** Plot and plate geometry, shared with the component so the dodge
 *  computes against the same pixels the CSS renders. */
export const PLOT_HEIGHT = 540;
export const PLATE_HEIGHT = 48;
/** Center-to-center distance the dodge guarantees: plates whose reach is
 *  nearly identical overlap like a deck of cards — 18px hidden, the
 *  majority of the logo behind stays visible. Hovering a plate brings it
 *  to the front (pure CSS, in the component). */
export const PLATE_STEP = 30;

/** The dodge's spacing contract, in y fraction units. */
const SEPARATION = PLATE_STEP / PLOT_HEIGHT;
/** Half a plate, in y fraction units — the clamp margin at both ends. */
const HALF_PLATE = PLATE_HEIGHT / 2 / PLOT_HEIGHT;

/** One Outlet on the chart: `y` is the dodged, log-scaled reach height,
 *  0 (bottom of the plot) to 1 (top). `logoSrc` follows the same rule as
 *  `leaning-chart.ts`: absent when no logo exists at the quality bar —
 *  the UI renders a name chip, never a broken image. */
export interface QuadrantEntry {
  outlet: Outlet;
  y: number;
  logoSrc?: string;
}

/** One of the five columns, left to right. */
export interface QuadrantRow {
  leaning: Leaning;
  entries: QuadrantEntry[];
}

/** The log-scale y domain, snapped outward to half-decades so the chart
 *  edges land on round figures and never exactly on a data point. The
 *  values come from the Outlet config, which always carries a reach
 *  figure (domain tests enforce it), so no empty case exists. */
export interface ReachDomain {
  min: number;
  max: number;
}

const HALF_DECADE = 0.5; // in log10 units

export function reachDomain(values: number[]): ReachDomain {
  const lo = Math.log10(Math.min(...values));
  const hi = Math.log10(Math.max(...values));
  return {
    min: 10 ** (Math.floor(lo / HALF_DECADE) * HALF_DECADE),
    max: 10 ** (Math.ceil(hi / HALF_DECADE) * HALF_DECADE),
  };
}

/** Log-scaled height of a reach value within the domain: 0 at the domain
 *  floor (plot bottom), 1 at the ceiling (plot top), clamped. */
export function reachY(value: number, domain: ReachDomain): number {
  const lo = Math.log10(domain.min);
  const hi = Math.log10(domain.max);
  return Math.min(1, Math.max(0, (Math.log10(value) - lo) / (hi - lo)));
}

/** The decade gridlines inside the domain: « 1 M », « 10 M »… each with
 *  its French short label and its height for the axis. */
export function reachTicks(
  domain: ReachDomain,
): { label: string; y: number }[] {
  const ticks: { label: string; y: number }[] = [];
  for (
    let exp = Math.ceil(Math.log10(domain.min));
    exp <= Math.floor(Math.log10(domain.max));
    exp++
  ) {
    const value = 10 ** exp;
    const y = reachY(value, domain);
    // A decade that lands exactly on a domain edge IS the axis — drawing
    // it would clip the label against the chart border.
    if (y <= 0 || y >= 1) continue;
    ticks.push({ label: reachLabel(value), y });
  }
  return ticks;
}

/** French short form for axis labels and plate titles: « 1 M », « 300 k ».
 *  Rounded to whole millions/thousands — the axis ticks are exact decades
 *  and pass through untouched, while arbitrary figures like 6 026 098
 *  become « 6 M ». A value that rounds up across the unit boundary reads
 *  as the larger unit (« 999 999 » → « 1 M »), never « 1000 k ». */
export function reachLabel(value: number): string {
  if (value >= 1e6) return `${Math.round(value / 1e6)} M`;
  const thousands = Math.round(value / 1e3);
  if (thousands >= 1000) return '1 M';
  return `${thousands} k`;
}

/**
 * Dodge one column's plate centers (given descending, biggest reach
 * first): each plate keeps its true height unless the plate above is
 * closer than a plate step, in which case it sits one step below —
 * overlapping at most PLATE_HEIGHT - PLATE_STEP of the logo behind, like
 * a deck of cards; a run pushed past the plot floor is lifted back
 * inside. Descending order is preserved and — up to seventeen plates in
 * a column — no plate is ever covered by more than that step.
 */
export function dodgeCenters(desired: number[]): number[] {
  const n = desired.length;
  if (n === 0) return [];
  const clampY = (y: number) =>
    Math.min(1 - HALF_PLATE, Math.max(HALF_PLATE, y));
  const want = desired.map(clampY);
  const centers = [...want];
  // Hang: each plate at least SEPARATION below the previous one.
  for (let i = 1; i < n; i++) {
    centers[i] = Math.min(centers[i], centers[i - 1] - SEPARATION);
  }
  // Lift the pushed run back inside the plot: everything that ended up
  // below its desired position moves up by the same offset, keeping the
  // spacing — then the run's top is clamped against the untouched plate
  // above it and the ceiling.
  const lift = HALF_PLATE - centers[n - 1];
  if (lift > 0) {
    let runStart = n - 1;
    while (runStart > 0 && centers[runStart - 1] < want[runStart - 1]) {
      runStart--;
    }
    for (let i = runStart; i < n; i++) centers[i] += lift;
    if (runStart > 0) {
      centers[runStart] = Math.min(
        centers[runStart],
        centers[runStart - 1] - SEPARATION,
      );
    }
  }
  // Saturated fallback: when spacing still cannot hold (more plates than
  // fit between the floor and the ceiling), abandon true heights and
  // spread the column evenly — the honest reading of an overloaded band.
  const fits = centers.every(
    (c, i) =>
      c >= HALF_PLATE - 1e-9 &&
      c <= 1 - HALF_PLATE + 1e-9 &&
      (i === 0 || centers[i - 1] - c >= SEPARATION - 1e-9),
  );
  if (!fits) {
    return centers.map(
      (_, i) => 1 - HALF_PLATE - (i * (1 - 2 * HALF_PLATE)) / (n - 1),
    );
  }
  return centers;
}

/**
 * Fold the Outlets into the five columns with their dodged y positions,
 * on `domain`. Both charts share the fold and its ordering
 * (`outletsByLeaning`), so the two views can never disagree.
 */
export function quadrantChartRows(
  outlets: Outlet[],
  logoFor: (id: string) => string | undefined,
  domain: ReachDomain,
): QuadrantRow[] {
  const groups = outletsByLeaning(outlets, logoFor);
  return leaningOrder.map((leaning, i) => {
    const placed = groups[i];
    const centers = dodgeCenters(
      placed.map((e) => reachY(e.outlet.reach.value, domain)),
    );
    const entries: QuadrantEntry[] = placed.map((entry, j) => ({
      ...entry,
      y: centers[j],
    }));
    return { leaning, entries };
  });
}
