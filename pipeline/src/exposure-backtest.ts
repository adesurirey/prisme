// One-off backtest (free, no API): replay the archive through the Exposure
// and Coverage weighting and print per-Story shares for the candidate
// exponent matrices — volume brut/√/log × Reach brut/√/log — so a human can
// grade the constants against real Stories. The grading tool for the
// ADR-0026 volume exponent and the ADR-0016 deferred Reach-exponent
// comparison. Run: pnpm backtest:exposure
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type Article,
  type CoverageGroup,
  coverageGroup,
  coverageOrder,
  exposureShares as domainExposureShares,
  isReporting,
  type Outlet,
  reportingArticleCounts,
  reportingOutletIds,
  type Story,
} from '@prisme/domain';

const dir = join(import.meta.dirname, '../../data/stories');
const outlets: Outlet[] = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../data/outlets.json'), 'utf8'),
) as Outlet[];
const byId = new Map(outlets.map((o) => [o.id, o]));

const stories: Story[] = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Story)
  .sort(
    (a, b) =>
      a.storyDay.localeCompare(b.storyDay) ||
      a.createdAt.localeCompare(b.createdAt),
  );

type Compress = (count: number) => number;
const brut: Compress = (c) => c;
const sqrt: Compress = (c) => Math.sqrt(c);
const log: Compress = (c) => Math.log2(1 + c);
const NAMES: Record<string, Compress> = { brut, sqrt, log };

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

const pct = (s: Record<CoverageGroup, number>) =>
  coverageOrder.map((g) => `${g} ${Math.round(s[g] * 100)}%`).join(' · ');

const current = (story: Story) =>
  pct(domainExposureShares(story.articles, byId));

for (const story of stories) {
  const reporting = reportingOutletIds(story.articles).size;
  if (reporting < 2) continue;
  console.log(
    `\n## ${story.storyDay} ${story.slug} (${reporting} médias, ${story.articles.length} articles)`,
  );
  console.log(`  production √/√ : ${current(story)}`);
  for (const [vn, v] of Object.entries(NAMES)) {
    for (const [rn, r] of Object.entries(NAMES)) {
      console.log(
        `  vol=${vn} reach=${rn} : ${pct(shares(story.articles, v, r))}`,
      );
    }
  }
}
