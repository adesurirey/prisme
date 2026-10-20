/**
 * Redirects between Story URLs. A manual merge deletes the absorbed
 * Story's file, so its published URL (`/<storyDay>/<slug>/`) dies with it.
 * When the absorbed Story ever entered the Edition (`everInEdition`), the
 * merge writes a registry entry and the site build emits a stub page at the
 * dead URL — a 0-second meta refresh (the static-hosting stand-in for a
 * server-side 301) pointing at the surviving Story's page.
 */

/** One side of a redirect: the Story path that makes up the page URL. */
export interface RedirectPath {
  day: string;
  slug: string;
}

/** One redirect, written by a merge. Immutable once written. */
export interface RedirectEntry {
  /** The dead URL's path: the absorbed Story's own day and slug. */
  from: RedirectPath;
  /** The surviving Story's path. */
  to: RedirectPath;
  /** ISO 8601 instant of the merge that wrote the entry. */
  createdAt: string;
}

/** The redirect registry — data/redirects.json. */
export interface RedirectRegistry {
  redirects: RedirectEntry[];
}
