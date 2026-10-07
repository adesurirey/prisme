import { mkdir, writeFile } from 'node:fs/promises';
import { outlets } from '@prisme/domain';
import { collect } from '../collect.ts';
import { fetchFeed } from '../http.ts';
import { groupStories, loadStories } from '../grouping.ts';
import {
  SUMMARIES_PROMPT_VERSION,
  geminiSummariesModel,
  updateSummaries,
  type SummaryModel,
} from '../summarize.ts';

/**
 * Flash-Lite vs Flash side-by-side (issue #7): one day of real Stories, both
 * models, same inputs, outputs recorded as Markdown in .benchmark/ (gitignored
 * — the outputs derive from teasers, which never enter git, ADR-0003).
 *
 * Usage: GEMINI_API_KEY=… pnpm --filter @prisme/pipeline exec tsx src/benchmark/summaries-side-by-side.ts [storyCount]
 * Results go into the PR and docs/research/summaries-model-comparison.md.
 */

const BENCHMARK_DIR = new URL('../../../.benchmark/', import.meta.url);
const DATA_DIR = new URL('../../data/', import.meta.url);
const STORIES_DIR = new URL('stories/', DATA_DIR);
/** The comparison model, pinned for traceability. */
const FLASH = 'gemini-3.5-flash';

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set — the side-by-side needs a key.');
    process.exit(1);
  }
  const storyCount = Number(process.argv[2] ?? '5');
  const now = new Date();

  // A real day: collect today's feeds, group exactly like a build, rank the
  // Edition — then take the top StoryCount live Stories as the corpus.
  const { articles, teasers } = await collect(outlets, fetchFeed, now);
  const existing = await loadStories(STORIES_DIR);
  const outcome = await groupStories({
    articles,
    teasers,
    existing,
    now,
    makeId: () => Math.random().toString(16).slice(2, 14),
    clients: { grouping: null, membership: null },
  });
  const outletById = new Map(outlets.map((o) => [o.id, o]));
  const live = outcome.stories.filter((s) =>
    s.articles.some((a) => Date.now() - Date.parse(a.publishedAt) < 24 * 3600_000),
  );
  const corpus = live
    .sort((a, b) => b.articles.length - a.articles.length)
    .slice(0, storyCount);

  const lines: string[] = [
    `# Summaries side-by-side — ${now.toISOString()}`,
    '',
    `Models: Flash-Lite (\`gemini-3.5-flash-lite\`, production) vs Flash (\`${FLASH}\`), prompt \`${SUMMARIES_PROMPT_VERSION}\`.`,
    `Corpus: ${corpus.length} live Stories from today's collection.`,
    '',
  ];

  for (const story of corpus) {
    const results = await Promise.all(
      [
        { label: 'Flash-Lite', model: 'gemini-3.5-flash-lite' },
        { label: 'Flash', model: FLASH },
      ].map(async ({ label, model }) => {
        const client: SummaryModel = geminiSummariesModel(apiKey, model, label);
        const working: typeof story = { ...story, summaries: undefined, differences: undefined, summarizedArticleCount: 0 };
        const started = Date.now();
        const outcome = await updateSummaries({
          stories: [working],
          teasers,
          outletById,
          model: client,
          promptVersion: SUMMARIES_PROMPT_VERSION,
        });
        return { label, model, ms: Date.now() - started, outcome, story: working };
      }),
    );

    lines.push(`## ${story.title} (${story.articles.length} Articles)`, '');
    for (const r of results) {
      lines.push(`### ${r.label} (\`${r.model}\`) — ${r.ms} ms, ${r.outcome.calls} call(s)`, '');
      for (const leaning of ['gauche', 'centre', 'droite'] as const) {
        const bullets = r.story.summaries?.[leaning];
        if (!bullets?.length) continue;
        lines.push(`**${leaning}**`, '', ...bullets.map((b) => `- ${b}`), '');
      }
      lines.push(`**Différences**`, '', r.story.differences ?? '_(échec)_', '');
    }
    lines.push('---', '');
    console.log(`Done: ${story.title}`);
  }

  await mkdir(BENCHMARK_DIR, { recursive: true });
  const path = new URL('summaries-side-by-side.md', BENCHMARK_DIR);
  await writeFile(path, lines.join('\n'));
  console.log(`Wrote ${path.pathname}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
