import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadRefusalCache,
  mergeRefusals,
  pruneRefusals,
  REFUSAL_TTL_MS,
  type RefusalLedger,
  saveRefusalCache,
} from './refusal-cache.ts';

// Ids and instants only — never headline or teaser text (ADR-0003).
let dirs: string[] = [];

afterEach(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
  dirs = [];
});

const tempPath = async (name: string): Promise<URL> => {
  const dir = await mkdtemp(`${tmpdir()}/refusal-cache-`);
  dirs.push(dir);
  return new URL(`${name}`, new URL(`file://${dir}/`));
};

const NOW = new Date('2026-10-24T14:00:00Z');

describe('loadRefusalCache', () => {
  it('reads back what saveRefusalCache wrote', async () => {
    const path = await tempPath('refusals.json');
    const ledger: RefusalLedger = {
      'a1|s1': '2026-10-24T10:00:00Z',
      'a2|s2': '2026-10-23T20:00:00Z',
    };
    await saveRefusalCache(ledger, path);
    expect(await loadRefusalCache(path, NOW)).toEqual(ledger);
  });

  it('returns an empty ledger for a missing file, with a warning — never a throw (issue #148)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const path = await tempPath('refusals.json');
    expect(await loadRefusalCache(path, NOW)).toEqual({});
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('tolerates a corrupt file: empty ledger, warning, no throw', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const path = await tempPath('refusals.json');
    await writeFile(path, '{not json at all');
    expect(await loadRefusalCache(path, NOW)).toEqual({});
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('tolerates a file that is not an object: empty ledger, warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const path = await tempPath('refusals.json');
    await writeFile(path, '["a1|s1"]');
    expect(await loadRefusalCache(path, NOW)).toEqual({});
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('prunes entries older than 48 h at load: the cache is bounded to ~2 days of pairs (issue #148)', async () => {
    const path = await tempPath('refusals.json');
    await saveRefusalCache(
      {
        'a1|s1': new Date(NOW.getTime() - REFUSAL_TTL_MS + 1).toISOString(),
        'a2|s2': new Date(NOW.getTime() - REFUSAL_TTL_MS - 1).toISOString(),
        'a3|s3': new Date(NOW.getTime() - 3 * 86_400_000).toISOString(),
      },
      path,
    );
    expect(await loadRefusalCache(path, NOW)).toEqual({
      'a1|s1': new Date(NOW.getTime() - REFUSAL_TTL_MS + 1).toISOString(),
    });
  });

  it('drops malformed entries at load instead of failing the build', async () => {
    const path = await tempPath('refusals.json');
    await writeFile(
      path,
      JSON.stringify({
        'a1|s1': '2026-10-24T10:00:00Z',
        'no-separator': '2026-10-24T10:00:00Z',
        '|s2': '2026-10-24T10:00:00Z',
        'a3|': '2026-10-24T10:00:00Z',
        'a4|s4': 'not an instant',
        'a5|s5': 42,
      }),
    );
    expect(await loadRefusalCache(path, NOW)).toEqual({
      'a1|s1': '2026-10-24T10:00:00Z',
    });
  });
});

describe('pruneRefusals', () => {
  it('keeps an entry at exactly 48 h and drops one just older — expiry is strictly after the TTL', () => {
    const at48h = new Date(NOW.getTime() - REFUSAL_TTL_MS).toISOString();
    const ledger: RefusalLedger = {
      'a1|s1': at48h,
      'a2|s2': new Date(NOW.getTime() - REFUSAL_TTL_MS - 1).toISOString(),
    };
    expect(pruneRefusals(ledger, NOW)).toEqual({ 'a1|s1': at48h });
  });

  it('is pure: the input ledger is not mutated', () => {
    const ledger: RefusalLedger = {
      'a2|s2': new Date(NOW.getTime() - REFUSAL_TTL_MS - 1).toISOString(),
    };
    pruneRefusals(ledger, NOW);
    expect(ledger).toEqual({
      'a2|s2': new Date(NOW.getTime() - REFUSAL_TTL_MS - 1).toISOString(),
    });
  });
});

describe('mergeRefusals', () => {
  it('adds this build’s refusals to the pruned ledger', () => {
    const prior: RefusalLedger = {
      'a1|s1': '2026-10-24T10:00:00Z',
      'a3|s3': new Date(NOW.getTime() - REFUSAL_TTL_MS - 1).toISOString(),
    };
    const merged = mergeRefusals(
      prior,
      new Map([['a2|s2', NOW.toISOString()]]),
      NOW,
    );
    expect(merged).toEqual({
      'a1|s1': '2026-10-24T10:00:00Z',
      'a2|s2': NOW.toISOString(),
    });
  });

  it('never overwrites: a pair already in the ledger keeps its original instant — a cached answer does not refresh the TTL', () => {
    const prior: RefusalLedger = { 'a1|s1': '2026-10-23T10:00:00Z' };
    const merged = mergeRefusals(
      prior,
      new Map([['a1|s1', NOW.toISOString()]]),
      NOW,
    );
    expect(merged).toEqual({ 'a1|s1': '2026-10-23T10:00:00Z' });
  });

  it('is pure: neither input is mutated', () => {
    const prior: RefusalLedger = { 'a1|s1': '2026-10-23T10:00:00Z' };
    const refusals = new Map([['a2|s2', NOW.toISOString()]]);
    mergeRefusals(prior, refusals, NOW);
    expect(prior).toEqual({ 'a1|s1': '2026-10-23T10:00:00Z' });
    expect([...refusals]).toEqual([['a2|s2', NOW.toISOString()]]);
  });
});
