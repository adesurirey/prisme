# 0011 — Live recap threads are not_news

Date: 2026-10-09
Status: accepted
Supersedes: the `live` Kind (removed from `ArticleKind`)

## Context

Direct-live pages ("en direct") cannot be regrouped into a single Story
(issue #49): their headlines are hooks, not reports, so the Grouping model
scatters them into singleton Stories. Most of them are not reporting at all
but **recap threads**: the page is a table of contents linking to real
Articles, and its teaser lists those links ("à suivre", "à lire aussi") or
announces the thread ("notre suivi de la journée") instead of carrying
reporting prose.

Until now the Decision model had a fourth Kind, `live`, and such Articles
counted toward Coverage and flowed through grouping like news.

## Decision

1. **Remove the `live` Kind.** `ArticleKind` is `news | opinion | not_news`.
   The Decision model no longer has `live` in its vocabulary.
2. **Classify live recap threads as `not_news`** from the headline and teaser
   (ADR-0003 still holds: the model sees nothing else). The criterion is the
   teaser, not a blunt headline match: a live page whose teaser is a table of
   contents is dropped; a live page whose teaser carries substantive reporting
   prose is an ordinary news Article.
3. **They never count toward Coverage** — a consequence of being `not_news`,
   not a separate rule. A Story covered only by recap threads shows the
   corresponding Blindspot, which is honest.
4. **Forward-only**: frozen Story files keep whatever they contain (ADR-0005);
   the next edition drops newly classified recap threads naturally.

## Consequences

- The glossary "Live Story" vs Kind `live` collision disappears.
- The benchmark needs new labeled pairs for the recap-thread vs substantive-
  live boundary, sampled from real production pages, before the prompt change
  is graded; the existing benchmark had only 3 `live` samples (see
  `docs/research/decision-model-benchmark.md`).
- Genuine live blogs kept as `news` still hit the grouping weakness that
  motivated issue #49; accepted as rare, revisit if it bites.
