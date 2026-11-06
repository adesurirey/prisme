import { type Leaning, leaningOrder, type Outlet } from '@prisme/domain';

/**
 * The classement page's logo chart: where every Outlet sits, left to right.
 *
 * Pure placement logic, shared by the page component and the OG-card
 * generator. Leaning is a hand-set band (ADR-0001), never a score — so a
 * zone is a discrete column in `leaningOrder`, not a point on an axis.
 * Inside a zone, Outlets sort by their sourced Reach figure, biggest first:
 * the page's text claims they are chosen for their "poids éditorial", and
 * the chart shows exactly that.
 */

/** One Outlet on the chart: `logoSrc` is the bundled asset URL, or nothing
 *  when no logo exists at the quality bar — the UI then renders a name chip,
 *  never a broken image. */
export interface ChartEntry {
  outlet: Outlet;
  logoSrc?: string;
}

/** One of the five columns. */
export interface ChartZone {
  leaning: Leaning;
  entries: ChartEntry[];
}

/**
 * Fold the Outlets into the five zones. `logoFor` maps an Outlet id to its
 * bundled logo URL (or undefined); reach ties break alphabetically by name so
 * the chart never reorders on a rebuild.
 */
export function leaningChartZones(
  outlets: Outlet[],
  logoFor: (id: string) => string | undefined,
): ChartZone[] {
  return leaningOrder.map((leaning) => ({
    leaning,
    entries: outlets
      .filter((o) => o.leaning === leaning)
      .sort(
        (a, b) =>
          b.reach.value - a.reach.value || a.name.localeCompare(b.name, 'fr'),
      )
      .map((outlet) => {
        const logoSrc = logoFor(outlet.id);
        return logoSrc === undefined ? { outlet } : { outlet, logoSrc };
      }),
  }));
}

/** The Outlet id a logo file stands for: its filename minus the
 *  extension — the one derivation every consumer shares. */
export function logoId(file: string): string {
  return file
    .split('/')
    .pop()!
    .replace(/\.(svg|png)$/, '');
}

/**
 * The logo directory is the manifest: one `<outlet-id>.svg|.png` file per
 * Outlet, no registry (see src/assets/outlets/SOURCES.md). This turns the
 * glob the component captured — Vite asset URLs keyed by relative path —
 * into the `logoFor` lookup `leaningChartZones` takes.
 */
export function logoLookup(
  assets: Record<string, string>,
): (id: string) => string | undefined {
  const byId = new Map(
    Object.entries(assets).map(([path, src]) => [logoId(path), src]),
  );
  return (id) => byId.get(id);
}
