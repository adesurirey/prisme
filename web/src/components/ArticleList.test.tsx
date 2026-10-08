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
  {
    id: 'monde',
    name: 'Le Monde',
    leaning: 'centre',
    paywall: 'full',
    site: 'https://www.lemonde.fr',
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
  it('shows each row with its Paris date and no toggle without follow-ups', () => {
    // 12:00 UTC = 14:00 in Paris.
    render(
      <ArticleList
        articles={[article('a1', 'libe', '2026-10-07T12:00:00Z')]}
        outlets={OUTLETS}
        storyTitle="Le sujet"
      />,
    );
    expect(screen.getByText('Libération')).toBeTruthy();
    expect(screen.getByText('7 oct., 14:00')).toBeTruthy();
    expect(screen.getByText('Titre a1')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('sorts the flat list newest first across outlets', () => {
    render(
      <ArticleList
        articles={[
          article('a1', 'libe', '2026-10-07T08:00:00Z'),
          article('b1', 'monde', '2026-10-07T14:00:00Z'),
          article('b2', 'monde', '2026-10-07T09:00:00Z'),
          article('a2', 'libe', '2026-10-07T10:00:00Z'),
        ]}
        outlets={OUTLETS}
        storyTitle="Le sujet"
      />,
    );
    const headlines = screen
      .getAllByText(/^Titre /)
      .map((el) => el.textContent);
    // Every row is present, in recency order; the follow-ups (a2, b2) are
    // hidden in the DOM but still rendered.
    expect(headlines).toEqual(['Titre b1', 'Titre b2', 'Titre a2', 'Titre a1']);
    expect(
      (screen.getByText('Titre b2').closest('li') as HTMLLIElement).hidden,
    ).toBe(true);
  });

  it('prerenders follow-ups hidden behind their own row’s toggle, reveals, and collapses back', () => {
    render(
      <ArticleList
        articles={[
          article('a1', 'libe', '2026-10-07T14:00:00Z'),
          article('a2', 'libe', '2026-10-07T09:00:00Z'),
          article('a3', 'libe', '2026-10-07T08:00:00Z'),
        ]}
        outlets={OUTLETS}
        storyTitle="Le sujet"
      />,
    );
    const button = screen.getByRole('button', {
      name: '+2 autres de Libération',
    });
    const followUps = screen.getByText('Titre a2').closest('li')!;
    expect((followUps as HTMLLIElement).hidden).toBe(true);

    fireEvent.click(button);
    expect((followUps as HTMLLIElement).hidden).toBe(false);
    expect(
      screen.getByRole('button', { name: 'Replier Libération' }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Replier Libération' }));
    expect((followUps as HTMLLIElement).hidden).toBe(true);
    expect(
      screen.getByRole('button', {
        name: '+2 autres de Libération',
      }),
    ).toBeTruthy();
  });

  it('uses the singular for a single follow-up', () => {
    render(
      <ArticleList
        articles={[
          article('a1', 'libe', '2026-10-07T14:00:00Z'),
          article('a2', 'libe', '2026-10-07T09:00:00Z'),
        ]}
        outlets={OUTLETS}
        storyTitle="Le sujet"
      />,
    );
    expect(
      screen.getByRole('button', {
        name: '+1 autre de Libération',
      }),
    ).toBeTruthy();
  });

  it('hides a headline that repeats the Story title, like the page did', () => {
    render(
      <ArticleList
        articles={[
          {
            ...article('a1', 'libe', '2026-10-07T12:00:00Z'),
            headline: 'Le sujet',
          },
        ]}
        outlets={OUTLETS}
        storyTitle="Le sujet"
      />,
    );
    // The row itself (outlet, date, link) stays; only the repeated headline goes.
    expect(screen.getByText('Libération')).toBeTruthy();
    expect(screen.queryByText('Le sujet')).toBeNull();
  });
});
