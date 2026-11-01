# « Le fil » gains a founding clock and becomes Brûlant; the sorts are Nouveau, Brûlant, Top

Decided 2026-11-01. Amends ADR-0036 (issue #158): the feed key gains a
second, never-resetting decay clock, its page becomes the home, and the
three windows are re-sorted and renamed as the feed-platform pattern
(New / Hot / Top) — the press as the voter, each Article an upvote,
heat decaying. The naming decisions of ADR-0028 (one page, a select)
and ADR-0029 (the picker's chronology-first order) carry over; ADR-0038
carries the cap, ADR-0039 the indexation, ADR-0040 the Nouveau window.

## Context

The Le fil key halved a Story's weight every six hours of silence —
but the clock reset on every new Article, so a heavily covered Story
kept resetting its own decay and squatted the top while coverage kept
flowing. Measured over 454 hourly checkpoints (2026-10-12 →
2026-11-01): median top-3 residence 16 h and maximum 90 h for pure
Coverage; the Le fil key improves the median to 5 h but still pins
Stories up to 85 h. The missing knob is the Hacker News gravity clock:
a decay on the Story's *age*, whatever the coverage flow. The same
measurement graded the founding half-lives:

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

- **The key (domain, `rankStoriesFeed`) gains a founding clock**: the
  in-window Coverage × silence decay of ADR-0036, times an exponential
  founding decay — halved every `FEED_FOUNDING_HALF_LIFE_MS` = 18 h
  since the Story's founding instant (ADR-0026), never resetting. The
  measured bracket is 12–24 h: 12 h turns over fastest but cuts
  still-covered Stories harder (max residence 30 h), 24 h leaves the
  tail longer (48 h); 18 h halves the max top-3 residence to 44 h while
  13 of 25 slots still change between visits 10 h apart. 12/24/48 h
  stay re-gradable by the free replay tool (`backtest:feed`).
- **The names retire**: « Le fil », « En direct » and « Aujourd'hui »
  disappear as page names; their mechanisms survive as the Nouveau,
  Brûlant and Top sorts of « À la une » (which keeps naming the page,
  ADR-0028). Readers experience three orderings of one list, not three
  channels.
- **The fallback vocabulary is recorded, not chosen: Nouveau /
  Tendance / Top.** « Tendance » was rejected this pass because it
  promises growth — *monter* — while the sort delivers decaying heat;
  the honest verb for Brûlant is *retomber*. If Brûlant reads wrong
  after the test, Tendance is the pre-agreed replacement — a measured
  decision, not a rewrite.
- **The default (Brûlant, the home) is re-decidable the same way.**
  Brûlant and Top capped tops share 18/25 Stories — the eventual
  arbitration is about order and ~7 slots, not two different pages —
  and changing the default later is one preselected option, graded by
  the same replay.

## Consequences

- However loud the coverage, no Story squats the top for days: max
  top-3 residence 85 h → 44 h, and between two visits 10 h apart 13 of
  25 slots change (vs 12 for the Le fil key).
- The Edition artifact's keys (`latestStories`/`feedStories`/`stories`)
  are unchanged; the web reads them as Nouveau/Brûlant/Top (code keys
  `new`/`hot`/`top`). No wipe, no migration.
- The brand brief's word-discipline rule is amended with this ADR: the
  widely adopted anglicism *Top* is allowed where it aids navigation —
  Nouveau / Brûlant / Top is the motivating case. GLOSSARY's Edition,
  Nouveau, Brûlant and Top entries ship with it.
- Lexical adjacency between « Nouveau » and the « Faits nouveaux »
  badge (which already means growth) is accepted for this pass;
  revisit after the test.
