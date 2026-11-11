import { Directory, File, Paths } from 'expo-file-system';

import {
  ARTIFACT_CACHE_DIR,
  createDiskArtifactCache,
  rnFetchText,
} from './runtime';

function cacheDir(name: string): Directory {
  return new Directory(Paths.document, `${ARTIFACT_CACHE_DIR}-${name}`);
}

describe('createDiskArtifactCache', () => {
  it('round-trips the last good artifact and its etag', async () => {
    const dir = cacheDir('roundtrip');
    const cache = createDiskArtifactCache(dir, 'edition');

    await cache.write({ etag: '"v1"', body: '{"builtAt":"2026-11-11"}' });

    expect(await cache.read()).toEqual({
      etag: '"v1"',
      body: '{"builtAt":"2026-11-11"}',
    });
  });

  it('reads null from an empty cache', async () => {
    const cache = createDiskArtifactCache(cacheDir('empty'), 'edition');

    expect(await cache.read()).toBeNull();
  });

  it('treats a missing etag sidecar as no etag', async () => {
    const dir = cacheDir('no-etag');
    const cache = createDiskArtifactCache(dir, 'edition');
    await cache.write({ etag: '"v1"', body: 'body' });
    new File(dir, 'edition.json.etag').delete();

    expect(await cache.read()).toEqual({ etag: null, body: 'body' });
  });

  it('replaces the previous artifact on write', async () => {
    const cache = createDiskArtifactCache(cacheDir('replace'), 'edition');
    await cache.write({ etag: '"v1"', body: 'old' });

    await cache.write({ etag: '"v2"', body: 'new' });

    expect(await cache.read()).toEqual({ etag: '"v2"', body: 'new' });
  });
});

describe('rnFetchText', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function fakeFetch(status: number, body: string | null, etag: string | null) {
    return jest.fn().mockResolvedValue({
      status,
      headers: { get: (name: string) => (name === 'etag' ? etag : null) },
      text: async () => body ?? '',
    });
  }

  it('returns the body and etag of a 200', async () => {
    globalThis.fetch = fakeFetch(200, '{"builtAt":"x"}', '"v1"');

    const response = await rnFetchText(
      'https://example.test/edition.json',
      null,
    );

    expect(response).toEqual({
      status: 200,
      etag: '"v1"',
      body: '{"builtAt":"x"}',
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://example.test/edition.json',
      {
        headers: {},
      },
    );
  });

  it('sends the cached etag as If-None-Match', async () => {
    globalThis.fetch = fakeFetch(304, null, null);

    const response = await rnFetchText(
      'https://example.test/edition.json',
      '"v1"',
    );

    expect(response).toEqual({ status: 304, etag: null, body: null });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://example.test/edition.json',
      {
        headers: { 'If-None-Match': '"v1"' },
      },
    );
  });

  it('propagates network failures for the client to keep', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('plane mode'));

    await expect(
      rnFetchText('https://example.test/edition.json', null),
    ).rejects.toThrow('plane mode');
  });
});
