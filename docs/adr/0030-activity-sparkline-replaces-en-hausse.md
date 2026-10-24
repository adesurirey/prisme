# The activity sparkline replaces « En hausse »; the chronologie chart tells the Story's life

Decided 2026-10-24. Owns the per-card activity sparkline and the Story
page's coverage chronology; supersedes ADR-0029's « En hausse » badge and
retires the per-visit baseline with it. Amends ADR-0029 and ADR-0014.

## Context

ADR-0029 re-anchored « En hausse » to per-reader Article growth: a
localStorage baseline, a sessionStorage visit window, a client-side
computation on every page that runs the signal. The signal answers "did
this Story move since *you* last looked" — but the reader's actual
question on a card is "is this Story moving, period?" The intrinsic answer
is already in the data: every Article carries a `publishedAt`, and the
Story's Article flow over time *is* the motion. A prerendered site can
draw that truth at build time and show it identically to every reader —
no baseline, no storage, no script. The pipeline's growth gate (ADR-0027)
stays untouched: it re-fires Summaries, it never showed anything.

## Decision

- **Cards show an activity sparkline** (an inline SVG, ~80×18, zero client
  JS): the Story's Articles across the edition's window, hourly bins on
  the rolling last 24 hours (daily pages, « En direct » included) and
  day bins on the rolling last 7 days (« 7 jours ») — the same rolling
  windows as the Editions themselves (ADR-0027). Monochrome
  (`currentColor`): the split per bord lives on the Story page, and color
  stays reserved for Leaning semantics. Empty bins keep a faint hairline
  stub so the window's rhythm reads and the burst height pops against it.
  An aria line carries the numbers: « 12 articles sur 24 h, pic à 6h ».
- **Articles outside a card's window are excluded, never clamped** into
  an edge bin — a fabricated midnight burst is worse than a small
  mismatch with the « N articles » count. Bin edges are clock hours,
  or Europe/Paris midnights for day bins (a DST switch yields one 23 h
  and one 25 h bin; never a fixed 24 h stride).
- **The Story page gains the chronologie de couverture** between the
  « N articles de N médias » heading and the Article list: a stacked
  histogram (~120 px) of the Story's whole life — first→last Article,
  hourly bins while the span stays within 48 hours, day bins beyond —
  one segment per bord in the three Coverage colors, bottom→top in fixed
  group order. The legend is free: the Prism tabs above and the
  per-article colors below carry the same three colors with labels. A
  baseline rule, one faint mid gridline, ≈4 Paris-time ticks, and a
  native `<title>` per bin (« 18h · 5 articles · 3 gauche, 2 centre,
  1 droite »). Reading "who opened the Story" is looking at the first
  bins' bottom segment — no annotation, the stack speaks.
- **Below four Articles nothing renders** — card or page: a chart of
  three points is noise, not signal.
- **The per-visit machinery is deleted**: « En hausse », the baseline
  (localStorage), the visit session, the « Nouveau » pill hook
  (ADR-0029 already removed the marker), `revealStory`, and the
  `--trending` color. No page writes reader state for signals anymore;
  load-more and pull-to-refresh keep their storage-free behavior.
- **The sparkline sits at the meta row's right end** on the card (try
  first; fallback if it reads badly: the old badge slot above the
  title). The chart sits where it answers the heading above it.

## Consequences

- The Edition is the same for every reader on every visit: no badge is
  per-visitor anymore, and "new since I was here" is answered by « En
  direct » (ADR-0029), not by markers.
- The growth gate and the visuals decouple: a Story can re-summarize
  without its sparkline visibly moving (small in-window growth), and
  move without re-summarizing. Accepted — the sparkline shows flow, not
  synthesis.
- Cards on « En direct » reuse the 24 h window when that page ships;
  its Stories are young, so their sparklines are early-life bursts by
  construction.
- `data-coverage` disappears from the card roots (it fed the badge);
  `data-story-id` stays — load-more counts cards with it.
