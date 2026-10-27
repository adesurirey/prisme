import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  geminiGroupingModel,
  groupingPrompt,
  parseGroupingResponse,
  RATE_LIMIT_BACKOFF_MS,
} from './gemini.ts';

describe('groupingPrompt (ADR-0018)', () => {
  it("shows each story's latest member headlines after its title", () => {
    const prompt = groupingPrompt({
      stories: [
        {
          id: 's1',
          title: 'Story un',
          section: 'politics',
          latestHeadlines: ['Un policier mis en examen', '36 enquêtes IGPN'],
        },
        { id: 's2', title: 'Story deux' },
      ],
      articles: [],
    });
    expect(prompt).toContain(
      '— derniers titres joints : « Un policier mis en examen » ; « 36 enquêtes IGPN »',
    );
    expect(prompt).not.toContain('Story deux — derniers');
  });

  it('shows the founding anchor between the title and the latest headlines (the 2026-10-27 drift fix)', () => {
    const prompt = groupingPrompt({
      stories: [
        {
          id: 's1',
          title: 'Attentat à Trappes : la garde à vue reprend',
          founding: {
            headline: 'Un homme tire dans la rue à Trappes',
            day: '2026-10-23',
          },
          latestHeadlines: ['La garde à vue a repris'],
        },
      ],
      articles: [],
    });
    expect(prompt).toContain(
      '— fondateur (2026-10-23) : « Un homme tire dans la rue à Trappes » — derniers titres joints : « La garde à vue a repris »',
    );
    expect(prompt).toContain("le fondateur dit ce qu'elle est");
  });

  it('carries the sub-fact birth rule', () => {
    const prompt = groupingPrompt({ stories: [], articles: [] });
    expect(prompt).toContain(
      'un fait distinct de ces titres ne fusionne pas dans la story',
    );
    expect(prompt).toContain('newStoryKey');
    expect(prompt).toContain(
      'des faits distincts (volet judiciaire, volet politique, journée à venir) donnent des stories distinctes',
    );
    // The own-headline-cycle episode rule (ADR-0018 amendment).
    expect(prompt).toContain('propre cycle de titres');
    expect(prompt).toContain("ne l'assigne jamais à la story-mère");
  });

  it('carries the two-distinct-Outlets birth rule (ADR-0027)', () => {
    const prompt = groupingPrompt({ stories: [], articles: [] });
    expect(prompt).toContain(
      "d'au moins deux articles d'au moins deux médias distincts",
    );
    // The old two-Articles-only wording is gone (ADR-0015 as amended).
    expect(prompt).not.toContain("d'au moins deux articles (ADR-0015)");
  });

  it('the grouping prompt names no title: titles are written by the Title pass (ADR-0023)', () => {
    const prompt = groupingPrompt({ stories: [], articles: [] });
    expect(prompt).toContain("N'écris aucun titre");
    // No title rule left behind — they live in title-pass.ts (ADR-0013).
    expect(prompt).not.toContain('titre neutre');
    expect(prompt).not.toContain('titleUpdates');
  });
});

describe('parseGroupingResponse', () => {
  it('parses a well-formed proposal', () => {
    const proposal = parseGroupingResponse(
      JSON.stringify({
        newStories: [{ key: 'budget' }],
        assignments: [
          { articleId: 'a1', storyId: 's1', confidence: 0.9 },
          { articleId: 'a2', newStoryKey: 'budget', confidence: 0.4 },
        ],
      }),
    );
    expect(proposal).not.toBeNull();
    expect(proposal!.newStories).toEqual([{ key: 'budget' }]);
    expect(proposal!.assignments).toHaveLength(2);
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

  it('drops new stories without a key, and stray model titles are ignored', () => {
    const proposal = parseGroupingResponse(
      JSON.stringify({
        newStories: [
          { key: 'k1' },
          { key: '', title: 'Titre vide' },
          { title: 'Sans clé' },
        ],
        assignments: [],
      }),
    );
    expect(proposal!.newStories).toEqual([{ key: 'k1' }]);
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
                newStories: [{ key: 'k1' }],
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

  it('logs the prompt size in chars and exact input tokens per call', async () => {
    const body = {
      ...OK_BODY,
      usageMetadata: {
        promptTokenCount: 1234,
        candidatesTokenCount: 66,
        totalTokenCount: 1300,
      },
    };
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    stubFetch([{ status: 200, body }]);
    await model().group({ stories: [], articles: [] });
    const line = log.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(line).toMatch(
      /Flash-Lite: prompt \d+ chars \/ 1234 input tokens \/ 66 output tokens/,
    );
    log.mockRestore();
  });

  it('warns on a non-STOP finish reason and a blocked prompt', async () => {
    const body = {
      ...OK_BODY,
      candidates: [{ ...OK_BODY.candidates![0], finishReason: 'MAX_TOKENS' }],
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch([{ status: 200, body }]);
    await model().group({ stories: [], articles: [] });
    const line = warn.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(line).toMatch(/finishReason=MAX_TOKENS/);
    warn.mockRestore();
  });

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
