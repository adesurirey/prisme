import { readFileSync } from 'node:fs';
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

  it('adds Challenges (Centre) and L\u2019Opinion (Centre droit) to the Edition (issue #72)', () => {
    const challenges = outlets.find((outlet) => outlet.id === 'challenges');
    expect(challenges, 'challenges enters the Edition').toBeDefined();
    expect(challenges!.leaning).toBe('centre');
    expect(challenges!.paywall).toBe('partial');
    expect(challenges!.feeds.latest).toBe('https://www.challenges.fr/rss.xml');
    const lopinion = outlets.find((outlet) => outlet.id === 'lopinion');
    expect(lopinion, 'lopinion enters the Edition').toBeDefined();
    expect(lopinion!.leaning).toBe('centre-droite');
    expect(lopinion!.feeds.latest).toBe('https://www.lopinion.fr/index.rss');
    for (const outlet of [challenges!, lopinion!]) {
      expect(outlet.feedChecks[0]!.checkedAt).toBe('2026-10-10');
      expect(excludedOutlets.map((excluded) => excluded.id)).not.toContain(
        outlet.id,
      );
    }
    // Challenges publishes a TDM reservation (tdmrep.json redirects to
    // /tdmrep.json, tdm-reservation: 1); L'Opinion publishes none.
    expect(challenges!.tdm.reserved).toBe(true);
    expect(lopinion!.tdm.reserved).toBe(false);
  });

  it('adds Slate.fr (Centre gauche) to the Edition (issue #73)', () => {
    const slate = outlets.find((outlet) => outlet.id === 'slate-fr');
    expect(slate, 'slate-fr enters the Edition').toBeDefined();
    expect(slate!.name).toBe('Slate.fr');
    expect(slate!.leaning).toBe('centre-gauche');
    expect(slate!.paywall).toBe('none');
    expect(slate!.feeds.latest).toBe('https://slate.fr/rss.xml');
    expect(slate!.feedChecks[0]!.checkedAt).toBe('2026-10-10');
    expect(slate!.feedChecks[0]!.status).toBe(200);
    expect(slate!.tdm.reserved).toBe(false);
    // Audience argument consigné sur #73 : podcasts certifiés ACPM (1er
    // groupe), aucune certification site — inclusion retenue malgré tout.
    expect(slate!.readership.evidence).toMatch(/podcasts/);
    expect(excludedOutlets.map((excluded) => excluded.id)).not.toContain(
      'slate-fr',
    );
  });

  it('adds Blast (Gauche) to the Edition (issue #71)', () => {
    const blast = outlets.find((outlet) => outlet.id === 'blast');
    expect(blast, 'blast enters the Edition').toBeDefined();
    expect(blast!.name).toBe('Blast');
    expect(blast!.leaning).toBe('gauche');
    expect(blast!.paywall).toBe('none');
    // The SPA references no feed in its HTML: feeds live on the api. subdomain
    // (initial audit of #71 probed www.blast-info.fr in vain). Articles feed
    // only — the emissions feed is out of scope.
    expect(blast!.feeds.latest).toBe(
      'https://api.blast-info.fr/rss_articles.xml',
    );
    expect(blast!.feedChecks[0]!.checkedAt).toBe('2026-10-10');
    expect(blast!.feedChecks[0]!.status).toBe(200);
    expect(blast!.tdm.reserved).toBe(false);
    // Audience argument consigné sur #71 : no ACPM certification — sworn
    // Senate testimony (33 625 paying subscribers) plus Semrush estimates,
    // same calibre as Atlantico. Réserve écrite : auto-déclared figures.
    expect(blast!.readership.evidence).toMatch(/serment/);
    expect(excludedOutlets.map((excluded) => excluded.id)).not.toContain(
      'blast',
    );
  });

  it('keeps the research doc in sync with the config count and ids', () => {
    // The « À ce jour, N médias » line of the research doc is the published
    // perimeter count: it must track the typed config, not drift from it.
    const doc = readFileSync(
      new URL('../../../docs/research/outlet-leanings.md', import.meta.url),
      'utf8',
    );
    const count = doc.match(/À ce jour, \*\*(\d+) médias\*\*/);
    expect(count, 'the doc states the perimeter count').not.toBeNull();
    expect(Number(count![1])).toBe(outlets.length);
    for (const outlet of outlets)
      expect(doc, outlet.id).toContain(`### ${outlet.name} `);
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
