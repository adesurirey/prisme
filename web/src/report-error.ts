import type { Story } from '@prisme/domain';

/** The GitHub repo errors are reported against (ADR-0002: the repo is public). */
export const REPO = 'adesurirey/prisme';

/**
 * "Signaler une erreur" (issue #8): a prefilled GitHub issue carrying the
 * Story page URL and title. Page URL passed in so the caller decides how it
 * is built from the site base path.
 */
export function reportIssueUrl(input: {
  title: string;
  pageUrl: string;
}): string {
  const body = [
    'Page concernée : ' + input.pageUrl,
    'Sujet : ' + input.title,
    '',
    'Quelle est l’erreur ?',
  ].join('\n');
  const params = new URLSearchParams({
    title: `Erreur sur « ${input.title} »`,
    body,
  });
  return `https://github.com/${REPO}/issues/new?${params.toString()}`;
}

/** Convenience for Story pages: builds the page URL from the Story slug. */
export function storyPageUrl(story: Pick<Story, 'slug'>, base: string): string {
  const root = base.replace(/\/$/, '');
  return `${root}/sujet/${story.slug}/`;
}
