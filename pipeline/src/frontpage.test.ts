import { describe, expect, it } from 'vitest';
import type { Article, Story } from '@prisme/domain';
import { updateFrontPageHistory } from './frontpage.ts';

/**
 * The Front-page history (issue #6): `frontPage` is the current snapshot,
 * recomputed each build from today's collection; `everFrontPage` is sticky —
 * once true it never goes back while the Article lives. An Article absent
 * from today's collection is not currently on the Front page. Frozen Stories
 * are passed through untouched (ADR-0005): their flags stay as written on
 * their last live build.
 */

function article(id: string, overrides: Partial<Article> = {}): Article {
  return {
    id,
    outletId: 'lemonde',
    headline: `Titre ${id}`,
    url: `https://lemonde.fr/a/${id}`,
    publishedAt: '2026-10-06T10:00:00Z',
    frontPage: false,
    ...overrides,
  };
}

function story(id: string, slug: string, articles: Article[]): Story {
  return { id, slug, title: 'Sujet', createdAt: '2026-10-06T10:00:00Z', articles };
}

describe('updateFrontPageHistory', () => {
  it('promotes a Front-page Article to the sticky ever flag', () => {
    const s = story('s1', 's1', [article('a', { frontPage: true })]);
    const result = updateFrontPageHistory([s], [article('a', { frontPage: true })], () => true);
    const updated = result.stories[0].articles[0];
    expect(updated.frontPage).toBe(true);
    expect(updated.everFrontPage).toBe(true);
    expect(result.changed).toEqual(new Set(['s1']));
  });

  it('keeps the sticky flag when the Article falls off the Front page', () => {
    const s = story('s1', 's1', [article('a', { frontPage: true, everFrontPage: true })]);
    const result = updateFrontPageHistory([s], [article('a', { frontPage: false })], () => true);
    const updated = result.stories[0].articles[0];
    expect(updated.frontPage).toBe(false);
    expect(updated.everFrontPage).toBe(true);
  });

  it('marks an Article absent from today as not currently on the Front page', () => {
    const s = story('s1', 's1', [article('a', { frontPage: true })]);
    const result = updateFrontPageHistory([s], [], () => true);
    const updated = result.stories[0].articles[0];
    expect(updated.frontPage).toBe(false);
    expect(updated.everFrontPage).toBeUndefined();
    expect(result.changed).toEqual(new Set(['s1']));
  });

  it('leaves a no-change Story out of the changed set', () => {
    const s = story('s1', 's1', [article('a', { frontPage: false })]);
    const result = updateFrontPageHistory([s], [article('a', { frontPage: false })], () => true);
    expect(result.changed.size).toBe(0);
  });

  it('never touches a frozen Story, even when its Article is collected', () => {
    const s = story('s1', 's1', [article('a', { frontPage: true })]);
    const result = updateFrontPageHistory([s], [article('a', { frontPage: true })], () => false);
    expect(result.stories[0]).toEqual(s);
    expect(result.changed.size).toBe(0);
  });

  it('does not mutate the input Stories', () => {
    const s = story('s1', 's1', [article('a', { frontPage: true })]);
    const original = structuredClone(s);
    updateFrontPageHistory([s], [article('a', { frontPage: true })], () => true);
    expect(s).toEqual(original);
  });
});