import { readFile, writeFile } from 'node:fs/promises';
import {
  clefFlashModel,
  jevModel,
  type ArticleKind,
  type Classification,
  type DecisionModel,
  type Section,
} from '../decision-model.ts';

/**
 * Benchmark grader (issue #4): runs each configured decision model over the
 * hand-labeled sample and writes docs/research/decision-model-benchmark.md.
 *
 * Keys come from the local env, never the repo: JEV_API_KEY for Jev,
 * CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID for Clef-flash. A missing key
 * skips that model with a note. State is headline + teaser only — the same
 * input the pipeline will use in production (no URL, no article page).
 *
 * Winner rule (settled in the #4 grilling): not_news precision first (never
 * wrongly drop a real Article), then kind accuracy, then section accuracy;
 * cost and latency only as tie-breaks.
 */

const BENCHMARK_DIR = new URL('../../../.benchmark/', import.meta.url);
const LABELS_PATH = new URL('../../../docs/research/decision-model-labels.json', import.meta.url);
const DOC_PATH = new URL('../../../docs/research/decision-model-benchmark.md', import.meta.url);

/** USD per input token; output is free for both models. */
const COST_PER_INPUT_TOKEN = { Jev: 0.042e-6, 'Clef-flash': 0.09e-6 } as const;

const CONCURRENCY = 4;
const KINDS: ArticleKind[] = ['news', 'opinion', 'live', 'not_news'];
const INVALID = '(invalid)';

interface LabeledItem {
  id: string;
  url: string;
  outletId: string;
  feed: string;
  suspect: boolean;
  kind: ArticleKind | null;
  section: Section | null;
}

interface SampleItem {
  id: string;
  headline: string;
  teaser: string;
}

interface Attempt {
  model: string;
  id: string;
  classification: Classification | null;
}

interface Summary {
  model: string;
  total: number;
  confusion: Record<string, Record<string, number>>;
  kindAccuracy: number;
  notNewsPrecision: number | null;
  notNewsRecall: number | null;
  sectionAccuracy: number;
  invalidRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  inputTokens: number;
  costUsd: number;
}

function modelsFromEnv(): DecisionModel[] {
  const models: DecisionModel[] = [];
  if (process.env.JEV_API_KEY) models.push(jevModel(process.env.JEV_API_KEY));
  else console.warn('JEV_API_KEY not set — skipping Jev.');
  if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
    models.push(
      clefFlashModel(process.env.CLOUDFLARE_API_TOKEN, process.env.CLOUDFLARE_ACCOUNT_ID),
    );
  } else {
    console.warn('CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID not set — skipping Clef-flash.');
  }
  return models;
}

async function main(): Promise<void> {
  const labels = JSON.parse(await readFile(LABELS_PATH, 'utf8')) as { items: LabeledItem[] };
  const samples = JSON.parse(await readFile(new URL('samples.json', BENCHMARK_DIR), 'utf8')) as {
    seed: number;
    sampledAt: string;
    items: SampleItem[];
  };
  const pairs = new Map(samples.items.map((item) => [item.id, item]));
  const items = labels.items.filter((item) => item.kind != null);
  const missing = items.filter((item) => !pairs.has(item.id));
  if (missing.length > 0) {
    console.error(
      `${missing.length} labeled items have no cached pair (stale .benchmark/samples.json). ` +
        `Re-run pnpm benchmark:export with the same seed, or re-label.`,
    );
    process.exit(1);
  }

  const models = modelsFromEnv();
  if (models.length === 0) {
    console.error('No model credentials found in env; nothing to grade.');
    process.exit(1);
  }

  const results: { model: string; attempts: Attempt[] }[] = [];
  for (const model of models) {
    console.log(`Grading ${model.label} over ${items.length} labeled pairs…`);
    const attempts: Attempt[] = new Array(items.length);
    let index = 0;
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (index < items.length) {
          const i = index++;
          const item = items[i]!;
          const pair = pairs.get(item.id)!;
          let classification: Classification | null = null;
          try {
            classification = await model.classify({ headline: pair.headline, teaser: pair.teaser });
          } catch (reason) {
            console.warn(
              `${model.label} failed on ${item.id}: ${reason instanceof Error ? reason.message : reason}`,
            );
          }
          attempts[i] = { model: model.label, id: item.id, classification };
        }
      }),
    );
    results.push({ model: model.label, attempts });
  }

  const summaries = results.map((r) => summarize(items, r.attempts));
  await writeFile(new URL('results.json', BENCHMARK_DIR), JSON.stringify({ results }, null, 2) + '\n');
  await writeFile(DOC_PATH, render(items.length, summaries, samples));
  console.log('Wrote docs/research/decision-model-benchmark.md and .benchmark/results.json');
}

function summarize(items: LabeledItem[], attempts: Attempt[]): Summary {
  const confusion: Record<string, Record<string, number>> = {};
  let correct = 0;
  let sectionScored = 0;
  let sectionCorrect = 0;
  let invalid = 0;
  const latencies: number[] = [];
  let inputTokens = 0;
  // not_news confusion: TP = label not_news & predicted not_news,
  // FP = label not not_news & predicted not_news, FN = the reverse.
  let tp = 0;
  let fp = 0;
  let fn = 0;

  items.forEach((item, i) => {
    const label = item.kind!;
    const predicted = attempts[i]!.classification?.kind ?? null;
    confusion[label] ??= {};
    if (predicted == null) {
      invalid++;
      confusion[label][INVALID] = (confusion[label][INVALID] ?? 0) + 1;
    } else {
      confusion[label][predicted] = (confusion[label][predicted] ?? 0) + 1;
      if (predicted === label) correct++;
    }
    if (label === 'not_news') {
      if (predicted === 'not_news') tp++;
      else fn++;
    } else if (predicted === 'not_news') {
      fp++;
    }
    if (item.section != null && label !== 'not_news') {
      sectionScored++;
      if (attempts[i]!.classification?.section === item.section) sectionCorrect++;
    }
    const classification = attempts[i]!.classification;
    latencies.push(classification?.elapsedMs ?? 0);
    inputTokens += classification?.inputTokens ?? 0;
  });

  const model = attempts[0]?.model ?? 'unknown';
  latencies.sort((a, b) => a - b);
  return {
    model,
    total: items.length,
    confusion,
    kindAccuracy: correct / items.length,
    notNewsPrecision: tp + fp > 0 ? tp / (tp + fp) : null,
    notNewsRecall: tp + fn > 0 ? tp / (tp + fn) : null,
    sectionAccuracy: sectionScored > 0 ? sectionCorrect / sectionScored : 0,
    invalidRate: invalid / items.length,
    avgLatencyMs: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
    p95LatencyMs: latencies.length > 0 ? (latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] ?? 0) : 0,
    inputTokens,
    costUsd: inputTokens * (COST_PER_INPUT_TOKEN[model as keyof typeof COST_PER_INPUT_TOKEN] ?? 0),
  };
}

function render(total: number, summaries: Summary[], samples: { seed: number; sampledAt: string }): string {
  const lines: string[] = [
    '# Decision-model benchmark (issue #4)',
    '',
    `Sample: ${total} hand-labeled headline+teaser pairs, sampled ${samples.sampledAt} (seed ${samples.seed}), stratified across Outlets with rare kinds oversampled. Labeled blind — no model output touched the answer key; two borderline pairs (#57, #60) adjudicated by hand.`,
    '',
    'State sent to the models: headline + teaser only, one request carrying two `choice` questions (kind, section) — the same input and shape the pipeline will use in production.',
    '',
    'Winner rule: `not_news` precision first (a false not_news silently drops a real Article), then kind accuracy, then section accuracy; cost and latency only as tie-breaks.',
    '',
    '## Results',
    '',
    '| Model | Kind acc | not_news P | not_news R | Section acc | Invalid | Avg latency | p95 latency | Input tokens | Cost |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const s of summaries) {
    lines.push(
      `| ${s.model} | ${pct(s.kindAccuracy)} | ${pct(s.notNewsPrecision)} | ${pct(s.notNewsRecall)} | ${pct(s.sectionAccuracy)} | ${pct(s.invalidRate)} | ${s.avgLatencyMs} ms | ${s.p95LatencyMs} ms | ${s.inputTokens} | $${s.costUsd.toFixed(4)} |`,
    );
  }

  for (const s of summaries) {
    const columns = [...KINDS, ...(Object.values(s.confusion).some((row) => row[INVALID]) ? [INVALID] : [])];
    lines.push(
      '',
      `## ${s.model} — kind confusion matrix`,
      '',
      'Rows = hand label, columns = model prediction.',
      '',
      `| | ${columns.join(' | ')} |`,
      `| --- | ${columns.map(() => '---').join(' | ')} |`,
    );
    for (const label of KINDS) {
      if (s.confusion[label] == null) continue;
      lines.push(`| **${label}** | ${columns.map((c) => String(s.confusion[label][c] ?? 0)).join(' | ')} |`);
    }
  }

  const winner = pickWinner(summaries);
  lines.push(
    '',
    '## Decision',
    '',
    `Winner: **${winner.model}** — not_news precision ${pct(winner.notNewsPrecision)}, kind accuracy ${pct(winner.kindAccuracy)}, section accuracy ${pct(winner.sectionAccuracy)}.`,
    '',
    '## Reproduce',
    '',
    '```sh',
    'pnpm benchmark:export   # refresh the sample (seeded)',
    'pnpm benchmark:grade    # needs JEV_API_KEY and/or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in env',
    '```',
    '',
    'Keys live in the local env or GitHub Actions secrets only — never in the repo.',
    '',
  );
  return lines.join('\n');
}

function pickWinner(summaries: Summary[]): Summary {
  return [...summaries].sort((a, b) => {
    const p = (s: Summary) => s.notNewsPrecision ?? 0;
    if (p(b) !== p(a)) return p(b) - p(a);
    if (b.kindAccuracy !== a.kindAccuracy) return b.kindAccuracy - a.kindAccuracy;
    if (b.sectionAccuracy !== a.sectionAccuracy) return b.sectionAccuracy - a.sectionAccuracy;
    return a.costUsd - b.costUsd;
  })[0]!;
}

function pct(value: number | null): string {
  return value == null ? '—' : `${(value * 100).toFixed(1)}%`;
}

main();