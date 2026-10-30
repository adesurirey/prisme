# « En direct » widens to twelve hours — a chronological thread, not a novelty list

Decided 2026-10-30. Amends ADR-0029 (the third window's length and its
15-Story ceiling) and ADR-0027's third-window note.

## Context

ADR-0029 sized « En direct » at 8 hours against a 15-Story ceiling. That
ceiling was inherited from the feature's original framing — ADR-0020's
per-reader "what's new since I was here" question, where a long list
dilutes a marker's signal. The framing has since dissolved: the markers
are gone (ADR-0029 removed them), and En direct's value is its
latest-first ranking — the one window whose question is "when", not "how
much". A reader opens it to read the thread of events over the last
hours; the list's length is the news's density, not signal dilution.
Under that framing the three Editions read as a ladder: the thread
(« En direct »), the coverage (« Aujourd'hui », ranked by importance of
coverage), the catch-up (« 7 jours », for the reader who checks in at
long intervals).

ADR-0029's own measurement already held the answer: a 12 h window
carries a median of 19 Stories (p75 25, max 48) — rejected then only
for crossing the ceiling this reframing lifts.

## Decision

- **The window widens from 8 h to 12 h** (`LATEST_WINDOW_MS`): every
  Story whose founding instant falls within the rolling last 12 hours
  before build time. Ranking unchanged — the latest-first key; no cap,
  no floor: the window is the cap, as in ADR-0029.
- **The 15-Story ceiling is lifted, explicitly.** It answered the
  superseded novelty-signal framing; nothing re-instates a cap.
- **The overlap with « Aujourd'hui » is accepted**: 12 of the day's 24
  hours, half the day's membership — but the two windows answer
  different questions ("when" vs "how much") and only the ranking
  differs. The morning page deliberately carries the previous evening:
  reading the thread overnight is En direct's job, carrying the news
  into the morning is Aujourd'hui's, and the same Story doing both is
  correct.
- **The UI anchor becomes « 12 dernières heures »**, the empty state
  mirroring it as before (web/src/latest.ts).

## Consequences

- Median 19 Stories, p75 25, max 48: the page is a timeline. Cards
  already show founding times (ADR-0029), so the thread reads without
  UI change beyond the anchor.
- Members remain a subset of « Aujourd'hui » by construction (12 ≤ 24
  h); `everInEdition` stamping and the Summaries budget are untouched.
- No wipe: the window applies at build; the next edition carries it.
  GLOSSARY's Edition and En direct entries are updated by this ADR.
