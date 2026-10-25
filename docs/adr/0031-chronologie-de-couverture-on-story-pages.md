# The chronologie de couverture charts the Story's life on its page

Decided 2026-10-24. Owns the Story page's coverage chronology — a stacked
prerendered chart of the Story's Articles over its whole life, split per
bord. Leaves the per-card surfaces untouched: « En hausse » stays what
ADR-0029 made it, and the cards carry no chart.

## Context

Every Story page already lists its Articles with per-bord colors; what it
lacks is the shape of the coverage over time — when the media picked the
event up, when it peaked, whether one bord drove it or all three followed.
That shape is intrinsic to the data: every Article carries a `publishedAt`,
and the Outlet's Leaning (ADR-0001) colors it. A prerendered site can draw
it at build time with zero client JS, identical for every reader.

## Decision

- **The Story page shows the chronologie de couverture** under the
  « N articles de N médias » line: a stacked histogram of the Story's
  whole life (first→last Article), one segment per bord
  (gauche, centre, droite — `coverageGroup()` of the Outlet's Leaning),
  colors `--gauche/--centre/--droite`. No caption or legend chips: the
  Prism tabs and the article list's own colors are the legend.
- **Window**: the Story's whole life. Hourly bins while the span stays
  within 48 hours, Paris-midnight day bins beyond (DST-safe: 23h/25h
  bins, never a fixed 24h stride — same rule as paris-date.ts).
- **Chart**: a ~70px ribbon (Datadog-log-flow scale), contiguous bars,
  a baseline only — no mid gridline, it emphasized the empty lead on
  fresh stories — 3–4 sparse ticks, a native SVG `<title>` per bin
  (« 16h · 12 articles · 7 gauche, 4 centre, 1 droite ») and an aria
  label with the span (« Chronologie des publications : 441 articles sur
  14 heures »).
- **Minimum axis, not a minimum count**: the hourly axis never runs
  shorter than 24 hours — a Story that burst an hour ago gets its burst
  at the right end of a 24 h ribbon (Datadog-log-flow scale, ~70 px),
  never a one-bar stub. The axis only grows past that when the life
  does.

## Consequences

- `web/src/story-activity.ts` holds the binning math; `ActivityChart.tsx`
  renders it. Both pure build-time code — no script ships to the reader.
- The card surfaces keep ADR-0029's per-reader badge unchanged; the two
  mechanisms coexist (the badge answers "what moved since you last
  looked", the chart answers "how did this Story unfold").
- Every Story page carries the chart; the badge's growth gate (ADR-0027
  pipeline, ADR-0029 client) is untouched.
