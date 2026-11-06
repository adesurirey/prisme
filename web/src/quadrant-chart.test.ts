import { leaningOrder, type Outlet, outlets } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import {
  dodgeCenters,
  PLATE_HEIGHT,
  PLATE_STEP,
  PLOT_HEIGHT,
  quadrantChartRows,
  reachDomain,
  reachLabel,
  reachTicks,
  reachY,
} from './quadrant-chart';

/** The exact spacing the dodge guarantees between plate centers: plates
 *  overlap at most PLATE_HEIGHT - PLATE_STEP (a deck-of-cards peek). */
const SEPARATION = PLATE_STEP / PLOT_HEIGHT;
const HALF_PLATE = PLATE_HEIGHT / 2 / PLOT_HEIGHT;

/** Minimal Outlet factory — only the fields the chart reads. */
const outlet = (
  id: string,
  name: string,
  leaning: Outlet['leaning'],
  reach: number,
): Outlet => ({
  id,
  name,
  leaning,
  paywall: 'none',
  site: `https://example.com/${id}`,
  feeds: {},
  reach: { value: reach, unit: 'visits', source: 'test', asOf: '2026-01' },
});

describe('reachDomain', () => {
  it('snaps outward to half-decades', () => {
    // 315 k (10^5.498) snaps down to the 10^5 edge, 185.5 M (10^8.268)
    // snaps up to 10^8.5 (≈316 M) — the smallest plate never sits on the
    // axis edge.
    const domain = reachDomain([315_089, 185_500_000]);
    expect(domain.min).toBeCloseTo(10 ** 5, 5);
    expect(domain.max).toBeCloseTo(10 ** 8.5, 5);
  });
});

describe('reachY', () => {
  const domain = reachDomain([1e5, 1e9]);

  it('maps domain bounds to 1 (top) and 0 (bottom)', () => {
    expect(reachY(domain.max, domain)).toBe(1);
    expect(reachY(domain.min, domain)).toBe(0);
  });

  it('is monotonic and log-scaled (midpoint is a geometric mean)', () => {
    const geo = Math.sqrt(domain.min * domain.max);
    expect(reachY(geo, domain)).toBeCloseTo(0.5, 5);
    expect(reachY(domain.max, domain)).toBeGreaterThan(reachY(geo, domain));
  });

  it('clamps out-of-domain values', () => {
    expect(reachY(1e12, domain)).toBe(1);
    expect(reachY(1, domain)).toBe(0);
  });
});

describe('reachTicks', () => {
  it('lists one decade label per decade inside the domain, bottom to top', () => {
    const ticks = reachTicks(reachDomain([315_089, 185_500_000]));
    // The 100 k decade sits exactly on the domain floor — the axis edge
    // itself — so it is dropped, not drawn.
    expect(ticks.map((t) => t.label)).toEqual(['1 M', '10 M', '100 M']);
    // Tick heights increase toward the top and stay inside the plot.
    const ys = ticks.map((t) => t.y);
    expect(ys[0]).toBeGreaterThan(0);
    expect(ys[ys.length - 1]).toBeLessThan(1);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });
});

describe('reachLabel', () => {
  it('formats French short forms', () => {
    expect(reachLabel(300_000)).toBe('300 k');
    expect(reachLabel(10_000_000)).toBe('10 M');
  });

  it('rounds to whole millions and thousands', () => {
    expect(reachLabel(6_026_098)).toBe('6 M');
    expect(reachLabel(17_900_000)).toBe('18 M');
    expect(reachLabel(315_089)).toBe('315 k');
  });

  it('never renders « 1000 k » — the boundary reads as the larger unit', () => {
    expect(reachLabel(999_999)).toBe('1 M');
  });
});

describe('dodgeCenters', () => {
  /** All plates inside the plot and spaced a plate apart. */
  const expectNoOverlap = (centers: number[]) => {
    for (const c of centers) {
      expect(c).toBeGreaterThanOrEqual(HALF_PLATE - 1e-9);
      expect(c).toBeLessThanOrEqual(1 - HALF_PLATE + 1e-9);
    }
    for (let i = 1; i < centers.length; i++) {
      expect(centers[i - 1] - centers[i]).toBeGreaterThanOrEqual(
        SEPARATION - 1e-9,
      );
    }
  };

  it('leaves an isolated plate at its true height', () => {
    const centers = dodgeCenters([0.6]);
    expect(centers[0]).toBeCloseTo(0.6, 9);
  });

  it('returns nothing for an empty column', () => {
    expect(dodgeCenters([])).toEqual([]);
  });

  it('separates two plates at the same height, order preserved', () => {
    const centers = dodgeCenters([0.5, 0.5]);
    expect(centers[0]).toBeGreaterThan(centers[1]);
    expect(centers[0] - centers[1]).toBeGreaterThanOrEqual(SEPARATION);
    // The overlap never hides the logo behind: at most a card-peek.
    const gapPx = (centers[0] - centers[1]) * PLOT_HEIGHT;
    expect(PLATE_HEIGHT - gapPx).toBeLessThanOrEqual(
      PLATE_HEIGHT - PLATE_STEP + 1e-9,
    );
    // Both stay near the requested height: the second sits exactly one
    // step below the first.
    expect(centers[0]).toBeLessThan(0.5 + SEPARATION);
    expect(centers[1]).toBeGreaterThanOrEqual(0.5 - SEPARATION - 1e-9);
  });

  it('clamps a plate requested below the plot floor', () => {
    const centers = dodgeCenters([0.01]);
    expect(centers[0]).toBeCloseTo(HALF_PLATE, 9);
  });

  it('clears a saturated chain without full coverage or leaving the plot', () => {
    // Nine plates stacked at the same mid height: the worst real column
    // (Centre) after a bad domain. With the card-peek step the chain hangs
    // downward from its true height and still clears the floor.
    const centers = dodgeCenters(Array.from({ length: 9 }, () => 0.5));
    expectNoOverlap(centers);
    // The top plate keeps its true height; the run fits above the floor.
    expect(centers[0]).toBeCloseTo(0.5, 9);
    expect(centers[8]).toBeGreaterThanOrEqual(HALF_PLATE - 1e-9);
  });

  it('falls back to an even spread when a column cannot fit at all', () => {
    // Twelve plates cannot fit a plate apart between floor and ceiling
    // (eleven gaps × SEPARATION > the usable span); the spread abandons
    // true heights, stays in bounds, and gives each pair the largest
    // spacing available.
    const centers = dodgeCenters(Array.from({ length: 12 }, () => 0.5));
    for (const c of centers) {
      expect(c).toBeGreaterThanOrEqual(HALF_PLATE - 1e-9);
      expect(c).toBeLessThanOrEqual(1 - HALF_PLATE + 1e-9);
    }
    const gap = (1 - 2 * HALF_PLATE) / (centers.length - 1);
    for (let i = 1; i < centers.length; i++) {
      expect(centers[i - 1] - centers[i]).toBeCloseTo(gap, 9);
    }
  });

  it('keeps a pushed run clear of the untouched plate above it', () => {
    // One free plate at 0.9, then a long crowded chain hanging below it:
    // the lift must not push the run's top into the anchor.
    const desired = [0.9, ...Array.from({ length: 8 }, () => 0.1)];
    expectNoOverlap(dodgeCenters(desired));
  });
});

describe('quadrantChartRows', () => {
  const domain = reachDomain([315_089, 185_500_000]);

  it('returns the five leanings in display order, left to right', () => {
    const rows = quadrantChartRows([], () => undefined, domain);
    expect(rows.map((r) => r.leaning)).toEqual(leaningOrder);
  });

  it('places every Outlet in its column, exactly once, inside the plot', () => {
    const rows = quadrantChartRows(
      [
        outlet('a', 'A', 'gauche', 1e6),
        outlet('b', 'B', 'centre', 1e7),
        outlet('c', 'C', 'droite', 1e8),
      ],
      () => undefined,
      reachDomain([1e6, 1e7, 1e8]),
    );
    const placed = rows.flatMap((r) => r.entries);
    expect(placed.map((e) => e.outlet.id).sort()).toEqual(['a', 'b', 'c']);
    expect(
      placed.every(
        (e) => e.y >= HALF_PLATE - 1e-9 && e.y <= 1 - HALF_PLATE + 1e-9,
      ),
    ).toBe(true);
    // Bigger reach sits higher.
    const byId = Object.fromEntries(placed.map((e) => [e.outlet.id, e.y]));
    expect(byId.a).toBeLessThan(byId.b);
    expect(byId.b).toBeLessThan(byId.c);
  });

  it('dodges the real Outlet config without full coverage', () => {
    // The bug this chart shipped with: crowded columns (Centre has 9
    // Outlets) rendered plates fully on top of each other. The dodge must
    // keep every column of the actual config within the card-peek bound —
    // partial overlap allowed, a logo never fully hidden.
    const rows = quadrantChartRows(outlets, () => undefined, domain);
    for (const row of rows) {
      const ys = row.entries.map((e) => e.y);
      for (let i = 1; i < ys.length; i++) {
        expect(ys[i - 1] - ys[i], row.leaning).toBeGreaterThanOrEqual(
          SEPARATION - 1e-9,
        );
      }
    }
  });

  it('attaches the logo url only when logoFor provides one', () => {
    const rows = quadrantChartRows(
      [outlet('a', 'A', 'centre', 1e6)],
      (id) => (id === 'a' ? '/logo-a.svg' : undefined),
      domain,
    );
    const row = rows.find((r) => r.leaning === 'centre')!;
    expect(row.entries[0].logoSrc).toBe('/logo-a.svg');
  });
});
