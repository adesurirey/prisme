/**
 * Grader for the grouping sanity sample (issue #41).
 *
 *   pnpm benchmark:grouping-grade
 *
 * Reads .benchmark/grouping/labels/pairs.json (sampled pairs + verdicts)
 * and writes two things:
 *
 *   docs/research/grouping-labels.json — committed, ids + verdicts only
 *   (the ADR-0003 pattern: headline text stays in gitignored .benchmark/)
 *
 * and prints the verdict: per (model, bucket) agreement between the human
 * and the snapshot's clustering. Buckets where the human sides with the
 * snapshot say the pseudo-ground-truth is straight; buckets where the
 * human sides with the candidates call for a justified-disagreement
 * correction before any replacement decision.
 *
 * Pure local arithmetic — no model calls, no data/ read: the pair rows in
 * pairs.json carry everything.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { LABELS_DIR } from './grouping-paths.ts';

const LABELS_DOC_PATH = new URL(
  '../../../docs/research/grouping-labels.json',
  import.meta.url,
);

type Bucket = 'split' | 'over-merge' | 'control-same' | 'control-different';

interface SampledPair {
  id: string;
  fixture: string;
  entries: { model: string; bucket: Bucket }[];
  verdict: 'same' | 'different' | 'unsure' | null;
}

/** What the snapshot's clustering claims about a pair, by bucket. */
const KEY_CLAIM: Record<Bucket, 'same' | 'different'> = {
  split: 'same',
  'over-merge': 'different',
  'control-same': 'same',
  'control-different': 'different',
};

async function main() {
  const data = JSON.parse(
    await readFile(new URL('pairs.json', LABELS_DIR), 'utf8'),
  ) as { builtAt: string; pairs: SampledPair[] };
  const pairs = data.pairs;
  const unlabeled = pairs.filter((p) => p.verdict == null);
  if (unlabeled.length > 0) {
    console.error(
      `${unlabeled.length} pair(s) unlabeled (${unlabeled
        .slice(0, 5)
        .map((p) => p.id)
        .join(' ')}…) — fill verdicts first.`,
    );
    process.exitCode = 1;
    return;
  }
  // Attribution: one human label serves every (model, bucket) the pair
  // was sampled for (a pair both models clash on gets one verdict).
  const cells = new Map<
    string,
    { agree: number; unsure: number; total: number }
  >();
  for (const pair of pairs) {
    for (const entry of pair.entries) {
      const key = `${entry.model} ${entry.bucket}`;
      const cell = cells.get(key) ?? { agree: 0, unsure: 0, total: 0 };
      cell.total++;
      if (pair.verdict === 'unsure') cell.unsure++;
      else if (pair.verdict === KEY_CLAIM[entry.bucket]) cell.agree++;
      cells.set(key, cell);
    }
  }
  const rows = [...cells.entries()].sort(([a], [b]) => a.localeCompare(b));
  console.log(
    `\nHuman vs snapshot clustering (${pairs.length} pairs, seed 41):\n`,
  );
  console.log(
    '| model | bucket | snapshot claims | human agrees | n (unsure) |',
  );
  console.log('| --- | --- | --- | --- | --- |');
  for (const [key, cell] of rows) {
    const [model, bucket] = key.split(' ');
    const rate =
      cell.total - cell.unsure > 0
        ? `${Math.round((cell.agree / (cell.total - cell.unsure)) * 100)}%`
        : '—';
    console.log(
      `| ${model} | ${bucket} | ${KEY_CLAIM[bucket as Bucket]} | ${rate} | ${cell.total}${cell.unsure > 0 ? ` (${cell.unsure} unsure)` : ''} |`,
    );
  }
  // Justified-disagreement counts: disagreements with the snapshot that the
  // human ratified — the correction the decision metrics need.
  let justified = 0;
  let ratified = 0;
  for (const pair of pairs) {
    for (const entry of pair.entries) {
      if (entry.bucket === 'split' || entry.bucket === 'over-merge') {
        if (pair.verdict === 'unsure') continue;
        if (pair.verdict === KEY_CLAIM[entry.bucket]) ratified++;
        else justified++;
      }
    }
  }
  console.log(
    `\nDisagreement pairs: human ratified the snapshot ${ratified}×, sided with the candidate ${justified}×.`,
  );
  await writeFile(
    LABELS_DOC_PATH,
    JSON.stringify(
      {
        instructions:
          'Hand labels for the grouping sanity sample (issue #41): verdicts on whether two headlines belong in one Story. Ids only — pair text lives in gitignored .benchmark/grouping/labels/ (ADR-0003).',
        fixtureBuiltAt: data.builtAt,
        seed: 41,
        labels: Object.fromEntries(
          pairs.map((p) => [p.id, { verdict: p.verdict }]),
        ),
      },
      null,
      2,
    ),
  );
  console.log(`\nlabels → docs/research/grouping-labels.json`);
}

// CLI entrypoint only: importing this module must not read .benchmark/.
if (
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
