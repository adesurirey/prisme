# The static site is the app's API

Decided 2026-11-09 (issue #171).

## Context

The mobile app (Expo, one codebase for iOS and Android) reads the
Edition at runtime, but the site is a fully static Astro build on
GitHub Pages and `data/` is the database (ADR-0002): the pipeline's
JSON never leaves the repo today — the site ships HTML only. The app
needed a data source that adds no infrastructure, keeps ADR-0003 (no
teaser or outlet text beyond what the site already publishes) and
inherits the workflow's guarantee that the deployed HTML and the
committed JSON never disagree.

## Decision

- **The web build publishes the pipeline's `edition.json` and
  `outlets.json` as-is** at the site root —
  `https://leprisme.info/edition.json` (≈860 KB raw, ≈190 KB gzip,
  all ranked Stories embedded complete with Articles, Summaries and
  Differences) and `https://leprisme.info/outlets.json` (≈1.4 KB
  gzip). A CI step in `edition.yml` copies both from `data/` into the
  site output dir after `astro build`, before the pages-artifact
  upload: the HTML a reader loads and the JSON the app fetches always
  come from the same commit.
- **No transformation, no second shape**: the app types the files
  with `@prisme/domain` unchanged; nothing is trimmed or re-bundled.
  Both files contain only what the HTML already renders, so exposure
  does not grow (ADR-0003 holds; `imageUrl` stays a hotlink, never
  stored).
- **Never published**: `classifications.json` (internal cache),
  `topics.json` (no UI reads it, ADR-0024), `redirects.json` (no deep
  links in the app's v1), `data/stories/*.json` (superseded by the
  embedded lists).
- **The app fetches with `If-None-Match` and disk-caches the last
  good artifact** — render instantly, revalidate in the background,
  keep the old artifact on failure; `builtAt` is the honesty stamp.
  No contract versioning: app and site change in lockstep from one
  repo (POC, AGENTS.md).

## Consequences

- Freshness is bounded by the hourly CI run plus GitHub Pages'
  10-minute edge cache — sufficient for an Edition that itself turns
  over hourly.
- No server-side logic will ever exist behind these URLs: per-user
  payloads, push fan-out and widget refresh become design problems of
  their future phases, not of this contract.
- A real backend, if one is ever wanted, arrives as a new decision
  superseding this one — the app's data layer stays one module to
  swap.
