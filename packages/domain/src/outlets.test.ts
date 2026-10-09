import { describe, expect, it } from 'vitest';
import {
  excludedOutlets,
  type OutletConfig,
  outlets,
  publicOutlets,
} from './outlets.ts';

/**
 * The Outlet config is the source of truth for the pipeline and for
 * /pourquoi-ce-classement (issue #2), so its evidence rules are enforced here:
 * every Leaning is backed by cited sources, every feed by a verification.
 */
describe('outlet config', () => {
  it('has unique, kebab-case ids (and excluded ids never overlap)', () => {
    const ids = outlets.map((outlet) => outlet.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    for (const excluded of excludedOutlets)
      expect(ids).not.toContain(excluded.id);
  });

  it('gives every Outlet a Leaning backed by at least 2 cited sources', () => {
    for (const outlet of outlets) {
      expect(outlet.leaningSources.length, outlet.id).toBeGreaterThanOrEqual(2);
      for (const source of outlet.leaningSources) {
        expect(source.title, outlet.id).not.toBe('');
        expect(source.author, outlet.id).not.toBe('');
        expect(source.url, outlet.id).toMatch(/^https:\/\//);
        // One-line takeaway, publishable on the French site.
        expect(source.takeaway, outlet.id).not.toBe('');
      }
    }
  });

  it('writes a leaning justification for every Outlet', () => {
    for (const outlet of outlets) {
      expect(outlet.leaningNote.length, outlet.id).toBeGreaterThan(20);
    }
  });

  it('records readership evidence or an inclusion rationale for every Outlet', () => {
    for (const outlet of outlets) {
      expect(outlet.readership.evidence, outlet.id).not.toBe('');
    }
  });

  it('verifies every declared feed (status, item count, time covered, images)', () => {
    for (const outlet of outlets) {
      const checked = new Set(
        outlet.feedChecks.map((check) => `${check.kind} ${check.url}`),
      );
      if (outlet.feeds.une) {
        expect(checked.has(`une ${outlet.feeds.une}`), outlet.id).toBe(true);
      }
      if (outlet.feeds.latest) {
        expect(checked.has(`latest ${outlet.feeds.latest}`), outlet.id).toBe(
          true,
        );
      }
      expect(outlet.feeds.une ?? outlet.feeds.latest, outlet.id).toBeDefined();
      for (const check of outlet.feedChecks) {
        expect(check.checkedAt, outlet.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(check.items, outlet.id).toBeGreaterThanOrEqual(0);
        expect(check.images, outlet.id).toMatch(/^(none|some|all)$/);
        // Time covered, or why the feed cannot be dated (missing pubDates).
        expect(
          check.covers !== '' || (check.note ?? '') !== '',
          outlet.id,
        ).toBe(true);
      }
    }
  });

  it('gives every Outlet a paywall badge and a dated TDM check', () => {
    for (const outlet of outlets) {
      expect(['none', 'partial', 'full'], outlet.id).toContain(outlet.paywall);
      expect(outlet.tdm.checkedAt, outlet.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // true = reservation publiée, false = aucune, null = sonde bloquée.
      expect([true, false, null], outlet.id).toContain(outlet.tdm.reserved);
    }
  });

  it('documents every exclusion with a reason and the date checked', () => {
    for (const excluded of excludedOutlets) {
      expect(excluded.reason, excluded.id).not.toBe('');
      expect(excluded.checkedAt, excluded.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('adds Marianne to the Edition, with a Centre-gauche Leaning and out of exclusions (issue #10)', () => {
    const marianne = outlets.find((outlet) => outlet.id === 'marianne');
    expect(marianne, 'marianne enters the Edition').toBeDefined();
    expect(marianne!.leaning).toBe('centre-gauche');
    expect(excludedOutlets.map((excluded) => excluded.id)).not.toContain(
      'marianne',
    );
  });

  it('splits the former Centre fold onto the five-band scale (issue #46)', () => {
    // Mechanical FrIdéo mapping: center-left → centre-gauche, center-right →
    // centre-droite; pure-centre and hors-panel Outlets stay put.
    const placements: Record<string, OutletConfig['leaning']> = {
      'le-monde': 'centre-gauche',
      marianne: 'centre-gauche',
      franceinfo: 'centre-gauche',
      '20-minutes': 'centre-gauche',
      'tf1-info': 'centre-droite',
      'le-point': 'centre-droite',
      'courrier-international': 'centre',
      'europe-1': 'droite',
    };
    for (const [id, leaning] of Object.entries(placements)) {
      const outlet = outlets.find((o) => o.id === id);
      expect(outlet, `${id} stays in the Edition`).toBeDefined();
      expect(outlet!.leaning, id).toBe(leaning);
    }
  });

  it('publishes only the public Outlet shape in data/outlets.json', () => {
    for (const outlet of publicOutlets()) {
      expect(Object.keys(outlet).sort()).toEqual([
        'feeds',
        'id',
        'leaning',
        'name',
        'paywall',
        'site',
      ]);
    }
  });
});
