/**
 * Sanity sampler for the grouping benchmark (issue #41).
 *
 *   pnpm benchmark:grouping-sample
 *
 * The pseudo-ground-truth is the snapshot's own clustering: when a
 * candidate disagrees with it (a split or an over-merge), the grader
 * assumes the snapshot is right. This samples ~30 of those disagreement
 * pairs — plus agreement controls — for a human to label blind. If the
 * human sides with the snapshot, the recorded numbers stand; if the human
 * sides with the candidates, the grader needs a justified-disagreement
 * correction (docs/research/grouping-benchmark.md).
 *
 * No model calls: everything comes from the recorded results files and the
 * fixtures (pure local recomputation). Pairs are drawn from the two models
 * whose numbers drive the decision — the baseline and the best candidate.
 * Blindness: the sheet never shows which bucket a pair came from; the
 * seeded PRNG (mulberry32, seed 41) makes the sample reproducible.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import type { GroupingProposal } from '../gemini.ts';
import {
  type FixtureSet,
  fixturesFromData,
  type GroupingFixture,
} from './grouping-fixtures.ts';
import { finalClusters } from './grouping-metrics.ts';
import { LABELS_DIR, RESULTS_DIR } from './grouping-paths.ts';

/** The decision is Flash-Lite vs the best candidate — sample their clashes. */
const DEFAULT_MODELS = [
  'gemini/gemini-3.5-flash-lite',
  'openrouter/openai/gpt-6-luna',
];

const SEED = 41;

/** Per fixture and bucket. 12 splits + 12 over-merges + 6 controls = 30. */
const TARGETS = {
  splits: 6,
  'over-merges': 6,
  controls: 3,
} as const;

type Bucket = 'split' | 'over-merge' | 'control-same' | 'control-different';

/** One sampled pair with everything grading needs. Headlines stay out of git. */
export interface SampledPair {
  id: string;
  fixture: GroupingFixture['name'];
  /** Opaque ids — the only thing committed about this pair. */
  aId: string;
  bId: string;
  headlineA: string;
  headlineB: string;
  sections: string[];
  /** Every (model, bucket) claim this pair serves. */
  entries: { model: string; bucket: Bucket }[];
  verdict: 'same' | 'different' | 'unsure' | null;
}

function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Bucket a fresh-Article pair from key (ground truth) vs candidate clusters. */
export function bucketPair(
  gtA: string,
  gtB: string,
  candA: string,
  candB: string,
): Bucket | null {
  const keySame = gtA === gtB;
  const candSame = candA === candB;
  if (keySame && candSame) return 'control-same';
  if (!keySame && !candSame) return 'control-different';
  return keySame ? 'split' : 'over-merge';
}

export interface CandidatePair {
  fixture: GroupingFixture['name'];
  aId: string;
  bId: string;
  aHeadline: string;
  bHeadline: string;
  sections: string[];
  bucket: Bucket;
}

/**
 * All fresh-Article pairs where the candidate disagrees (or agrees) with
 * the fixture's ground truth, bucketed. Uses the same final-cluster
 * semantics as the grader, so a sampled "split" is exactly a penalized
 * splitPair and an "over-merge" exactly an over-merged pair.
 */
export function candidatePairs(
  fixture: GroupingFixture,
  proposal: GroupingProposal,
): CandidatePair[] {
  const { finalCluster } = finalClusters(fixture, proposal);
  const articles = new Map(fixture.freshArticles.map((a) => [a.id, a]));
  const gt = fixture.groundTruth;
  const pairs: CandidatePair[] = [];
  const ids = Object.keys(gt);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const aId = ids[i]!;
      const bId = ids[j]!;
      const candA = finalCluster.get(aId);
      const candB = finalCluster.get(bId);
      if (candA == null || candB == null) continue;
      const bucket = bucketPair(gt[aId]!, gt[bId]!, candA, candB);
      if (bucket == null) continue;
      const a = articles.get(aId)!;
      const b = articles.get(bId)!;
      pairs.push({
        fixture: fixture.name,
        aId,
        bId,
        aHeadline: a.headline,
        bHeadline: b.headline,
        sections: [a.section, b.section].filter((s) => s != null),
        bucket,
      });
    }
  }
  return pairs;
}

/**
 * Stratified, cross-model-deduped sample: per fixture, up to TARGETS from
 * each model, round-robin, dedupe by (fixture, article pair). A pair the
 * other model already surfaced is skipped without spending budget — the
 * grader merges both models' claims for one human label instead of two.
 */
export interface StratifiedRow {
  fixture: GroupingFixture['name'];
  pair: CandidatePair;
  model: string;
}

export function stratify(
  byModel: Record<string, CandidatePair[]>,
  rng: () => number,
): StratifiedRow[] {
  const buckets = [
    ['splits', (b: Bucket) => b === 'split'],
    ['over-merges', (b: Bucket) => b === 'over-merge'],
    ['controls', (b: Bucket) => b.startsWith('control')],
  ] as const;
  const chosen = new Map<string, StratifiedRow>();
  for (const fixture of ['from-empty', 'long-context'] as const) {
    for (const [key, isBucket] of buckets) {
      const perModel = Object.fromEntries(
        Object.entries(byModel).map(([model, pairs]) => [
          model,
          shuffle(
            pairs.filter((p) => p.fixture === fixture && isBucket(p.bucket)),
            rng,
          ),
        ]),
      );
      let budget = TARGETS[key];
      let exhausted = false;
      while (!exhausted) {
        exhausted = true;
        for (const [model, pool] of Object.entries(perModel)) {
          if (budget <= 0) break;
          const next = pool.shift();
          if (next == null) continue;
          exhausted = false;
          const dedupeKey = [fixture, next.aId, next.bId].join(':');
          if (!chosen.has(dedupeKey)) {
            budget--;
            chosen.set(dedupeKey, { fixture, pair: next, model });
          }
        }
      }
    }
  }
  return [...chosen.values()];
}

async function main() {
  const files = (await readdir(RESULTS_DIR)).filter((f) => f.endsWith('.json'));
  const records = await Promise.all(
    files.map(
      async (f) =>
        JSON.parse(
          await readFile(new URL(f, RESULTS_DIR), 'utf8'),
        ) as import('./grouping-run.ts').CandidateRecord,
    ),
  );
  const wanted = records.filter((r) => DEFAULT_MODELS.includes(r.spec));
  const missing = DEFAULT_MODELS.filter(
    (s) => !wanted.some((r) => r.spec === s),
  );
  if (wanted.length === 0) {
    console.error(`No recorded results for ${DEFAULT_MODELS.join(', ')}.`);
    process.exitCode = 1;
    return;
  }
  if (missing.length > 0) {
    console.warn(`Missing records for: ${missing.join(', ')}`);
  }
  const builtAts = new Set(wanted.map((r) => r.fixtureBuiltAt));
  const set: FixtureSet = await fixturesFromData();
  if (!builtAts.has(set.builtAt) || builtAts.size > 1) {
    console.error(
      `Fixture edition drifted: results were recorded at ${[...builtAts].join(', ')}, data/ is at ${set.builtAt}. Re-run the affected models at the matching commit, or pin the checkout.`,
    );
    process.exitCode = 1;
    return;
  }
  const fixtures = Object.fromEntries(set.fixtures.map((f) => [f.name, f]));
  const byModel: Record<string, CandidatePair[]> = {};
  for (const record of wanted) {
    const model = record.spec;
    byModel[model] = [];
    for (const fixture of record.fixtures) {
      // Every run replays the same call, so the fullest proposal's clashes
      // represent the model's disagreement profile for that fixture.
      const valid = fixture.runs.filter((r) => r.valid && r.proposal != null);
      const best = valid.reduce<import('./grouping-run.ts').FixtureRun | null>(
        (a, b) =>
          a == null ||
          b.proposal!.assignments.length > a.proposal!.assignments.length
            ? b
            : a,
        null,
      );
      if (best == null) continue;
      byModel[model].push(
        ...candidatePairs(fixtures[fixture.fixture]!, best.proposal!),
      );
    }
  }
  const rng = prng(SEED);
  const rows = stratify(byModel, rng);
  const shuffled = shuffle(rows, rng).map((row, i) => {
    const flip = rng() < 0.5;
    const [aId, bId] = [row.pair.aId, row.pair.bId];
    return {
      id: `p${i + 1}`,
      fixture: row.fixture,
      aId: flip ? bId : aId,
      bId: flip ? aId : bId,
      headlineA: flip ? row.pair.bHeadline : row.pair.aHeadline,
      headlineB: flip ? row.pair.aHeadline : row.pair.bHeadline,
      sections: row.pair.sections,
      entries: [{ model: row.model, bucket: row.pair.bucket }],
      verdict: null,
    } satisfies SampledPair;
  });
  await mkdir(LABELS_DIR, { recursive: true });
  await writeFile(
    new URL('pairs.json', LABELS_DIR),
    JSON.stringify(
      {
        instructions:
          'Fill verdict per pair: same = one Story should hold both headlines; different = separate Stories; unsure = skip (excluded from grading). Label blind: judge the two headlines only — the bucket (split/over-merge/control) is hidden on purpose.',
        builtAt: set.builtAt,
        seed: SEED,
        pairs: shuffled,
      },
      null,
      2,
    ),
  );
  // Blind worksheet: id + headlines + verdict column, no provenance.
  const sheet = [
    '# Grouping sanity worksheet (issue #41)',
    '',
    'For each pair: **same** if one Story should hold both headlines,',
    '**different** if they belong in separate Stories. Judge the headlines',
    'only — do not try to reverse-engineer why a pair was sampled. Put the',
    'verdict in pairs.json (same file, `verdict` field) or in this sheet.',
    '',
    '| id | Section | Headline A | Headline B | verdict |',
    '| --- | --- | --- | --- | --- |',
    ...shuffled.map(
      (p) =>
        `| ${p.id} | ${(p.sections[0] ?? '—').replace(/\|/gu, '∣')} | ${p.headlineA.replace(/\|/gu, '∣')} | ${p.headlineB.replace(/\|/gu, '∣')} |  |`,
    ),
  ].join('\n');
  await writeFile(new URL('sheet.md', LABELS_DIR), `${sheet}\n`);
  const counts = shuffled.reduce<Record<string, number>>((acc, p) => {
    for (const e of p.entries) acc[`${e.bucket}`] = (acc[e.bucket] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `${shuffled.length} pairs → .benchmark/grouping/labels/sheet.md (buckets: ${JSON.stringify(counts)})`,
  );
}

await main();
