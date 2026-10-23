import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Edition, Outlet, Story } from '@prisme/domain';
import { parseStoryFile, publicOutlets } from '@prisme/domain';

/**
 * data/ lives at the repo root (ADR-0002: the git repo is the database).
 * The pipeline writes it; Astro reads it at build time. Works both when the
 * build runs from the workspace root and from web/.
 */
async function readDataFile(relative: string): Promise<string> {
  const candidates = ['data', path.join('..', 'data')];
  for (const candidate of candidates) {
    try {
      return await readFile(
        path.resolve(process.cwd(), candidate, relative),
        'utf8',
      );
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
 * The « 7 jours » window of the Edition artifact (ADR-0027): Stories
 * covered by at least 10 Outlets publishing in the last 7 days, ranked
 * by that in-window Coverage. An absent `weekStories` reads as an empty
 * week — the committed snapshot predates the key, and a quiet week below
 * the floor is a real state too — rather than breaking the build.
 */
export async function loadWeekStories(): Promise<Story[]> {
  const edition = await loadEdition();
  return edition.weekStories ?? [];
}

/**
 * Every Story file on disk — live, below the Edition cut, and frozen (issue
 * #6 / ADR-0005): the files are the record (ADR-0002), and every one of them
 * has a page. A malformed or unreadable file is skipped with a warning, never
 * fatal: the rest of the archive stays usable.
 */
export async function loadAllStoryFiles(): Promise<Story[]> {
  for (const candidate of ['data', path.join('..', 'data')]) {
    const dir = path.resolve(process.cwd(), candidate, 'stories');
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
