# « En direct » is a latest-first edition; « En hausse » marks Article growth; « Nouveau » is gone

Decided 2026-10-24. Owns the third Edition window, the per-reader « En
hausse » signal's new trigger, and the removal of the « Nouveau » marker.
Supersedes ADR-0020; amends ADR-0019, ADR-0027 and ADR-0028.

## Context

ADR-0020 answered "what's new since I was here" with per-reader markers
inside a Coverage-ranked list: « Nouveau » badges plus a count pill. For a
reader returning several times a day, that answer has the wrong shape —
newness is scattered through a list ordered by something else, and no
signal marks the Stories that *changed*. Meanwhile the pipeline already
owns a precise definition of "this Story materially changed": the
ADR-0027 growth gate, which re-fires a Summaries pass when a Story's
Article count grows ≥ 25 % since the pass last ran.

Measured over the archive (hourly checkpoints, seven days): a 12 h window
holds a median of 19 Stories (p75 25, max 48) — above the 15-Story
ceiling set for this feature; 8 h holds a median of 12 (p75 17, max 41).

## Decision

- **A third Edition window, « En direct »** (`/en-direct/`,
  `latestStories` in the Edition artifact): every Story whose founding
  instant (ADR-0026) falls within the rolling last **8 hours** before
  build time. No cap, no floor — the window is the cap. Members are by
  construction always ingestion-live (the 24 h floor) and always a
  subset of « Aujourd'hui », so `everInEdition` stamping and the
  Summaries budget are untouched.
- **Ranked latest-first**, breaking with Coverage: founding instant
  desc → newest Article desc → whole-life Coverage desc → id asc —
  deterministic like every ranking key, but the one window whose
  question is "when", not "how much".
- **The editions picker reads freshness-first**: En direct, Aujourd'hui,
  7 jours — window length, freshness descending; « 30 jours » slots
  after « 7 jours » when it ships (amending ADR-0028's enumeration).
- **« En hausse » fires on Article growth** (amending ADR-0019): a Story
  the reader has seen — a fresh baseline entry, the 4 h TTL stands —
  badges when its Article count grew ≥ 25 % since that visit, the same
  function that gates the Summaries pass, shared from the domain package
  so the badge can never drift from what the pipeline re-synthesized.
  The max(2, …) Outlet floor and the cap of three are gone: the scaled
  threshold is the scarcity mechanism, and young Stories — exactly En
  direct's population — were the ones the floor silenced. Uncapped on
  every page that runs the signal.
- **The baseline merges** across pages and visits: a visited page's
  cards overwrite their entries, everything else persists with its
  original seen-at, pruned lazily by the TTL. The baseline means
  "everything I've seen", not "the last page I opened". « 7 jours »
  stays badge-free and never writes the baseline.
- **ADR-0020's « Nouveau » marker is superseded and removed**: badge,
  count pill and their bookkeeping. Newness is En direct's job — a page,
  not a marker. Nothing replaces the pill; the select is the affordance.
- **The temporal anchors return on every screen** (amending ADR-0028):
  they were hidden under `sm:` to make room for the pill; the pill is
  gone. En direct's anchor is « 8 dernières heures »; its empty state
  names the window and the last collection time — honest about an
  hourly-built static site.
- **Cards show the founding time on every edition**: no prefix — « 21:11 »
  today, « hier à 21:11 » yesterday, « 7 oct. » older — so every list
  reads as a timeline.

## Consequences

- The Edition artifact gains `latestStories` on the next scheduled
  build; no compatibility code — `data/` is disposable (ADR-0002, POC
  rule).
- The badge is an exact-rule approximation of "re-summarized": its
  reference point is the reader's last visit, the pass's is its
  watermark. A first-budget Summary rewrite without 25 % growth does
  not badge; accepted.
- The baseline stores Article counts, not Outlet Coverage; both storage
  versions bump (POC rule again).
- Sarcelle's meaning (ADR-0014, sharpened by ADR-0020) narrows back to
  one species: « this grew since your last visit ».
- The GLOSSARY's Edition and Trending Story entries are updated, the New
  Story entry removed, and an En direct entry added by this ADR.
- Amended by ADR-0035: the window widens from 8 h to 12 h and the
  15-Story ceiling is lifted — the ceiling answered the superseded
  per-reader novelty framing; En direct is the chronological thread, and
  the list's length is the news's density.
- Amended by ADR-0036: « Le fil » takes over as the coverage-weighted
  timeline — the reader-visits-several-times-a-day habit En direct never
  fully served — and the picker's order note reads chronology-first.
