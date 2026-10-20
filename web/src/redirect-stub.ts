import type { RedirectEntry, RedirectRegistry } from '@prisme/domain';

/**
 * The redirect stub pages (data/redirects.json, written by the manual-merge
 * CLI): for every registry entry whose dead URL no longer has a Story file,
 * the build emits a page at the old `/<day>/<slug>/` path — a 0-second meta
 * refresh to the surviving Story's page. Static hosting has no server-side
 * 301; a 0-delay meta refresh paired with a canonical link to the target is
 * the standard stand-in (search engines treat it like a permanent redirect
 * and consolidate the signals on the target URL).
 */

/** The entries that need a stub: every entry whose `from` slug is not the
 * slug of a Story file on disk (a repointed or newly merged-away Story). */
export function stubsToEmit(
  registry: RedirectRegistry,
  storySlugs: Set<string>,
): RedirectEntry[] {
  return registry.redirects.filter((r) => !storySlugs.has(r.from.slug));
}

/** The stub page: standalone HTML, no site layout — it exists to bounce. */
export function redirectStubHtml(entry: RedirectEntry, site: string): string {
  const origin = site.replace(/\/$/, '');
  const target = `${origin}/${entry.to.day}/${entry.to.slug}/`;
  const local = `/${entry.to.day}/${entry.to.slug}/`;
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="0; url=${target}">
    <link rel="canonical" href="${target}">
    <title>Page déplacée — Prisme</title>
  </head>
  <body>
    <noscript><meta http-equiv="refresh" content="0; url=${target}"></noscript>
    <p>Cette page a déménagé — <a href="${local}">suivez ce lien</a>.</p>
  </body>
</html>
`;
}
