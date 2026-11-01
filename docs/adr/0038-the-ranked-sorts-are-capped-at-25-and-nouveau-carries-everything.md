# The ranked sorts are capped at 25; Nouveau carries everything

Decided 2026-11-01. Amends ADR-0022's uncapped rule (issue #158); the
Summaries budget it also decided is untouched.

## Context

ADR-0022 removed the Edition's 20-Story cap for one reason: an AI budget
must never hide a Story from readers. The rule it left — "the Edition is
uncapped" — made the ranked pages grow with the 24-hour pool: a median of
56 Stories (min 31, max 78 over 19 days of archive). Reading the site
daily showed the cost: a first-time mobile visitor lands on a list that
takes days to internalize; the owner reads only the small live page
(~20 Stories, complete, scannable). The ranked pages stopped welcoming
anyone.

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

- **Brûlant and Top slice at RANKED_CAP = 25** (`pipeline/src/ranking.ts`):
  the cap cuts each key's order, it never re-decides membership. Always
  active — the pool never fell below 31 Stories over 19 days of archive.
  25 renders as the load-more initial batch plus one click; the button
  mechanics are unchanged (ADR-0022's).
- **Nouveau carries everything**: uncapped as before — the window is the
  cap (ADR-0029/0035), so the one page where scrolling to the end means
  having missed nothing still exists.
- **`everInEdition` stamps only the capped Brûlant ∪ Top members** —
  never Nouveau, never the pool tail (spec #158's stamping rule; the
  never-ranked deletion rule of ADR-0005/0022 keeps working).

The cap alternative was measured at 30: more distinct Stories seen over
19 days (738 vs 721 for Brûlant τ=18 h), 15/30 new per 10 h gap. 25 was
the owner's call; 30 stays a measured alternative, re-decidable by the
free replay tool.

## Consequences

- Median home length drops from 56 to ≤ 25.
- **ADR-0022's "every Story in the initial HTML" rationale is partly
  given up, deliberately.** That argument was crawlability: a
  fetch-based load-more would hide Stories 21+ from search engines. It
  still holds inside each page — everything a page lists ships in its
  HTML — but the ranked pages now list only their top 25. The cut tail
  stays crawlable on `/nouveau/` (noindexed, crawling allowed,
  ADR-0028/0039) and every Story keeps its own indexed page; only the
  ranked orderings cut, and they were near-duplicates by design.
- The AI-budget rule survives untouched: nothing is hidden for budget
  reasons — the cap is an editorial scannability decision, and the
  Summaries budget still rations calls, never visibility.
- No wipe and no migration: the cap applies at the next build; sticky
  `everInEdition` flags stamped by the old uncapped pools are historical
  (POC, no backward compatibility).
