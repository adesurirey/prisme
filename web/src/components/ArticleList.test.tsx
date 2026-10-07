// @vitest-environment jsdom

import type { Article, Outlet } from '@prisme/domain';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ArticleList from './ArticleList';

afterEach(cleanup);

const OUTLETS: Outlet[] = [
  {
    id: 'libe',
    name: 'Libération',
    leaning: 'gauche',
    paywall: 'partial',
    site: 'https://www.liberation.fr',
    feeds: {},
  },
];

function article(id: string, outletId: string, publishedAt: string): Article {
  return {
    id,
    outletId,
    headline: `Titre ${id}`,
    url: `https://example.com/${id}`,
    publishedAt,
    frontPage: false,
  };
}

describe('ArticleList', () => {
  it('shows each head row with its Paris date and no toggle without follow-ups', () => {
    // 12:00 UTC = 14:00 in Paris.
    render(
      <ArticleList
        head={[article('a1', 'libe', '2026-10-07T12:00:00Z')]}
        followUps={[]}
        outlets={OUTLETS}
        storyTitle="Le sujet"
      />,
    );
    expect(screen.getByText('Libération')).toBeTruthy();
    expect(screen.getByText('7 oct., 14:00')).toBeTruthy();
    expect(screen.getByText('Titre a1')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('prerenders follow-ups hidden, reveals them under the count toggle, and collapses back', () => {
    render(
      <ArticleList
        head={[article('a1', 'libe', '2026-10-07T14:00:00Z')]}
        followUps={[
          article('a2', 'libe', '2026-10-07T09:00:00Z'),
          article('a3', 'libe', '2026-10-07T08:00:00Z'),
        ]}
        outlets={OUTLETS}
        storyTitle="Le sujet"
      />,
    );
    const button = screen.getByRole('button', {
      name: 'Voir les 2 autres articles de ces médias',
    });
    const followUps = screen
      .getByText('Titre a2')
      .closest('ul')! as HTMLUListElement;
    expect(followUps.hidden).toBe(true);

    fireEvent.click(button);
    expect(followUps.hidden).toBe(false);
    expect(screen.getByRole('button', { name: 'Réduire' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Réduire' }));
    expect(followUps.hidden).toBe(true);
    expect(
      screen.getByRole('button', {
        name: 'Voir les 2 autres articles de ces médias',
      }),
    ).toBeTruthy();
  });

  it('uses the singular for a single follow-up', () => {
    render(
      <ArticleList
        head={[article('a1', 'libe', '2026-10-07T14:00:00Z')]}
        followUps={[article('a2', 'libe', '2026-10-07T09:00:00Z')]}
        outlets={OUTLETS}
        storyTitle="Le sujet"
      />,
    );
    expect(
      screen.getByRole('button', {
        name: 'Voir l’autre article de ces médias',
      }),
    ).toBeTruthy();
  });

  it('hides a head headline that repeats the Story title, like the page did', () => {
    render(
      <ArticleList
        head={[
          {
            ...article('a1', 'libe', '2026-10-07T12:00:00Z'),
            headline: 'Le sujet',
          },
        ]}
        followUps={[]}
        outlets={OUTLETS}
        storyTitle="Le sujet"
      />,
    );
    // The row itself (outlet, date, link) stays; only the repeated headline goes.
    expect(screen.getByText('Libération')).toBeTruthy();
    expect(screen.queryByText('Le sujet')).toBeNull();
  });
});
