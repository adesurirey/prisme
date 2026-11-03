# Only once-in-Edition Story pages are indexed

Decided 2026-11-03. Amends the issue #75 amendment of ADR-0005: the
deletion rule stands, but its "no published URL breaks" premise had
already expired when the sitemap shipped — indexation now follows
`everInEdition`, so the deletion stays silent for the index.

## Context

Issue #75 made the end-of-run cleanup delete frozen never-in-Edition
Story files on the recorded premise that nothing links to them and no
sitemap exists. Ten days later the sitemap shipped (ADR-0028 era) and
lists every built page — including the transients: a never-in-Edition
Story page is born into the sitemap and into `/nouveau/`'s links
(noindexed but crawlable, ADR-0039/0040), lives at most ~72 h
(ADR-0027/0033), then 404s with no redirect. Steady state measured over
the first 35 cleanup runs: ~4–5 dead URLs per run (~157 total), each one
a URL the site itself had advertised to crawlers.

## Decision

- **Indexation follows permanence**: a Story page ships
  `<meta name="robots" content="noindex">` until the Story is stamped
  `everInEdition` (sticky, set while live — capped Brûlant ∪ Top members
  only, spec #158), and the sitemap lists only stamped Story URLs. The
  stamp flips while the Story is live, so the page becomes indexable
  exactly when it ranks into a capped sort — the same moment the home
  first links it.
- **The deletion rule is unchanged**: a frozen never-in-Edition Story
  file still dies at end of run. Its URL 404s — but it was never
  indexed, and search engines treat 404/410 on genuinely gone pages as
  costless.
- **External links shared from `/nouveau/` to a transient page still
  break.** Accepted: on GitHub Pages a deleted Story has no honest
  redirect target (no day page exists; the home would make a
  mass-redirect-to-home that reads as soft-404), and the volume does not
  justify tombstone machinery (the no-compat rule, AGENTS.md).
- **Merge-redirect stubs also leave the sitemap**: a sitemap lists
  destinations, not signposts.

## Considered Options

- **Tombstones** — cleanup writes dead URLs to a registry, the build
  emits meta-refresh stubs to the home: permanent machinery for ~4–5
  URLs a day, and mass redirects-to-home that search engines read as
  soft-404s. Rejected.
- **Stop deleting** (reverse issue #75): honors every external link, but
  unbounds `data/` and the build again and changes the product promise
  ("pages exist only for what was genuinely published"). Rejected.
- **Align indexation** (chosen): zero indexed dead URLs, no new
  machinery — the sitemap and the noindex read the same `everInEdition`
  flag the deletion already reads.

## Consequences

- The sitemap shrinks to the permanent set: `/`, classement, méthode,
  mentions légales, and once-in-Edition Story pages (830 of 831 files at
  decision time).
- A below-cap live Story has no search presence for the hours or days it
  sits in the pool; if it later ranks, it gains one retroactively.
  Accepted: the alternative is a URL we plan to kill.
- Already-dead URLs — indexed before this change, including the ~5,400
  killed by archive wipes — 404 on and deindex on their own; nothing is
  retrofitted (the no-compat rule, AGENTS.md).
