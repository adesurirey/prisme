import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  geminiGroupingModel,
  parseGroupingResponse,
  RATE_LIMIT_BACKOFF_MS,
} from './gemini.ts';

describe('parseGroupingResponse', () => {
  it('parses a well-formed proposal', () => {
    const proposal = parseGroupingResponse(
      JSON.stringify({
        newStories: [{ key: 'budget', title: 'Le Sénat adopte le budget' }],
        assignments: [
          { articleId: 'a1', storyId: 's1', confidence: 0.9 },
          { articleId: 'a2', newStoryKey: 'budget', confidence: 0.4 },
        ],
        titleUpdates: [{ storyId: 's1', title: 'Nouveau titre' }],
      }),
    );
    expect(proposal).not.toBeNull();
    expect(proposal!.newStories).toEqual([
      { key: 'budget', title: 'Le Sénat adopte le budget' },
    ]);
    expect(proposal!.assignments).toHaveLength(2);
    expect(proposal!.titleUpdates).toEqual([
      { storyId: 's1', title: 'Nouveau titre' },
    ]);
  });

  it('returns null for non-JSON text', () => {
    expect(parseGroupingResponse('not json at all')).toBeNull();
  });

  it('returns null when assignments is missing', () => {
    expect(
      parseGroupingResponse(JSON.stringify({ newStories: [] })),
    ).toBeNull();
  });

  it('treats a wrong-typed confidence like an absent one (0)', () => {
    const proposal = parseGroupingResponse(
      JSON.stringify({
        newStories: [],
        assignments: [
          { articleId: 'a1', confidence: 0.8 },
          { storyId: 's1', confidence: 0.8 },
          { articleId: 'a2', confidence: 'high' },
          { articleId: 'a3', confidence: 0.7 },
        ],
      }),
    );
    expect(proposal!.assignments.map((a) => a.articleId)).toEqual([
      'a1',
      'a2',
      'a3',
    ]);
    expect(proposal!.assignments[1]!.confidence).toBe(0);
  });

  it('clamps confidence into [0, 1]', () => {
    const proposal = parseGroupingResponse(
      JSON.stringify({
        newStories: [],
        assignments: [
          { articleId: 'a1', confidence: 5 },
          { articleId: 'a2', confidence: -2 },
        ],
      }),
    );
    expect(proposal!.assignments[0]!.confidence).toBe(1);
    expect(proposal!.assignments[1]!.confidence).toBe(0);
  });

  it('treats confidence as 0 when absent', () => {
    const proposal = parseGroupingResponse(
      JSON.stringify({
        newStories: [],
        assignments: [{ articleId: 'a1', storyId: 's1' }],
      }),
    );
    expect(proposal!.assignments[0]!.confidence).toBe(0);
  });

  it('drops new stories without a key or a non-empty title', () => {
    const proposal = parseGroupingResponse(
      JSON.stringify({
        newStories: [
          { key: 'k1', title: 'Titre' },
          { key: 'k2' },
          { key: '', title: 'Titre vide' },
          { title: 'Sans clé' },
        ],
        assignments: [],
      }),
    );
    expect(proposal!.newStories).toEqual([{ key: 'k1', title: 'Titre' }]);
  });

  it('drops malformed title updates', () => {
    const proposal = parseGroupingResponse(
      JSON.stringify({
        newStories: [],
        assignments: [],
        titleUpdates: [
          { storyId: 's1', title: 'Bon titre' },
          { storyId: 's2' },
          { title: 'Sans story' },
        ],
      }),
    );
    expect(proposal!.titleUpdates).toEqual([
      { storyId: 's1', title: 'Bon titre' },
    ]);
  });
});

describe('geminiModel failure policy (issue #40)', () => {
  const OK_BODY = {
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify({
                newStories: [{ key: 'k1', title: 'Titre' }],
                assignments: [],
              }),
            },
          ],
        },
      },
    ],
  };

  function stubFetch(
    responses: {
      status: number;
      body: unknown;
    }[],
  ): { calls: number } {
    let calls = 0;
    globalThis.fetch = (async () => {
      const r = responses[Math.min(calls, responses.length - 1)]!;
      calls++;
      return {
        ok: r.status === 200,
        status: r.status,
        text: async () => JSON.stringify(r.body),
        json: async () => r.body,
      } as unknown as Response;
    }) as typeof fetch;
    return {
      get calls() {
        return calls;
      },
    };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    sleeps.length = 0;
  });

  const sleeps: number[] = [];
  const noSleep = async (ms: number): Promise<void> => {
    sleeps.push(ms);
  };
  const model = () => geminiGroupingModel('test-key', noSleep);

  it('a 429 waits the ~45 s quota backoff once, then succeeds', async () => {
    const fetchCalls = stubFetch([
      { status: 429, body: {} },
      { status: 200, body: OK_BODY },
    ]);
    const proposal = await model().group({ stories: [], articles: [] });
    expect(proposal.newStories).toHaveLength(1);
    expect(fetchCalls.calls).toBe(2);
    expect(sleeps).toEqual([RATE_LIMIT_BACKOFF_MS]);
  });

  it('a 429 still failing after the backoff throws — the build fails', async () => {
    const fetchCalls = stubFetch([{ status: 429, body: {} }]);
    await expect(model().group({ stories: [], articles: [] })).rejects.toThrow(
      'HTTP 429',
    );
    expect(fetchCalls.calls).toBe(2);
  });

  it('a non-retryable 4xx throws immediately, with no sleep', async () => {
    const fetchCalls = stubFetch([{ status: 401, body: 'bad key' }]);
    await expect(model().group({ stories: [], articles: [] })).rejects.toThrow(
      'HTTP 401',
    );
    expect(fetchCalls.calls).toBe(1);
    expect(sleeps).toEqual([]);
  });

  it('an unparseable response after the retry throws', async () => {
    stubFetch([
      {
        status: 200,
        body: { candidates: [{ content: { parts: [{ text: 'not json' }] } }] },
      },
      {
        status: 200,
        body: {
          candidates: [{ content: { parts: [{ text: 'still not json' }] } }],
        },
      },
    ]);
    await expect(model().group({ stories: [], articles: [] })).rejects.toThrow(
      'unparseable',
    );
  });
});
