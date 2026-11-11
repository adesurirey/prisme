import fixtureEdition from './__fixtures__/edition.json';
import fixtureOutlets from './__fixtures__/outlets.json';
import {
  type ArtifactCache,
  createEditionClient,
  type FetchResponse,
  type FetchText,
} from './edition-client';

/** In-memory stand-in for the disk cache: the seam the client is tested at. */
class MemoryCache implements ArtifactCache {
  stored: { etag: string | null; body: string } | null = null;

  async read(): Promise<{ etag: string | null; body: string } | null> {
    return this.stored == null ? null : { ...this.stored };
  }

  async write(artifact: { etag: string | null; body: string }): Promise<void> {
    this.stored = { ...artifact };
  }
}

function ok(body: string, etag: string): FetchResponse {
  return { status: 200, etag, body };
}

function notModified(): FetchResponse {
  return { status: 304, etag: null, body: null };
}

function editionBody(): string {
  return JSON.stringify(fixtureEdition);
}

function outletsBody(): string {
  return JSON.stringify(fixtureOutlets);
}

function setup() {
  const caches = { edition: new MemoryCache(), outlets: new MemoryCache() };
  const fetchText = jest.fn();
  const client = createEditionClient({
    baseUrl: 'https://example.test',
    fetchText,
    caches,
  });
  return { caches, client, fetchText };
}

describe('EditionClient.readCache', () => {
  it('returns the cached pair without touching the network', async () => {
    const { caches, client, fetchText } = setup();
    caches.edition.stored = { etag: '"v1"', body: editionBody() };
    caches.outlets.stored = { etag: '"o1"', body: outletsBody() };

    const snapshot = await client.readCache();

    expect(snapshot?.builtAt).toBe(fixtureEdition.builtAt);
    expect(snapshot?.edition.feedStories.map((story) => story.slug)).toEqual([
      'budget-2027-en-commission',
      'cyclone-veda-antilles',
    ]);
    expect(snapshot?.outlets.map((outlet) => outlet.name)).toEqual([
      "L'Obs",
      'Le Monde',
      'Le Figaro',
    ]);
    expect(fetchText).not.toHaveBeenCalled();
  });

  it('renders null unless the pair is complete and parseable', async () => {
    const { caches, client } = setup();
    caches.edition.stored = { etag: '"v1"', body: editionBody() };
    expect(await client.readCache()).toBeNull();

    caches.outlets.stored = { etag: '"o1"', body: outletsBody() };
    caches.edition.stored = { etag: '"v1"', body: '{not json' };
    expect(await client.readCache()).toBeNull();
  });
});

describe('EditionClient.revalidate', () => {
  it('first open with no cache fetches both artifacts and returns a fresh snapshot', async () => {
    const { caches, client, fetchText } = setup();
    fetchText.mockImplementation(async (url: string) =>
      url.endsWith('/edition.json')
        ? ok(editionBody(), '"v1"')
        : ok(outletsBody(), '"o1"'),
    );

    const result = await client.revalidate();

    expect(result.kind).toBe('fresh');
    if (result.kind !== 'fresh') return;
    expect(result.snapshot.builtAt).toBe(fixtureEdition.builtAt);
    expect(
      result.snapshot.edition.feedStories.map((story) => story.slug),
    ).toEqual(['budget-2027-en-commission', 'cyclone-veda-antilles']);
    expect(result.snapshot.outlets.map((outlet) => outlet.id)).toEqual([
      'lobs',
      'le-monde',
      'le-figaro',
    ]);
    expect(fetchText).toHaveBeenCalledTimes(2);
    // A cold cache sends no If-None-Match.
    for (const call of fetchText.mock.calls) {
      expect(call[1]).toBeNull();
    }
    expect(caches.edition.stored).toEqual({
      etag: '"v1"',
      body: editionBody(),
    });
    expect(caches.outlets.stored).toEqual({
      etag: '"o1"',
      body: outletsBody(),
    });
  });

  it('a 200 replaces the cached edition and re-renders from the new artifact', async () => {
    const { caches, client, fetchText } = setup();
    caches.edition.stored = { etag: '"v1"', body: editionBody() };
    caches.outlets.stored = { etag: '"o1"', body: outletsBody() };
    const rebuilt = JSON.stringify({
      ...fixtureEdition,
      builtAt: '2026-11-11T15:00:00.000Z',
    });
    fetchText.mockImplementation(async (url: string) =>
      url.endsWith('/edition.json') ? ok(rebuilt, '"v2"') : notModified(),
    );

    const result = await client.revalidate();

    expect(result.kind).toBe('fresh');
    if (result.kind !== 'fresh') return;
    expect(result.snapshot.builtAt).toBe('2026-11-11T15:00:00.000Z');
    expect(caches.edition.stored).toEqual({ etag: '"v2"', body: rebuilt });
    // The outlets 304 left its cache exactly as it was.
    expect(caches.outlets.stored).toEqual({
      etag: '"o1"',
      body: outletsBody(),
    });
  });

  it('a network failure keeps the last good artifact and its builtAt', async () => {
    const { caches, client, fetchText } = setup();
    caches.edition.stored = { etag: '"v1"', body: editionBody() };
    caches.outlets.stored = { etag: '"o1"', body: outletsBody() };
    fetchText.mockRejectedValue(new Error('plane mode'));

    const result = await client.revalidate();

    expect(result.kind).toBe('kept');
    if (result.kind !== 'kept') return;
    expect(result.snapshot.builtAt).toBe(fixtureEdition.builtAt);
    expect(result.error).toBeInstanceOf(Error);
    expect(caches.edition.stored).toEqual({
      etag: '"v1"',
      body: editionBody(),
    });
  });

  it('a server failure (500) keeps the last good artifact too', async () => {
    const { caches, client, fetchText } = setup();
    caches.edition.stored = { etag: '"v1"', body: editionBody() };
    caches.outlets.stored = { etag: '"o1"', body: outletsBody() };
    fetchText.mockImplementation(async () => ({
      status: 500,
      etag: null,
      body: null,
    }));

    const result = await client.revalidate();

    expect(result.kind).toBe('kept');
    if (result.kind !== 'kept') return;
    expect(result.snapshot.builtAt).toBe(fixtureEdition.builtAt);
  });

  it('a cold cache with a total failure is unavailable — there is nothing to render', async () => {
    const { client, fetchText } = setup();
    fetchText.mockRejectedValue(new Error('plane mode'));

    const result = await client.revalidate();

    expect(result.kind).toBe('unavailable');
    if (result.kind !== 'unavailable') return;
    expect(result.error).toBeInstanceOf(Error);
  });

  it('a first open where only the edition lands is unavailable, then recovers on the next round', async () => {
    const { caches, client, fetchText } = setup();
    fetchText.mockImplementation(async (url: string) =>
      url.endsWith('/edition.json')
        ? ok(editionBody(), '"v1"')
        : Promise.reject(new Error('plane mode')),
    );

    const first = await client.revalidate();

    expect(first.kind).toBe('unavailable');
    // What did land is cached: the next round completes the pair.
    expect(caches.edition.stored).toEqual({
      etag: '"v1"',
      body: editionBody(),
    });
    fetchText.mockImplementation(async (url: string) =>
      url.endsWith('/edition.json') ? notModified() : ok(outletsBody(), '"o1"'),
    );

    const second = await client.revalidate({ force: true });

    expect(second.kind).toBe('fresh');
    if (second.kind !== 'fresh') return;
    expect(second.snapshot.outlets).toHaveLength(3);
  });

  it("passes the pipeline's activity bins through untouched — no binning, no reshaping", async () => {
    const { client, fetchText } = setup();
    fetchText.mockImplementation(async (url: string) =>
      url.endsWith('/edition.json')
        ? ok(editionBody(), '"v1"')
        : ok(outletsBody(), '"o1"'),
    );

    const result = await client.revalidate();

    if (result.kind !== 'fresh') throw new Error('expected fresh');
    const budget = result.snapshot.edition.feedStories.find(
      (story) => story.slug === 'budget-2027-en-commission',
    );
    // The fixture file is the independent source of truth.
    const fixtureBudget = fixtureEdition.feedStories.find(
      (story) => story.slug === 'budget-2027-en-commission',
    );
    expect(budget?.activity).toEqual(fixtureBudget?.activity);
    expect(budget?.articles).toEqual(fixtureBudget?.articles);
  });

  it('concurrent revalidations share one round; force starts a fresh one', async () => {
    const { client, fetchText } = setup();
    const pending: Array<() => void> = [];
    fetchText.mockImplementation(
      async () =>
        new Promise<FetchResponse>((resolve) => {
          pending.push(() => resolve(ok(editionBody(), '"v1"')));
        }),
    );

    const first = client.revalidate();
    const shared = client.revalidate();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchText).toHaveBeenCalledTimes(2); // one round: edition + outlets

    for (const resolve of pending.splice(0)) resolve();
    for (const call of [first, shared]) {
      const result = await call;
      expect(result.kind).toBe('fresh');
    }

    const forced = client.revalidate({ force: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchText).toHaveBeenCalledTimes(4); // a second round started
    for (const resolve of pending.splice(0)) resolve();
    await forced;
  });

  it('a malformed 200 body keeps the last good artifact instead of rendering it', async () => {
    const { caches, client, fetchText } = setup();
    caches.edition.stored = { etag: '"v1"', body: editionBody() };
    caches.outlets.stored = { etag: '"o1"', body: outletsBody() };
    fetchText.mockImplementation(async (url: string) =>
      url.endsWith('/edition.json') ? ok('{not json', '"v2"') : notModified(),
    );

    const result = await client.revalidate();

    expect(result.kind).toBe('kept');
    if (result.kind !== 'kept') return;
    expect(result.snapshot.builtAt).toBe(fixtureEdition.builtAt);
    // The unparseable body never entered the cache.
    expect(caches.edition.stored?.body).toBe(editionBody());
  });

  it('a cached pair revalidates with If-None-Match and 304 keeps the cache as-is', async () => {
    const { caches, client, fetchText } = setup();
    caches.edition.stored = { etag: '"v1"', body: editionBody() };
    caches.outlets.stored = { etag: '"o1"', body: outletsBody() };
    fetchText.mockImplementation(async () => notModified());

    const result = await client.revalidate();

    expect(result.kind).toBe('unchanged');
    if (result.kind !== 'unchanged') return;
    expect(result.snapshot.builtAt).toBe(fixtureEdition.builtAt);
    expect(result.snapshot.edition.stories).toHaveLength(2);
    expect(result.snapshot.outlets).toHaveLength(3);
    expect(fetchText.mock.calls.map((call) => [call[0], call[1]])).toEqual(
      expect.arrayContaining([
        ['https://example.test/edition.json', '"v1"'],
        ['https://example.test/outlets.json', '"o1"'],
      ]),
    );
    // A 304 rewrites nothing.
    expect(caches.edition.stored).toEqual({
      etag: '"v1"',
      body: editionBody(),
    });
    expect(caches.outlets.stored).toEqual({
      etag: '"o1"',
      body: outletsBody(),
    });
  });
});
