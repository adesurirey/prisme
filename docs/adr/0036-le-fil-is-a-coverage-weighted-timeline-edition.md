# « Le fil » is a coverage-weighted timeline edition

Decided 2026-10-30. Adds the fourth Edition window (amending ADR-0028's
picker and ADR-0029's order note and trending wiring).

## Context

The Editions answer reading habits: « En direct » reads the
chronological thread (ADR-0029, widened by ADR-0035), « Aujourd'hui »
ranks the day's news by coverage, « 7 jours » catches up the weekly
visitor. Reading Prisme daily surfaced the missing habit: the feed a
reader checks several times a day, where big ongoing Stories stay pinned
while covered and sink as they go quiet. Neither key does that: En
direct drops a heavily covered Story twelve hours after its founding,
however loud the coverage; la Une holds yesterday's quiet giants a full
day, however stale.

The recipe lives between the two keys: rank the day pool by coverage,
decayed by silence. Measured before shipping (backtest:feed — free, no
API; 408 hourly checkpoints over 18 days of archive):

| half-life | lead turns over | top-3 residence (med) | entrants/h in top 20 | top-20 shared with Aujourd'hui / En direct |
|---|---|---|---|---|
| (la Une) | ~11 h | 17 h | 1 | — / — |
| 3 h | ~4 h | 5 h | 2 | 14 / 10 |
| 6 h | ~6 h | 7 h | 2 | 16 / 9 |
| 12 h | ~8 h | 10 h | 1 | 18 / 7 |

(En direct's own lead changes almost hourly; median top-3 residence 2 h.)

## Decision

- **The Edition gains a fourth window, « Le fil » (`/le-fil/`)**: the
  « Aujourd'hui » pool — every Story with at least one Article in the
  rolling last 24 hours, frozen included — re-ranked; no new membership
  rule, uncapped and unfloored: the pool is the cut.
- **The key (domain, `rankStoriesFeed`)**: in-window Coverage — distinct
  reporting Outlets, Opinion included (ADR-0011), the same basis as
  `rankStoriesInWindow` — times an exponential decay, halved every
  `FEED_HALF_LIFE_MS` since the Story's newest in-window Article; ties
  fall to newest desc, founding desc, id asc. Coverage makes a Story
  last, silence sinks it.
- **The half-life is 6 hours** — the measured middle: the lead turns
  over every ~6 h (vs ~11 h on la Une, ~hourly on En direct) and the
  top-20 shares 16/20 with « Aujourd'hui » and 9/20 with « En direct ».
  It is the one knob the V0 tunes by; it is measured again before it
  moves.
- **Naming (user decision)**: « Le fil » — the French news idiom for the
  live thread. Not personalized: every reader sees the same fil.
- **The page is la Une's mirror** — hero, cards, load-more, count line,
  temporal anchor « 24 dernières heures » (the pool's window: what
  differs from la Une is the order, not the window) — noindexed and out
  of the sitemap like every windowed edition (ADR-0028), running the
  per-reader trending wiring (ADR-0029): the « Faits nouveaux » badge
  and the merged visit baseline.
- **The picker becomes chronology-first** (amending ADR-0029's
  freshness-first note): En direct (pure chronology), Le fil
  (chronology weighted by Coverage), Aujourd'hui (pure Coverage),
  7 jours — the gradient from "when" to "how much".

## Consequences

- A big Story stays pinned while covered — top-3 residence reaches 85 h
  in the replay — but never survives 24 h of silence: the day pool
  filters it. The feed-platform property, bounded by the window.
- Half of Le fil's top 20 lives outside « En direct »'s 12-hour window:
  the still-covered Stories En direct drops by founding age — the
  measured entre-deux the edition exists for.
- The Edition artifact gains `feedStories`; the pipeline stamps
  `everInEdition` on the feed's members with the other windows. No wipe:
  the next build writes the key.
- GLOSSARY's Edition entry and its new Le fil entry, the Méthode page's
  reading scales, and `backtest:feed` (the replay tool that graded the
  half-life) ship with this ADR.
