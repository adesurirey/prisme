import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { Edition, Story } from '@prisme/domain';
import { coverageCounts, outlets } from '@prisme/domain';
import { collect } from '../collect.ts';
import { fetchFeed } from '../http.ts';
import {
  geminiSummariesModel,
  SUMMARIES,
  SUMMARIES_PROMPT_VERSION,
  updateSummaries,
} from '../summarize.ts';

/**
 * Prompt A/B for the Differences reshape (sum-6, issue: "a bullet per
 * Leaning"): the biggest live Story of the last Edition, the stored sum-5
 * Summaries (what readers see now) vs a fresh sum-6 run on the same Story,
 * same model (Flash-Lite). Outputs recorded as Markdown in .benchmark/
 * (gitignored — the output derives from teasers, which never enter git,
 * ADR-0003).
 *
 * The two runs share the same input shape (whole Article set, headlines +
 * teasers from the current feeds' window), but the stored sum-5 block was
 * written by the last build from that build's teaser window: near-identical
 * inputs, not byte-identical — good enough for a reading comparison.
 *
 * Usage: GEMINI_API_KEY=… pnpm --filter @prisme/pipeline exec tsx src/benchmark/summaries-prompt-ab.ts [storyIdOrSlug]
 * Default Story: the live one with the most Articles.
 */

const BENCHMARK_DIR = new URL('../../../.benchmark/', import.meta.url);
// Two levels deeper than run.ts: this script lives in pipeline/src/benchmark/.
const DATA_DIR = new URL('../../../data/', import.meta.url);

function renderSummaries(story: Story): string[] {
  const lines: string[] = [];
  for (const leaning of ['gauche', 'centre', 'droite'] as const) {
    const bullets = story.summaries?.[leaning];
    if (!bullets?.length) continue;
    lines.push(`**${leaning}**`, '', ...bullets.map((b) => `- ${b}`), '');
  }
  return lines;
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set — the A/B needs a key.');
    process.exit(1);
  }
  const arg = process.argv[2];
  const now = new Date();

  // The corpus is the real, classified Edition written by the last build —
  // re-grouping here would run without the Decision model, and unclassified
  // Articles have no Kind, hence no Coverage, hence no Summaries.
  const edition: Edition = JSON.parse(
    await readFile(new URL('edition.json', DATA_DIR), 'utf8'),
  );
  const live = edition.stories.filter(
    (s) => s.summaries != null && s.differences != null,
  );
  const story = arg
    ? live.find((s) => s.id === arg || s.slug === arg)
    : live.reduce((a, b) => (b.articles.length > a.articles.length ? b : a));
  if (story == null) {
    console.error(`Story not found${arg ? `: ${arg}` : ' (no live Story)'}.`);
    process.exit(1);
  }

  const { teasers } = await collect(outlets, fetchFeed, now);
  const outletById = new Map(outlets.map((o) => [o.id, o]));
  const counts = coverageCounts(story.articles, outletById);
  const composition = (['gauche', 'centre', 'droite'] as const)
    .map((l) => `${l} ${counts[l]}`)
    .join(', ');

  // Fresh sum-6 run on the same Story, same production model, no budget.
  const working: typeof story = {
    ...story,
    summaries: undefined,
    differences: undefined,
    summarizedArticleCount: 0,
  };
  const started = Date.now();
  const outcome = await updateSummaries({
    stories: [working],
    now,
    teasers,
    outletById,
    model: geminiSummariesModel(apiKey, SUMMARIES.model, SUMMARIES.label),
    promptVersion: SUMMARIES_PROMPT_VERSION,
  });

  const lines: string[] = [
    `# Summaries prompt A/B — stored sum-5 vs ${SUMMARIES_PROMPT_VERSION} — ${now.toISOString()}`,
    '',
    `Model: ${SUMMARIES.label} (\`${SUMMARIES.model}\`).`,
    `Corpus: « ${story.title} » — ${story.articles.length} Articles (coverage: ${composition}).`,
    '',
    '## Baseline — sum-5 (stored Edition output)',
    '',
    ...renderSummaries(story),
    '**Différences**',
    '',
    ...(story.differences?.length
      ? story.differences.map((b) => `- ${b}`)
      : ['_(échec)_']),
    '',
    `## Candidate — ${SUMMARIES_PROMPT_VERSION} (fresh run)`,
    '',
    `_\`${outcome.calls} call(s)\`, ${Date.now() - started} ms_`,
    '',
    ...renderSummaries(working),
    '**Différences**',
    '',
    ...(working.differences?.length
      ? working.differences.map((b) => `- ${b}`)
      : ['_(échec)_']),
    '',
  ];

  await mkdir(BENCHMARK_DIR, { recursive: true });
  // One file per Story: repeated runs accumulate instead of overwriting.
  const path = new URL(`summaries-prompt-ab-${story.slug}.md`, BENCHMARK_DIR);
  await writeFile(path, lines.join('\n'));
  console.log(`Wrote ${path.pathname}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
