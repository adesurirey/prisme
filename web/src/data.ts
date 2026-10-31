import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Edition, Outlet, Story } from '@prisme/domain';
import { parseStoryFile, publicOutlets } from '@prisme/domain';

/**
 * data/ lives at the repo root (ADR-0002: the git repo is the database).
 * The pipeline writes it; Astro reads it at build time. Works both when the
 * build runs from the workspace root and from web/.
 *
 * PRISME_DATA_DIR (test infrastructure): an absolute path to a fixture
 * dataset that replaces the repo's data/ for one build — the build-output
 * tests (build-output.test.ts) point it at web/test-data so they assert on
 * a committed, deterministic Edition instead of the hourly-changing
 * archive. Unset in every real build: the site always reads data/.
 */
function dataCandidates(relative: string): string[] {
  const override = process.env.PRISME_DATA_DIR;
  if (override != null) return [path.resolve(override, relative)];
  return ['data', path.join('..', 'data')].map((candidate) =>
    path.resolve(process.cwd(), candidate, relative),
  );
}

async function readDataFile(relative: string): Promise<string> {
  const candidates = dataCandidates(relative);
  for (const candidate of candidates) {
    try {
      return await readFile(candidate, 'utf8');
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error(
    `data file not found: ${relative} (looked in ${candidates.join(', ')})`,
  );
}

export async function loadEdition(): Promise<Edition> {
  return JSON.parse(await readDataFile('edition.json'));
}

/**
 * The « Le fil » window of the Edition artifact (ADR-0036): every Story
 * with an Article in the rolling last 24 hours — « Aujourd'hui »'s pool,
 * re-ranked by the coverage-weighted feed key (rankStoriesFeed). The
 * pipeline always writes the key; the reader requires it.
 */
export async function loadFeedStories(): Promise<Story[]> {
  const edition = await loadEdition();
  return edition.feedStories;
}

/**
 * The « En direct » window of the Edition artifact (ADR-0029): every Story
 * founded within the rolling last 12 hours, ranked latest-first. The
 * pipeline always writes the key; the reader requires it.
 */
export async function loadLatestStories(): Promise<Story[]> {
  const edition = await loadEdition();
  return edition.latestStories;
}

/**
 * Every Story file on disk — live, below the Edition cut, and frozen (issue
 * #6 / ADR-0005): the files are the record (ADR-0002), and every one of them
 * has a page. A malformed or unreadable file is skipped with a warning, never
 * fatal: the rest of the archive stays usable.
 */
export async function loadAllStoryFiles(): Promise<Story[]> {
  for (const dir of dataCandidates('stories')) {
    let names: string[];
    try {
      names = (await readdir(dir)).filter((name) => name.endsWith('.json'));
    } catch {
      continue;
    }
    const stories: Story[] = [];
    for (const name of names) {
      try {
        const raw = JSON.parse(await readFile(path.join(dir, name), 'utf8'));
        const story = parseStoryFile(raw, name);
        if (story != null) stories.push(story);
      } catch {
        console.warn(`Skipping unreadable story file: ${name}`);
      }
    }
    return stories;
  }
  return [];
}

/**
 * The Outlet config is a typed module both the pipeline and the site import
 * (issue #2), so the site does not depend on the data/ snapshot for it.
 */
export function loadOutlets(): Outlet[] {
  return publicOutlets();
}

export async function loadStory(slug: string): Promise<Story | undefined> {
  try {
    return (
      parseStoryFile(
        JSON.parse(await readDataFile(`stories/${slug}.json`)),
        `${slug}.json`,
      ) ?? undefined
    );
  } catch {
    return undefined;
  }
}

/** Link helper for the GitHub Pages base path. */
export function withBase(p: string): string {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}${p}`;
}
