/**
 * Grouping-benchmark runner (issue #41): replay the captured fixtures against
 * one or more Grouping models and record the numbers the decision rule needs
 * (dup-seed rate, coverage, split rate, stability, cost, latency).
 *
 *   pnpm benchmark:grouping -- <spec> [<spec> ...]
 *
 * where a spec is `gemini/<model>` or `openrouter/<model>` — e.g.
 *
 *   pnpm benchmark:grouping -- gemini/gemini-3.5-flash-lite \
 *                             openrouter/deepseek/deepseek-v4-flash-0731
 *
 * Fixtures rebuild from data/ on every run (the repo is the database,
 * ADR-0002) and are snapshotted alongside the results under
 * .benchmark/grouping/ (gitignored — headlines and titles only, ADR-0003).
 * Each candidate runs twice per fixture for the stability metric. The report
 * .benchmark/grouping/report.md aggregates every recorded results file, so a
 * rerun with a new model extends the comparison.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import type { GroupingProposal } from '../gemini.ts';
import {
  type FixtureSet,
  fixturesFromData,
  type GroupingFixture,
} from './grouping-fixtures.ts';
import {
  type DeadlockMetrics,
  type Evaluation,
  evaluateProposal,
  stability,
} from './grouping-metrics.ts';
import {
  type BenchmarkGroupingModel,
  benchmarkGroupingModel,
  chunkedGroupingModel,
  type GroupingCall,
} from './grouping-models.ts';

const OUT_DIR = new URL('../../../.benchmark/grouping/', import.meta.url);

export interface FixtureRun {
  run: 1 | 2;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  /** Null proposal = unparseable or failed call (the silent-failure mode). */
  valid: boolean;
  /** Head of the raw response when it failed to parse — forensics. */
  rawSnippet?: string;
  /** Why generation stopped — 'length' means a truncated, unparseable JSON. */
  finishReason?: string | null;
  evaluation: {
    coverage: Evaluation['coverage'];
    dupSeeds: Evaluation['dupSeeds'];
    clusters: Evaluation['clusters'];
    /** The deadlock fixture only (issue #149). */
    deadlock?: DeadlockMetrics;
  } | null;
  /** Full proposal: ids, model-written titles — nothing from the feeds. */
  proposal: GroupingProposal | null;
}

export interface FixtureResult {
  fixture: GroupingFixture['name'];
  freshArticles: number;
  liveStories: number;
  runs: FixtureRun[];
  /** Jaccard of co-clustering pair sets across the two runs; null when a run failed. */
  stability: number | null;
}

export interface CandidateRecord {
  spec: string;
  label: string;
  recordedAt: string;
  fixtureBuiltAt: string;
  fixtures: FixtureResult[];
}

async function runFixture(
  model: BenchmarkGroupingModel,
  fixture: FixtureSet['fixtures'][number],
): Promise<FixtureResult> {
  const runs: FixtureRun[] = [];
  const evals: (Evaluation | null)[] = [];
  let callFailed = false;
  for (const run of [1, 2] as const) {
    // Fail-fast: when run 1 failed at the call level (timeout, HTTP error),
    // run 2 will burn the same minutes for the same answer. One failed call
    // is already the benchmark datapoint.
    if (run === 2 && callFailed) {
      console.error(
        `${model.spec} ${fixture.name}: run 1 failed at the call level — skipping run 2`,
      );
      break;
    }
    const t0 = Date.now();
    let call: GroupingCall;
    try {
      call = await model.group({
        stories: fixture.liveStories,
        articles: fixture.freshArticles,
      });
    } catch (error) {
      callFailed = true;
      console.error(
        `${model.spec} ${fixture.name} run ${run}: call failed — ${(error as Error).message}`,
      );
      runs.push({
        run,
        latencyMs: Date.now() - t0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: null,
        valid: false,
        evaluation: null,
        proposal: null,
      });
      evals.push(null);
      continue;
    }
    const latencyMs = Date.now() - t0;
    // An empty proposal against fresh Articles is the free-tier failure mode
    // (issue #36's silent-parse-failure cousin): parseable JSON, zero work.
    // Count it as degraded, like the production retry-then-degrade path.
    const empty =
      call.proposal != null &&
      fixture.freshArticles.length > 0 &&
      call.proposal.assignments.length === 0;
    if (empty) {
      console.error(
        `${model.spec} ${fixture.name} run ${run}: empty proposal (${fixture.freshArticles.length} fresh Articles) — degraded`,
      );
    }
    const evaluation =
      call.proposal == null || empty
        ? null
        : evaluateProposal(fixture, call.proposal);
    if (evaluation?.deadlock != null) {
      const d = evaluation.deadlock;
      console.log(
        `    run ${run} deadlock: → magnet ${d.toMagnet}, born ${d.born} (${d.birthClusters} new-Story cluster(s))`,
      );
    }
    if (call.proposal == null) {
      console.error(
        `${model.spec} ${fixture.name} run ${run}: unparseable response (${call.outputTokens} output tokens, finish ${call.finishReason ?? '?'}) — head: ${(call.rawSnippet ?? '').slice(0, 150).replaceAll(/\s+/gu, ' ')}`,
      );
    }
    runs.push({
      run,
      latencyMs,
      inputTokens: call.inputTokens,
      outputTokens: call.outputTokens,
      costUsd: call.costUsd,
      valid: call.proposal != null && !empty,
      ...(call.proposal == null && call.rawSnippet != null
        ? { rawSnippet: call.rawSnippet }
        : {}),
      ...(call.finishReason != null ? { finishReason: call.finishReason } : {}),
      evaluation:
        evaluation == null
          ? null
          : {
              coverage: evaluation.coverage,
              dupSeeds: evaluation.dupSeeds,
              clusters: evaluation.clusters,
              ...(evaluation.deadlock != null
                ? { deadlock: evaluation.deadlock }
                : {}),
            },
      proposal: call.proposal,
    });
    evals.push(evaluation);
  }
  const stabilityJaccard =
    evals[0] != null && evals[1] != null ? stability(evals[0], evals[1]) : null;
  return {
    fixture: fixture.name,
    freshArticles: fixture.freshArticles.length,
    liveStories: fixture.liveStories.length,
    runs,
    stability: stabilityJaccard,
  };
}

async function runCandidate(
  spec: string,
  set: FixtureSet,
): Promise<CandidateRecord> {
  // `<spec>:chunked<size>` answers the fresh batch in fixed-size pages
  // (the large-pass lever, issue #41) — the file name keeps the suffix so
  // chunked and single-call records coexist in the report.
  const chunk = /:chunked(\d+)$/.exec(spec);
  const inner = benchmarkGroupingModel(
    chunk != null ? spec.slice(0, chunk.index) : spec,
  );
  const model =
    chunk != null ? chunkedGroupingModel(inner, Number(chunk[1])) : inner;
  console.log(
    `${model.spec}: ${set.fixtures.length} fixtures × 2 runs (builtAt ${set.builtAt})`,
  );
  const fixtures: FixtureResult[] = [];
  for (const fixture of set.fixtures) {
    console.log(
      `  ${fixture.name}: ${fixture.freshArticles.length} fresh Articles, ${fixture.liveStories.length} live Stories`,
    );
    const result = await runFixture(model, fixture);
    const validRuns = result.runs.filter(
      (r) => r.valid && r.evaluation != null,
    );
    const best = validRuns.reduce(
      (a, b) =>
        b.evaluation!.coverage.covered > a.evaluation!.coverage.covered ? b : a,
      validRuns[0],
    );
    if (best?.evaluation) {
      const c = best.evaluation.coverage;
      const cl = best.evaluation.clusters;
      const d = best.evaluation.deadlock;
      console.log(
        `    best of ${validRuns.length} valid runs: coverage ${c.covered}/${c.total}, dup-seeds ${best.evaluation.dupSeeds.length}, ` +
          `splits ${cl.splitGroups}/${cl.groundTruthGroups} groups, over-merged ${cl.overMergedPairs} pairs, ` +
          `stability ${result.stability == null ? 'n/a' : `${(result.stability * 100).toFixed(1)}%`}` +
          (d != null
            ? ` — deadlock → magnet ${d.toMagnet}, born ${d.born} (${d.birthClusters} cluster(s))`
            : ''),
      );
    }
    fixtures.push(result);
  }
  return {
    spec: model.spec,
    label: model.label,
    recordedAt: new Date().toISOString(),
    fixtureBuiltAt: set.builtAt,
    fixtures,
  };
}

function fileName(spec: string): string {
  return `${spec.replaceAll('/', '__')}.json`;
}

/** Aggregated metrics over the valid runs of one fixture. */
function summarize(result: FixtureResult): {
  validRuns: number;
  coverage: number | null;
  dupSeeds: number;
  splitGroups: number | null;
  groundTruthGroups: number;
  overMergedPairs: number | null;
  keptPairs: number | null;
  splitPairs: number | null;
  unknownTargets: number;
  /** The deadlock fixture only (issue #149): null on the standard fixtures. */
  deadlock: DeadlockMetrics | null;
  avgLatencyMs: number;
  avgInputTokens: number;
  avgCostUsd: number | null;
} | null {
  const valid = result.runs.filter((r) => r.valid && r.evaluation != null);
  if (valid.length === 0) return null;
  // Best valid run by coverage: an otherwise valid run can still miss
  // assignments, and the comparison should not inherit the worst run.
  const best = valid.reduce((a, b) =>
    b.evaluation!.coverage.covered > a.evaluation!.coverage.covered ? b : a,
  );
  const cov = best.evaluation!.coverage;
  const cl = best.evaluation!.clusters;
  const dupSeeds = Math.max(...valid.map((r) => r.evaluation!.dupSeeds.length));
  const avg = (f: (r: FixtureRun) => number) =>
    valid.reduce((s, r) => s + f(r), 0) / valid.length;
  const costs = valid
    .map((r) => r.costUsd)
    .filter((c): c is number => c != null);
  return {
    validRuns: valid.length,
    coverage: cov.total > 0 ? cov.covered / cov.total : null,
    dupSeeds,
    splitGroups: cl.groundTruthGroups > 0 ? cl.splitGroups : null,
    groundTruthGroups: cl.groundTruthGroups,
    overMergedPairs: cl.overMergedPairs,
    keptPairs: cl.keptPairs,
    splitPairs: cl.splitPairs,
    unknownTargets: cov.unknownTarget.length,
    deadlock: best.evaluation?.deadlock ?? null,
    avgLatencyMs: avg((r) => r.latencyMs),
    avgInputTokens: avg((r) => r.inputTokens),
    avgCostUsd: costs.length > 0 ? avg((r) => r.costUsd ?? 0) : null,
  };
}

function fmtPct(x: number | null): string {
  return x == null ? '—' : `${(x * 100).toFixed(1)}%`;
}

function fmtUsd(x: number | null): string {
  if (x == null) return 'free tier';
  return x < 0.01 ? `$${x.toFixed(4)}` : `$${x.toFixed(2)}`;
}

async function writeReport(records: CandidateRecord[]): Promise<void> {
  const lines: string[] = [
    '# Grouping benchmark results (issue #41)',
    '',
    `Regenerated from .benchmark/grouping/results/*.json — the standard fixtures build from data/ at edition ${records[0]?.fixtureBuiltAt ?? 'n/a'}; the deadlock fixture is pinned to the 2026-10-24T23:01:20Z build (issue #149).`,
    '',
    'Metrics per fixture (best valid run): coverage = fresh Articles with exactly one valid assignment; dup-seeds = proposed new Stories whose seed overlaps >50% content tokens with a live Story; splits = ground-truth groups (≥2 fresh Articles from the same snapshot Story) landing in more than one cluster; over-merged = pairs from different snapshot Stories co-clustered; stability = Jaccard of co-clustering pair sets across the two runs.',
    '',
    'Deadlock fixture (issue #149): the reconstructed 2026-10-24 deadlock state — the live Stories of the day’s last build (the tribunal-ruling magnet among them) plus the day’s 69 fresh march Articles that stayed Unassigned through every build. « → magnet » counts fresh Articles re-assigned to the magnet Story (the production loop shape); « born » counts fresh Articles proposed into a new Story of ≥2 Articles (the birth). The baseline verdict and its caveats live in docs/research/grouping-benchmark.md.',
    '',
  ];
  for (const record of records) {
    lines.push(`## ${record.spec}`, '');
    lines.push(
      '| fixture | fresh | live Stories | coverage | → magnet | born | bad targets | dup-seeds | splits | kept/split pairs | over-merged | stability | latency | input tok | cost/run |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    );
    for (const fr of record.fixtures) {
      const s = summarize(fr);
      if (s == null) {
        lines.push(
          `| ${fr.fixture} | ${fr.freshArticles} | ${fr.liveStories} | — (no valid run) | — | — | — | — | — | — | — | — | — | — | — |`,
        );
        continue;
      }
      const deadlockCells =
        s.deadlock == null
          ? '— | —'
          : `${s.deadlock.toMagnet} | ${s.deadlock.born} (${s.deadlock.birthClusters})`;
      lines.push(
        `| ${fr.fixture} | ${fr.freshArticles} | ${fr.liveStories} | ${fmtPct(s.coverage)} | ${deadlockCells} | ${s.unknownTargets} | ${s.dupSeeds} | ` +
          `${s.splitGroups == null ? '—' : `${s.splitGroups}/${s.groundTruthGroups} groups`} | ` +
          `${s.keptPairs ?? '—'}/${s.splitPairs ?? '—'} | ${s.overMergedPairs ?? '—'} | ` +
          `${fmtPct(fr.stability)} | ${Math.round(s.avgLatencyMs)} ms | ${Math.round(s.avgInputTokens)} | ${fmtUsd(s.avgCostUsd)} |`,
      );
    }
    lines.push('');
  }
  await writeFile(new URL('report.md', OUT_DIR), lines.join('\n'), 'utf8');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  // `--only <csv>` restricts a paid run to part of the fixture set —
  // e.g. `--only long-context,deadlock` when from-empty's current size
  // (every Article in the snapshot) cannot complete under the output cap.
  const onlyIndex = args.indexOf('--only');
  let only: Set<GroupingFixture['name']> | null = null;
  if (onlyIndex !== -1) {
    const value = args[onlyIndex + 1];
    args.splice(onlyIndex, 2);
    if (
      value == null ||
      value.startsWith('gemini/') ||
      value.startsWith('openrouter/')
    ) {
      console.error('--only needs a comma-separated fixture list');
      process.exit(1);
    }
    only = new Set(
      value
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean) as GroupingFixture['name'][],
    );
  }
  const specs = args;
  if (specs.length === 0) {
    console.error(
      'Usage: tsx src/benchmark/grouping-run.ts [--only from-empty,long-context,deadlock] <gemini|openrouter>/<model> [...]',
    );
    process.exit(1);
  }
  await mkdir(new URL('results/', OUT_DIR), { recursive: true });
  const full = await fixturesFromData();
  await writeFile(
    new URL('fixtures.json', OUT_DIR),
    JSON.stringify(full, null, 2),
    'utf8',
  );
  const unknown =
    only == null
      ? []
      : [...only].filter((name) => !full.fixtures.some((f) => f.name === name));
  if (unknown.length > 0) {
    console.error(
      `Unknown fixtures: ${unknown.join(', ')} — available: ${full.fixtures.map((f) => f.name).join(', ')}`,
    );
    process.exit(1);
  }
  const set =
    only == null
      ? full
      : { ...full, fixtures: full.fixtures.filter((f) => only!.has(f.name)) };
  for (const spec of specs) {
    const record = await runCandidate(spec, set);
    const path = new URL(`results/${fileName(spec)}`, OUT_DIR);
    await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    console.log(`  recorded → ${path.pathname}`);
  }
  // Report aggregates every recorded candidate, oldest spec first by name —
  // reruns with new models extend the same comparison.
  const files = (await readdir(new URL('results/', OUT_DIR))).filter((f) =>
    f.endsWith('.json'),
  );
  const records: CandidateRecord[] = [];
  for (const f of files) {
    records.push(
      JSON.parse(
        await readFile(new URL(`results/${f}`, OUT_DIR), 'utf8'),
      ) as CandidateRecord,
    );
  }
  await writeReport(records);
  console.log(`report → ${new URL('report.md', OUT_DIR).pathname}`);
}

if (
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
