import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadTeaserCache,
  mergeTeasers,
  saveTeaserCache,
  type TeaserCache,
} from './teaser-cache.ts';

// Synthetic fixtures only — never real teaser text (ADR-0003).
let dirs: string[] = [];

afterEach(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
  dirs = [];
});

const tempPath = async (name: string): Promise<URL> => {
  const dir = await mkdtemp(`${tmpdir()}/teaser-cache-`);
  dirs.push(dir);
  return new URL(`${name}`, new URL(`file://${dir}/`));
};

describe('loadTeaserCache', () => {
  it('reads back what saveTeaserCache wrote', async () => {
    const path = await tempPath('teasers.json');
    const cache: TeaserCache = { a1: 'Teaser un', a2: 'Teaser deux' };
    await saveTeaserCache(cache, path);
    expect(await loadTeaserCache(path)).toEqual(cache);
  });

  it('returns an empty cache for a missing file', async () => {
    const path = await tempPath('teasers.json');
    expect(await loadTeaserCache(path)).toEqual({});
  });

  it('tolerates a corrupt file: empty cache, no throw', async () => {
    const path = await tempPath('teasers.json');
    await writeFile(path, '{not json at all');
    expect(await loadTeaserCache(path)).toEqual({});
  });

  it('tolerates a file that is not an object', async () => {
    const path = await tempPath('teasers.json');
    await writeFile(path, '["a1"]');
    expect(await loadTeaserCache(path)).toEqual({});
  });
});

describe('mergeTeasers', () => {
  it('accumulates new ids and never overwrites an existing entry', () => {
    const cache: TeaserCache = { a1: 'Teaser originel' };
    const merged = mergeTeasers(
      cache,
      new Map([
        ['a1', 'Teaser nouveau'],
        ['a2', 'Teaser deux'],
      ]),
    );
    expect(merged).toEqual({ a1: 'Teaser originel', a2: 'Teaser deux' });
  });

  it('is pure: the input cache is not mutated', () => {
    const cache: TeaserCache = { a1: 'Teaser un' };
    mergeTeasers(cache, new Map([['a2', 'Teaser deux']]));
    expect(cache).toEqual({ a1: 'Teaser un' });
  });

  it('keeps aged entries that the current collection no longer sees', () => {
    const cache: TeaserCache = {
      aged: 'Teaser vieilli',
      fresh: 'Teaser frais',
    };
    const merged = mergeTeasers(cache, new Map([['fresh', 'Teaser frais']]));
    expect(merged).toEqual(cache);
  });
});

describe('saveTeaserCache', () => {
  it('creates the cache directory if it does not exist', async () => {
    const dir = await mkdtemp(`${tmpdir()}/teaser-cache-`);
    dirs.push(dir);
    const path = new URL('nested/teasers.json', new URL(`file://${dir}/`));
    await saveTeaserCache({ a1: 'Teaser un' }, path);
    expect(JSON.parse(await readFile(fileURLToPath(path), 'utf8'))).toEqual({
      a1: 'Teaser un',
    });
  });
});
