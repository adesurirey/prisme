# « En hausse » marks recorded re-summarizations, and the 4 h baseline TTL is gone

Decided 2026-10-25. Amends ADR-0029 (the badge's trigger); retires
ADR-0020's 4 h TTL, its last remnant.

## Context

ADR-0029 made « En hausse » an approximation: the client guesses
"re-summarized since your visit" from Article-count growth ≥ 25 % — the
ADR-0027 gate — over baseline entries that expire after 4 h. Three
failure modes follow. A reader gone longer than 4 h sees nothing at all;
a budget-delayed rewrite without 25 % growth goes unmarked; 25 % growth
whose rewrite missed the budget badges falsely. The pipeline, meanwhile,
knows the exact fact and never recorded it.

Measured over 48 h of hourly builds (2026-10-25): of Aujourd'hui's 46
Stories, 61 % were re-summarized within any 24 h window, 9 % within 8 h.
The count-gate rule would have shown 1 badge after a 4 h absence and 0
after 24 h (the TTL kills it) — the inverse of what a returning reader
should see.

## Decision

- **The Summaries pass stamps `summarizedAt`** — the build instant — on
  a Story when it actually rewrites its Summaries (ADR-0006's write
  path, first summarization included; the model-failure and budget-miss
  paths stamp nothing). The stamp travels in the Story file and the
  Edition artifact. No backfill (POC rule): Stories summarized before
  the field exists badge from their next rewrite on — a day of builds
  re-summarizes ~60 % of the window, so the signal warms up in ~a day.
- **The badge fires exactly when `summarizedAt` is newer than the
  reader's recorded last sight of that Story.** Seen-before still
  required (ADR-0029's "never new" stands — newness is En direct's
  job); uncapped; every gap length eligible. The 4 h TTL is removed:
  comparing two recorded instants has no staleness. The baseline's
  entry shrinks to the seen-at instant (storage version bumps; the old
  count-based blob is dropped unread, POC rule again).
- **The baseline keeps a 7-day retention horizon** — a bound on
  localStorage growth, never an eligibility rule: the oldest window the
  signal runs on is Aujourd'hui's 24 h, so a week-old entry is dead
  weight either way.

## Consequences

- Long-absence returns are dense: a daily reader sees ~28 badges on 46
  Stories — the honest answer to "everything re-summarized since I
  left", accepted; hourly readers see 1–4.
- `grewAtLeast` returns to being the pipeline's watermark gate only;
  the web no longer imports it.
- The 15-min session window is untouched: click-throughs and reloads
  inside one visit show the same badges without recompute.
- GLOSSARY's Trending Story entry is updated by this ADR.
