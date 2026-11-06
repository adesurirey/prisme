import { leaningOrder, type Outlet } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import { leaningChartZones, logoLookup } from './leaning-chart';

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

const LOGOS = {
  '/src/assets/outlets/le-monde.svg': '/assets/le-monde.svg',
  '/src/assets/outlets/bfmtv.png': '/assets/bfmtv.png',
};

describe('leaningChartZones', () => {
  it('returns the five leanings in display order, left to right', () => {
    const zones = leaningChartZones([], () => undefined);
    expect(zones.map((z) => z.leaning)).toEqual(leaningOrder);
  });

  it('places every Outlet in its zone, exactly once', () => {
    const outlets = [
      outlet('a', 'A', 'gauche', 1),
      outlet('b', 'B', 'centre', 2),
      outlet('c', 'C', 'gauche', 3),
      outlet('d', 'D', 'droite', 4),
    ];
    const zones = leaningChartZones(outlets, () => undefined);
    const ids = zones.flatMap((z) => z.entries.map((e) => e.outlet.id));
    expect(ids.sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(zones.find((z) => z.leaning === 'gauche')!.entries).toHaveLength(2);
  });

  it('sorts each zone by reach, biggest first', () => {
    const outlets = [
      outlet('small', 'Small', 'droite', 300_000),
      outlet('big', 'Big', 'droite', 125_900_000),
      outlet('mid', 'Mid', 'droite', 30_200_000),
    ];
    const zone = leaningChartZones(outlets, () => undefined).find(
      (z) => z.leaning === 'droite',
    )!;
    expect(zone.entries.map((e) => e.outlet.id)).toEqual([
      'big',
      'mid',
      'small',
    ]);
  });

  it('breaks reach ties alphabetically so the chart never reorders on rebuild', () => {
    const outlets = [
      outlet('zeta', 'Zeta', 'centre', 100),
      outlet('alpha', 'Alpha', 'centre', 100),
    ];
    const zone = leaningChartZones(outlets, () => undefined).find(
      (z) => z.leaning === 'centre',
    )!;
    expect(zone.entries.map((e) => e.outlet.id)).toEqual(['alpha', 'zeta']);
  });

  it('attaches the logo URL when one exists, omits it otherwise', () => {
    const outlets = [
      outlet('le-monde', 'Le Monde', 'centre-gauche', 1),
      outlet('no-logo', 'No Logo', 'centre-gauche', 2),
    ];
    const zone = leaningChartZones(outlets, (id) =>
      id === 'le-monde' ? '/assets/le-monde.svg' : undefined,
    ).find((z) => z.leaning === 'centre-gauche')!;
    const byId = new Map(zone.entries.map((e) => [e.outlet.id, e]));
    expect(byId.get('le-monde')!.logoSrc).toBe('/assets/le-monde.svg');
    expect('logoSrc' in byId.get('no-logo')!).toBe(false);
  });
});

describe('logoLookup', () => {
  it('maps glob paths (keyed by relative path) to an id-keyed lookup', () => {
    const logoFor = logoLookup(LOGOS);
    expect(logoFor('le-monde')).toBe('/assets/le-monde.svg');
    expect(logoFor('bfmtv')).toBe('/assets/bfmtv.png');
    expect(logoFor('unknown')).toBeUndefined();
  });
});
