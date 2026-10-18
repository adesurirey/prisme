// One-off backtest (free, no API): replay the current Edition (data/edition.json)
// through the Exposure weighting and print the candidate exponent matrices —
// volume brut/√/log × Reach brut/√/log — for a human to grade the constants
// against real Stories (ADR-0026; the Reach-exponent comparison ADR-0016
// deferred). Only Stories where a candidate changes the dominant group are
// printed — the others cannot move the decision. Run: pnpm backtest:exposure
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type Article,
  type CoverageGroup,
  coverageGroup,
  coverageOrder,
  exposureShares as domainExposureShares,
  type Edition,
  type Outlet,
  reportingArticleCounts,
  reportingOutletIds,
  type Story,
} from '@prisme/domain';

const edition: Edition = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../data/edition.json'), 'utf8'),
) as Edition;
const outlets: Outlet[] = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../data/outlets.json'), 'utf8'),
) as Outlet[];
const byId = new Map(outlets.map((o) => [o.id, o]));

const stories: Story[] = [...edition.stories].sort(
  (a, b) =>
    a.storyDay.localeCompare(b.storyDay) ||
    a.createdAt.localeCompare(b.createdAt),
);

type Compress = (count: number) => number;
const brut: Compress = (c) => c;
const sqrt: Compress = (c) => Math.sqrt(c);
const log: Compress = (c) => Math.log2(1 + c);
const CANDIDATES: Record<string, Compress> = { brut, sqrt, log };

/** Shares per group for one candidate (volume, reach) exponent pair. */
function shares(
  articles: Article[],
  volume: Compress,
  reach: Compress,
): Record<CoverageGroup, number> {
  const sums: Record<CoverageGroup, number> = {
    gauche: 0,
    centre: 0,
    droite: 0,
  };
  let total = 0;
  for (const [id, count] of reportingArticleCounts(articles)) {
    const outlet = byId.get(id);
    if (!outlet) continue;
    const weight = volume(count) * reach(outlet.reach.value);
    sums[coverageGroup(outlet.leaning)] += weight;
    total += weight;
  }
  if (total === 0) return sums;
  for (const g of coverageOrder) sums[g] /= total;
  return sums;
}

/** The group with the biggest share — ties to the first in coverageOrder. */
function dominant(s: Record<CoverageGroup, number>): CoverageGroup {
  return coverageOrder.reduce((best, g) => (s[g] > s[best] ? g : best));
}

const pct = (s: Record<CoverageGroup, number>) =>
  coverageOrder.map((g) => `${g} ${Math.round(s[g] * 100)}%`).join(' · ');

const eligible = stories.filter(
  (s) => reportingOutletIds(s.articles).size >= 2,
);

// Production (√/√) shares per Story, and the candidate rows that diverge
// from it enough to change the dominant group — the decision-relevant set.
type Row = { name: string; shares: Record<CoverageGroup, number> };
const diverging = new Map<Story, Row[]>();
const changes = new Map<string, number>();
for (const [vn, v] of Object.entries(CANDIDATES)) {
  for (const [rn, r] of Object.entries(CANDIDATES)) {
    changes.set(`vol=${vn} reach=${rn}`, 0);
  }
}
for (const story of eligible) {
  const production = domainExposureShares(story.articles, byId);
  const prodDominant = dominant(production);
  const rows: Row[] = [];
  for (const [vn, v] of Object.entries(CANDIDATES)) {
    for (const [rn, r] of Object.entries(CANDIDATES)) {
      const name = `vol=${vn} reach=${rn}`;
      const s = shares(story.articles, v, r);
      if (dominant(s) !== prodDominant) {
        changes.set(name, (changes.get(name) ?? 0) + 1);
        rows.push({ name, shares: s });
      }
    }
  }
  if (rows.length > 0) diverging.set(story, rows);
}

console.log(
  `Édition en cours — ${eligible.length} Stories rapportées par ≥ 2 médias`,
);
console.log('Candidat          Stories où il change le groupe dominant');
for (const [name, count] of changes) {
  console.log(
    `  ${name.padEnd(18)} ${String(count).padStart(3)} / ${eligible.length}`,
  );
}
console.log(
  `\nDétail des ${diverging.size} Stories où au moins un candidat change le groupe dominant (production √/√ imprimée pour comparaison) :\n`,
);
for (const [story, rows] of diverging) {
  const production = domainExposureShares(story.articles, byId);
  console.log(
    `## ${story.storyDay} ${story.slug} (${reportingOutletIds(story.articles).size} médias, ${story.articles.length} articles)`,
  );
  console.log(`  production √/√ : ${pct(production)}`);
  for (const { name, shares: s } of rows) {
    console.log(`  ${name.padEnd(18)} : ${pct(s)}`);
  }
  console.log('');
}
if (diverging.size === 0) {
  console.log(
    'Aucun candidat ne change le groupe dominant — √/√ est sans risque sur cette édition.',
  );
}
