import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Edition, Outlet, Story } from '@prisme/domain';

/**
 * data/ lives at the repo root (ADR-0002: the git repo is the database).
 * The pipeline writes it; Astro reads it at build time. Works both when the
 * build runs from the workspace root and from web/.
 */
async function readDataFile(relative: string): Promise<string> {
  const candidates = ['data', path.join('..', 'data')];
  for (const candidate of candidates) {
    try {
      return await readFile(path.resolve(process.cwd(), candidate, relative), 'utf8');
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error(`data file not found: ${relative} (looked in ${candidates.join(', ')})`);
}

export async function loadEdition(): Promise<Edition> {
  return JSON.parse(await readDataFile('edition.json'));
}

export async function loadStories(): Promise<Story[]> {
  const edition = await loadEdition();
  return edition.stories;
}

export async function loadOutlets(): Promise<Outlet[]> {
  return JSON.parse(await readDataFile('outlets.json'));
}

export async function loadStory(slug: string): Promise<Story | undefined> {
  try {
    return JSON.parse(await readDataFile(`stories/${slug}.json`));
  } catch {
    return undefined;
  }
}

/** French display labels for Leanings. */
export const leaningLabels: Record<Outlet['leaning'], string> = {
  gauche: 'Gauche',
  centre: 'Centre',
  droite: 'Droite',
};

/** Link helper for the GitHub Pages base path. */
export function withBase(p: string): string {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}${p}`;
}
