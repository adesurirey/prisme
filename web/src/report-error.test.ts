import { describe, expect, it } from 'vitest';
import { reportIssueUrl } from './report-error';

describe('reportIssueUrl', () => {
  const story = { slug: 'reforme-retraites', title: 'Réforme des retraites' };

  it('opens a prefilled GitHub issue with the Story URL and title', () => {
    const url = new URL(
      reportIssueUrl({
        slug: story.slug,
        title: story.title,
        pageUrl: 'https://adesurirey.github.io/prisme/sujet/reforme-retraites/',
      }),
    );
    expect(url.origin + url.pathname).toBe(
      'https://github.com/adesurirey/prisme/issues/new',
    );
    expect(url.searchParams.get('title')).toBe('Erreur sur « Réforme des retraites »');
    const body = url.searchParams.get('body')!;
    expect(body).toContain('https://adesurirey.github.io/prisme/sujet/reforme-retraites/');
    expect(body).toContain(story.title);
  });

  it('escapes quotes and newlines through URL encoding', () => {
    const url = reportIssueUrl({
      slug: 'a',
      title: 'Guillemets « et " doubles',
      pageUrl: 'https://example.com/sujet/a/',
    });
    expect(url).toContain('title=');
    expect(url).not.toContain('« et " doubles');
  });
});
