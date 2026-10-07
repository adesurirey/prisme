import { mkdir, writeFile } from 'node:fs/promises';
import { outlets } from '@prisme/domain';
import { articleId } from '../collect.ts';
import { parseFeed } from '../feeds.ts';
import { fetchFeed } from '../http.ts';
import {
  type BenchmarkCandidate,
  type SampledItem,
  sampleForBenchmark,
} from './sample.ts';

/**
 * Benchmark export (issue #4): samples real headline+teaser pairs from every
 * Outlet's feeds for hand labeling.
 *
 * Files:
 * - `.benchmark/` (gitignored, repo root): the pairs themselves — teaser text
 *   never enters git (ADR-0003). `samples.json` for the grader,
 *   `worksheet.md` for the human labeler.
 * - `docs/research/decision-model-labels.json` (committed): labels only,
 *   keyed by stable article id — ids and URLs, never feed text (settled in
 *   the #4 grilling).
 */

const BENCHMARK_DIR = new URL('../../../.benchmark/', import.meta.url);
const LABELS_PATH = new URL(
  '../../../docs/research/decision-model-labels.json',
  import.meta.url,
);

const SEED = 4;
const GENERAL_COUNT = 70;
const SUSPECT_COUNT = 40;

const KINDS = ['news', 'opinion', 'live', 'not_news'] as const;
const SECTIONS = [
  'politics',
  'world',
  'economy',
  'society',
  'sport',
  'culture',
  'science',
  'misc',
  'other',
] as const;

interface FeedFailure {
  outletId: string;
  feed: string;
  reason: string;
}

async function main(): Promise<void> {
  const candidates: BenchmarkCandidate[] = [];
  const failures: FeedFailure[] = [];
  const seen = new Set<string>();

  await Promise.all(
    outlets.map(async (outlet) => {
      const feeds = [outlet.feeds.une, outlet.feeds.latest].filter(
        (f): f is string => f != null,
      );
      await Promise.all(
        feeds.map(async (feed) => {
          try {
            for (const item of parseFeed(await fetchFeed(feed)).items) {
              if (!item.headline || !item.url) continue;
              const id = articleId(item.url);
              if (seen.has(id)) continue;
              seen.add(id);
              candidates.push({
                id,
                outletId: outlet.id,
                feed,
                url: item.url,
                headline: item.headline,
                teaser: item.teaser,
              });
            }
          } catch (reason) {
            const message =
              reason instanceof Error ? reason.message : String(reason);
            console.warn(`Feed failed: ${outlet.id} ${feed} — ${message}`);
            failures.push({ outletId: outlet.id, feed, reason: message });
          }
        }),
      );
    }),
  );

  const sample = sampleForBenchmark(candidates, {
    seed: SEED,
    generalCount: GENERAL_COUNT,
    suspectCount: SUSPECT_COUNT,
  });

  const sampledAt = new Date().toISOString();

  await mkdir(BENCHMARK_DIR, { recursive: true });
  await writeFile(
    new URL('samples.json', BENCHMARK_DIR),
    `${JSON.stringify(
      {
        sampledAt,
        seed: SEED,
        generalCount: GENERAL_COUNT,
        suspectCount: SUSPECT_COUNT,
        items: sample,
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    new URL('worksheet.md', BENCHMARK_DIR),
    worksheet(sample, sampledAt),
  );
  await writeFile(
    LABELS_PATH,
    `${JSON.stringify(
      {
        instructions:
          'Hand labels for the decision-model benchmark (issue #4). Fill kind and ' +
          'section for every item; kind null/section null means not yet labeled. ' +
          'Label blind: read each pair in .benchmark/worksheet.md (gitignored, ' +
          'ADR-0003 — no teaser text is committed here).',
        enums: { kind: KINDS, section: SECTIONS },
        sampledAt,
        seed: SEED,
        items: sample.map((item) => ({
          id: item.id,
          url: item.url,
          outletId: item.outletId,
          feed: item.feed,
          suspect: item.suspect,
          kind: null,
          section: null,
        })),
      },
      null,
      2,
    )}\n`,
  );

  const perOutlet = new Map<string, number>();
  for (const item of sample)
    perOutlet.set(item.outletId, (perOutlet.get(item.outletId) ?? 0) + 1);
  console.log(
    `Benchmark sample: ${sample.length} pairs ` +
      `(${sample.filter((s) => s.suspect).length} suspects) from ${perOutlet.size} Outlets ` +
      `of ${outlets.length}; ${candidates.length} candidates, ${failures.length} feed failures.`,
  );
  console.log(
    `Pairs to label: .benchmark/worksheet.md — labels: docs/research/decision-model-labels.json`,
  );
}

function worksheet(items: SampledItem[], sampledAt: string): string {
  const lines = [
    '# Benchmark labeling worksheet',
    '',
    `Sampled ${sampledAt} · seed ${SEED} · ${items.length} pairs.`,
    '',
    'Label each item in `docs/research/decision-model-labels.json`:',
    `- **kind**: ${KINDS.join(' | ')}`,
    `- **section**: ${SECTIONS.join(' | ')} (ignored for not_news)`,
    '',
    'The pairs below stay local: this file and samples.json are gitignored (ADR-0003).',
    '',
  ];
  items.forEach((item, i) => {
    lines.push(
      `## #${i + 1} — ${item.outletId} (${item.feed})${item.suspect ? ' · suspect' : ''}`,
      '',
      `**${item.headline}**`,
      '',
    );
    if (item.teaser) lines.push(`> ${item.teaser}`, '');
    lines.push(`<${item.url}>`, '', '---', '');
  });
  return lines.join('\n');
}

main();
