import type { Article } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import {
  type ClassificationCache,
  classifyNewArticles,
  dropNotNews,
  emptyCache,
  kindOf,
} from './classify.ts';
import type { DecisionModel } from './decision-model.ts';

function article(id: string): Article {
  return {
    id,
    outletId: 'lemonde',
    headline: `Titre ${id}`,
    url: `https://lemonde.fr/a/${id}`,
    publishedAt: '2026-10-06T10:00:00Z',
    frontPage: true,
  };
}

function fakeModel(
  answers: (
    id: string,
  ) => { kind: 'news' | 'not_news'; section: string | null } | null,
): DecisionModel & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    label: 'Fake',
    costPerInputToken: 0,
    async classify({ headline }: { headline: string }) {
      calls.push(headline);
      const answer = answers(headline.split(' ').pop()!);
      if (!answer) return null;
      return {
        kind: answer.kind,
        section: (answer.section ?? 'other') as never,
        inputTokens: 10,
        elapsedMs: 5,
      };
    },
  };
}

describe('classifyNewArticles', () => {
  it('classifies only ids missing from the cache', async () => {
    const cache = emptyCache();
    cache.entries.a1 = { kind: 'news', section: 'politics' };
    const model = fakeModel((id) =>
      id === 'a2' ? { kind: 'not_news', section: null } : null,
    );
    await classifyNewArticles(
      [article('a1'), article('a2')],
      new Map(),
      cache,
      model,
    );
    expect(model.calls).toEqual(['Titre a2']);
    expect(cache.entries.a1).toEqual({ kind: 'news', section: 'politics' });
    expect(cache.entries.a2).toEqual({ kind: 'not_news', section: null });
  });

  it('keeps isolated failed classifications out of the cache for retry next build', async () => {
    const cache = emptyCache();
    // One answer comes back, one fails: some checks answered, the build
    // proceeds and the failed Article is retried next build.
    const model = fakeModel((id) =>
      id === 'a2' ? null : { kind: 'news', section: 'politics' },
    );
    await classifyNewArticles(
      [article('a1'), article('a2')],
      new Map(),
      cache,
      model,
    );
    expect(cache.entries.a1).toEqual({ kind: 'news', section: 'politics' });
    expect(cache.entries.a2).toBeUndefined();
  });

  it('a build where every fresh classification fails fails the build (issue #40)', async () => {
    const cache = emptyCache();
    const model = fakeModel(() => null);
    await expect(
      classifyNewArticles([article('a1')], new Map(), cache, model),
    ).rejects.toThrow(/all 1 fresh Articles failed/);
    expect(cache.entries).toEqual({});
  });

  it('survives an isolated model throw, like a failed feed', async () => {
    const cache = emptyCache();
    const model = fakeModel((id) =>
      id === 'a2' ? { kind: 'news', section: 'politics' } : null,
    );
    model.classify = async ({ headline }) => {
      if (headline.includes('a1')) throw new Error('HTTP 401: bad key');
      return {
        kind: 'news',
        section: 'politics',
        inputTokens: 10,
        elapsedMs: 5,
      };
    };
    await expect(
      classifyNewArticles(
        [article('a1'), article('a2')],
        new Map(),
        cache,
        model,
      ),
    ).resolves.toBe(cache);
    expect(cache.entries.a2).toEqual({ kind: 'news', section: 'politics' });
  });

  it('a model that throws for every fresh Article fails the build (issue #40)', async () => {
    const cache = emptyCache();
    const model = fakeModel(() => null);
    model.classify = async () => {
      throw new Error('HTTP 401: bad key');
    };
    await expect(
      classifyNewArticles([article('a1')], new Map(), cache, model),
    ).rejects.toThrow(/all 1 fresh Articles failed/);
  });

  it('returns the cache untouched without a model', async () => {
    const cache = emptyCache();
    const result = await classifyNewArticles(
      [article('a1')],
      new Map(),
      cache,
      null,
    );
    expect(result).toBe(cache);
    expect(cache.entries).toEqual({});
  });
});

describe('dropNotNews', () => {
  const cache = (): ClassificationCache => {
    const c = emptyCache();
    c.entries.n1 = { kind: 'not_news', section: null };
    c.entries.n2 = { kind: 'news', section: 'politics' };
    return c;
  };

  it('drops only successfully classified not_news Articles', () => {
    const kept = dropNotNews(
      [article('n1'), article('n2'), article('n3')],
      cache(),
    );
    expect(kept.map((a) => a.id)).toEqual(['n2', 'n3']);
  });

  it('exposes the cached kind for the remaining Articles', () => {
    const c = cache();
    expect(kindOf(article('n2'), c)).toBe('news');
    expect(kindOf(article('n3'), c)).toBeUndefined();
  });
});
