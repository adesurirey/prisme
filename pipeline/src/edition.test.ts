import { describe, expect, it } from 'vitest';
import type { Article, Section } from '@prisme/domain';
import { storySection } from './edition.ts';

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

describe('storySection', () => {
  const sectionOf = (id: string): Section | undefined =>
    ({ a: 'politics', b: 'politics', c: 'world', d: 'sport' })[id as never];

  it('returns the majority Section of the Story\'s Articles', () => {
    expect(storySection([article('a'), article('b'), article('c')], sectionOf)).toBe('politics');
  });

  it('breaks ties deterministically by smallest Article id', () => {
    // politics (via 'a') vs world (via 'c'): tie at 1 — 'a' < 'c' wins.
    expect(storySection([article('c'), article('a')], sectionOf)).toBe('politics');
  });

  it('is undefined when no Article has a Section', () => {
    expect(storySection([article('x')], sectionOf)).toBeUndefined();
  });
});