# Article volume weights Coverage and Exposure

Date: 2026-10-18 · Revises: ADR-0009, ADR-0011 (the "counts once" rule), ADR-0016

## Context

ADR-0016's rule was explicit: an Outlet counts once whatever its number of Articles — both readings read distinct Outlets, Couverture as a raw count, Exposition as √(Reach) per Outlet. The rationale was "Exposure reads influence, not volume": counting Articles would reward a mega-feed independently of the Story's importance.

Reader-side observation breaks that rationale. Two questions frame the bar: Couverture asks *qui en parle* — how many voices, with what intensity of production; Exposition asks *ce que les gens voient* — an Outlet's readers see the Story once per Article the Outlet publishes about it. A group whose outlets write twice as many Articles on a Story does not "talk about it as much" as the group that wrote half as many, and its readers see it more. A small outlet that dedicates three quarters of its day's output to one Story gives that Story far more of its readers' attention than one Article suggests — today both weigh identically. Also: a single national daily with 20 live Articles on a breaking Story represents a factual commitment the distinct-Outlet reading flattens to 1.

Volume is the only intensity signal available: Prisme has no social-share data, no reader analytics. The article count per Outlet on a Story is an approximation with known blind spots — a live-blogged event inflates it, a single much-reprinted editorial undercounts it — accepted as such, documented here.

## Decision

- **Volume weights both readings, the same way.** Each distinct reporting Outlet weighs `count ** VOLUME_WEIGHT_EXPONENT` (a new named constant, 0.5 = √, first cut — same status as `EXPOSURE_COMPRESSION_EXPONENT`). Couverture's weight per group is the sum over its Outlets (new `coverageWeights` in the domain); Exposition's weight per Outlet is `√(Reach) × √(count)`. The two readings keep their one-bar two-scales structure; only the scales' inputs change.
- **Counting follows `isReporting`** — news, live and Opinion (ADR-0011). Live coverage counts fully: flood is the signal, not noise to filter.
- **The raw counts stay displayed.** The meta line keeps « x médias » (distinct) and its per-group breakdown as integers; the *rates* (« 46 % droite ») and the bar widths are volume-weighted. The aria-label names the weighting (« Couverture, pondérée par le volume d'articles ») so screen readers never read a weighted number as a count.
- **Blindspots stay distinct-Outlet** (`coverageCounts`): a Blindspot is a silence — a group with no Outlet at all — not a quiet one. One loud Outlet still erases its group's Blindspot, as ADR-0011 decided.
- **No cap on the multiplicative product.** The sqrt compressions already bound the gap; a cap would add an arbitrary second constant. The shares are a lens, not a vote — an Outlet dominating the weights says what it says.
- **Grading.** `pnpm backtest:exposure` (free, no API) replays the archive and prints per-Story shares for the candidate matrices: volume brut/√/log × Reach brut/√/log. The deferred ADR-0016 comparison of Reach exponents happens in the same tool.
- **Absolute count first, relative share later.** The count is live from the archive today. A relative weight (share of the Outlet's own day output) needs a persisted per-Outlet daily counter that does not exist — the feeds' article counts are feed-size dependent, not edition-wide. That decision gets its own ADR once the counter exists.

## Considered Options

- **Volume in Exposition only** (the original ask): rejected — the same asymmetry that mis-states Exposition mis-states Couverture; "la gauche en parle autant alors qu'elle a écrit deux fois plus" is a Couverture bug too.
- **Raw count (no compression)**: rejected as first cut — a 20-Article live outlet would open a 20× gap, worse than the √(Reach) gap √ already bounds. Kept as a candidate for grading.
- **Cap per Outlet**: rejected — arbitrary constant, ungradeable with the same tool.
- **Relative share now**: deferred — needs new persisted data (see Decision).
- **Separate third bar mode "Volume"**: rejected — one bar, two readings stays the UI contract; volume enters the readings rather than becoming its own reading.

## Consequences

- Both readings are no longer integers per Outlet; the bar's aria-label and the meta line's counts stay raw so the honest numbers survive.
- A mono-Article Story's weights are unchanged (√1 = 1) — the change only moves multi-Article coverage.
- `backtest:exposure` becomes the grading tool for both exponents; constants change in one place each.
- Glossary entries for Coverage and Exposition updated; the "counts once" sentence of ADR-0016 is superseded on this point.
