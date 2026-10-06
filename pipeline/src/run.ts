import { mkdir, writeFile } from 'node:fs/promises';
import type { Edition } from '@prisme/domain';
import { collect } from './collect.ts';
import { buildEdition } from './edition.ts';
import { outlets } from './outlets.ts';

/**
 * data/ lives at the repo root: resolving `../../data/` from this file
 * (pipeline/src/) points at the repo root, so the pipeline runs the same from
 * anywhere (root, CI, editor).
 */
const DATA_DIR = new URL('../../data/', import.meta.url);

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function fetchFeed(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

export async function runEdition(): Promise<Edition> {
  const now = new Date();
  const { articles, failures } = await collect(outlets, fetchFeed, now);
  const edition = buildEdition(articles, now);

  console.log(
    `Edition: ${edition.stories.length} stories from ${articles.length} articles ` +
      `(${failures.length} feed failures).`,
  );

  await mkdir(new URL('stories/', DATA_DIR), { recursive: true });
  // Outlet config snapshot: the site reads it instead of importing pipeline code.
  await writeFile(new URL('outlets.json', DATA_DIR), JSON.stringify(outlets, null, 2) + '\n');
  await writeFile(new URL('edition.json', DATA_DIR), JSON.stringify(edition, null, 2) + '\n');
  for (const story of edition.stories) {
    await writeFile(
      new URL(`stories/${story.slug}.json`, DATA_DIR),
      JSON.stringify(story, null, 2) + '\n',
    );
  }
  console.log(`Wrote ${DATA_DIR.pathname}`);
  return edition;
}

runEdition().catch((error) => {
  console.error(error);
  process.exit(1);
});
