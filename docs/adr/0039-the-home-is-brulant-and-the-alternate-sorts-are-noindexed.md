# The home is Brûlant; the alternate sorts are noindexed

Decided 2026-11-01. Amends ADR-0028 (issue #158): the select keeps
switching one page's setting, but the setting is now a sort — Nouveau,
Brûlant, Top — and Brûlant is what the home renders.

## Context

ADR-0028 named the surface « À la une » and made every edition a window
of that one page, only the home indexed. Spec #158 re-sorts the same
three pages as the feed-platform pattern — New / Hot / Top, the press as
the voter — with the decaying Brûlant key (ADR-0041) as the default, so
real traffic exercises the new order during the test. Three real static
pages under their own URLs, no query strings, no client-side re-sort:
complete HTML for every sort, JS-free navigation through the existing
select.

Measured before shipping (454 hourly checkpoints over 18 days of
archive; cap = 25; the same table ADR-0041 grades the key with):

| variant | len med | #1 turns over | top-3 residence med/max (h) | new @10h visit gap /25 |
|---|---|---|---|---|
| Top (pure Coverage, prod) | 56 | 8 %/h | 16 / 90 | 10 |
| Brûlant without founding clock (prod Le fil) | 56 | 16 %/h | 5 / 85 | 12 |
| Brûlant τ=12 h | 56 | 26 %/h | 5 / 30 | 14 |
| **Brûlant τ=18 h (chosen)** | 56 | 23 %/h | 5 / 44 | 13 |
| Brûlant τ=24 h | 56 | 21 %/h | 6 / 48 | 13 |
| Brûlant τ=48 h | 56 | 20 %/h | 7 / 55 | 13 |
| Nouveau 24 h (proposed) | 36 (25–65) | 74 %/h | 2 / 11 | 15 |

## Decision

- **The home (`/`) renders Brûlant** — the artifact's `feedStories`
  window — and stays the only indexed sort: in the sitemap, no
  `noindex`, canonical itself. The default is deliberately Brûlant so
  the new order runs under real traffic; the Brûlant-vs-Top default
  arbitration stays open as a measured owner decision (ADR-0041).
- **`/nouveau/` and `/top/` are real static pages** — complete HTML
  under their own URLs, bookmarkable, full-page loads — each with
  `<meta name="robots" content="noindex">`, out of the sitemap, crawling
  allowed (robots.txt untouched, as ADR-0028 decided: a disallow would
  hide the page from the crawler that must read the noindex).
- **The select lists Nouveau · Brûlant · Top** — the chronology-first
  gradient ADR-0029 set, now pure chronology → decayed chronology →
  pure coverage — with the page's own sort preselected. The h1 stays
  « À la une » on every page: the sort is a setting of one page, never
  a page name.
- **The retired URLs redirect nowhere** — `/en-direct/` and `/le-fil/`
  404. They were noindexed from birth, so nothing indexed or sitemapped
  breaks, and the POC keeps no compat machinery (AGENTS.md).

## Consequences

- Exactly one indexed ordering: the near-duplicate orderings never
  compete for canonicalization, whatever their URLs.
- The temp anchors tell each window: Brûlant carries the pool's
  « 24 dernières heures », Top the build-day date, Nouveau its founding
  window (ADR-0040). Count lines render the artifact's lengths — the
  web layer never re-caps (the cap is the pipeline's, ADR-0038).
- The « Faits nouveaux » badge wiring (ADR-0029/0031) runs unchanged on
  all three pages — one code path, one merged baseline.
- SPA-style in-place re-sorting (prefetch + DOM swap) is a documented
  phase-2 enhancement over the same URLs, not a decision revisited
  here.
