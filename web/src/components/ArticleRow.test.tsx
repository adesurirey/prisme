// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ArticleRow, { breakableHeadline } from './ArticleRow';

describe('breakableHeadline', () => {
  it('breaks word-joining no-break spaces so long headlines wrap', () => {
    expect(breakableHeadline('Assemblée\u00A0nationale\u00A0adopte')).toBe(
      'Assemblée nationale adopte',
    );
  });

  it('keeps the French typographic NBSP next to punctuation', () => {
    expect(breakableHeadline('loi\u00A0: intégrale')).toBe(
      'loi\u00A0: intégrale',
    );
    expect(breakableHeadline('«\u00A0intégrale\u00A0»')).toBe(
      '«\u00A0intégrale\u00A0»',
    );
  });
});

describe('ArticleRow', () => {
  const article = {
    id: 'a1',
    outletId: 'france-24',
    headline: 'Titre\u00A0en\u00A0un\u00A0seul\u00A0mot',
    url: 'https://example.com',
    publishedAt: '2026-10-13T16:25:48.000Z',
    frontPage: false,
    kind: 'news',
    section: 'politics',
  } as unknown as Parameters<typeof ArticleRow>[0]['article'];

  it('renders an unbreakable feed headline so it can wrap', () => {
    render(<ArticleRow article={article} headline={article.headline} />);
    expect(screen.getByText('Titre en un seul mot')).toBeTruthy();
  });
});
