import { describe, expect, it } from 'vitest';
import type { Article } from '@prisme/domain';
import {
  classifyNewArticles,
  dropNotNews,
  emptyCache,
  kindOf,
  type ClassificationCache,
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
  answers: (id: string) => { kind: 'news' | 'not_news'; section: string | null } | null,
): DecisionModel & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    label: 'Fake',
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
    cache.entries['a1'] = { kind: 'news', section: 'politics' };
    const model = fakeModel((id) => (id === 'a2' ? { kind: 'not_news', section: null } : null));
    await classifyNewArticles([article('a1'), article('a2')], new Map(), cache, model);
    expect(model.calls).toEqual(['Titre a2']);
    expect(cache.entries['a1']).toEqual({ kind: 'news', section: 'politics' });
    expect(cache.entries['a2']).toEqual({ kind: 'not_news', section: null });
  });

  it('keeps failed classifications out of the cache for retry next build', async () => {
    const cache = emptyCache();
    const model = fakeModel(() => null);
    await classifyNewArticles([article('a1')], new Map(), cache, model);
    expect(cache.entries).toEqual({});
  });

  it('returns the cache untouched without a model', async () => {
    const cache = emptyCache();
    const result = await classifyNewArticles([article('a1')], new Map(), cache, null);
    expect(result).toBe(cache);
    expect(cache.entries).toEqual({});
  });
});

describe('dropNotNews', () => {
  const cache = (): ClassificationCache => {
    const c = emptyCache();
    c.entries['n1'] = { kind: 'not_news', section: null };
    c.entries['n2'] = { kind: 'news', section: 'politics' };
    return c;
  };

  it('drops only successfully classified not_news Articles', () => {
    const kept = dropNotNews([article('n1'), article('n2'), article('n3')], cache());
    expect(kept.map((a) => a.id)).toEqual(['n2', 'n3']);
  });

  it('exposes the cached kind for the remaining Articles', () => {
    const c = cache();
    expect(kindOf(article('n2'), c)).toBe('news');
    expect(kindOf(article('n3'), c)).toBeUndefined();
  });
});