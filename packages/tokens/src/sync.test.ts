import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { buildTokens } from './build.ts';

/**
 * The sync contract (issue #178): the DTCG dictionary
 * (src/dictionary/color.json) is the single source of truth; both
 * checked-in artifacts are generated from it. These tests rebuild into a
 * temp dir and byte-compare, going red when the dictionary or either
 * artifact changes without regenerating — edit the dictionary, then run
 * `pnpm --filter @prisme/tokens generate`.
 */

const PKG = path.resolve(import.meta.dirname);

async function rebuildSomewhere(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'prisme-tokens-'));
  await buildTokens({ tsDir: dir, cssDir: dir });
  return dir;
}

test('checked-in src/tokens.ts matches the dictionary', async () => {
  const dir = await rebuildSomewhere();
  try {
    const regenerated = await readFile(path.join(dir, 'tokens.ts'), 'utf8');
    const checkedIn = await readFile(path.join(PKG, 'tokens.ts'), 'utf8');
    expect(
      regenerated,
      'src/tokens.ts is stale — regenerate with `pnpm --filter @prisme/tokens generate`',
    ).toBe(checkedIn);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('checked-in src/tokens.css matches the dictionary', async () => {
  const dir = await rebuildSomewhere();
  try {
    const regenerated = await readFile(path.join(dir, 'tokens.css'), 'utf8');
    const checkedIn = await readFile(path.join(PKG, 'tokens.css'), 'utf8');
    expect(
      regenerated,
      'src/tokens.css is stale — regenerate with `pnpm --filter @prisme/tokens generate`',
    ).toBe(checkedIn);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
