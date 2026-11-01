# Nouveau widens to twenty-four hours

Decided 2026-11-01. Amends ADR-0035 (issue #158): the chronological
sort's founding window doubles, 12 h → 24 h. Its ranking (latest-first)
and its uncapped rule stay as decided.

## Context

ADR-0035 widened En direct from 8 h to 12 h under the framing "the
window is a thread, not a novelty list". Spec #158 gives the thread its
final job: with the ranked sorts capped at 25 (ADR-0038), Nouveau is
the one page that carries everything — so its window must cover what
the cap cuts. A 12 h window misses the Stories founded the previous
afternoon; a 24 h window matches the ranked pool's window exactly, and
the founding-bounded membership keeps every Nouveau member a pool
member by construction (ADR-0029: a Story founded inside 24 h has all
its Articles inside 24 h).

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

- **The window widens from 12 h to 24 h** (`LATEST_WINDOW_MS`): every
  Story whose founding instant falls within the rolling last 24 hours
  before build time. Ranking unchanged — the latest-first key; no cap,
  no floor: the window is the cap, as in ADR-0029/0035.
- **The UI anchor becomes « 24 dernières heures »** (web/src/latest.ts),
  the empty state mirroring it as before.

## Consequences

- Median 36 Stories (25–65 over 19 days): the thread doubles, still
  scannable, and now overlaps the ranked pool exactly — the page the
  completest reader scrolls is the same day the ranked pages cut.
- Members remain a subset of the day pool by construction (24 ≤ 24 h);
  `everInEdition` never stamps Nouveau members (ADR-0038), and the
  Summaries budget is untouched.
- No wipe: the window applies at build; the next edition carries it.
  GLOSSARY's Edition and Nouveau entries are updated by this ADR.
