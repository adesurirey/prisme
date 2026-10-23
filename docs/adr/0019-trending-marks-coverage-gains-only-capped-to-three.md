# Trending marks Coverage gains only, capped to three per visit

The per-visitor "En hausse" badge — born in an issue-less design session, colored in ADR-0014 — fired on any Story that newly entered the Edition and on any Coverage gain past max(2, 25%) with no ceiling. On the first visit of a day nearly every current-day Story badged (issue #102), and replaying a real Edition day for an active reader (six visits) put the worst visit at 81% of Stories badged. We redefine the badge: it flags only a Story the reader has already seen whose Coverage grew past max(2, ceil(baseline × 0.25)) since that reader's last visit — ranked by absolute gain, ties broken by Edition order, capped to the top three (`TRENDING_CAP`) and re-sorted to Edition order. New Stories never badge: "En hausse" is strictly a come-back signal, so a first visit of the day shows only overnight gainers. The session badge set is replaced at each visit rather than accumulated, with a 15-minute re-render guard so badges survive click-through without recomputing or eroding the baseline snapshot.

## Considered Options

- Raising the gain ratio to 0.5 or 1.0 without a cap: 0.5 still peaked at 38% on the replay; 1.0 requires doubling, which structurally excludes wide Stories — the ones where the most happened — from ever badging. The gate stays at max(2, 25%) and the cap enforces scarcity instead.
- Ranking by relative gain (gain ÷ baseline): degenerates at small baselines (+2 on a baseline of 2 outscores +5 on 15); absolute gain matches the badge's meaning — a lot happened, full stop.
- Keeping the merged session set: a day-long tab re-accumulated the very wall the cap exists to prevent.

## Consequences

- A Story the reader has never seen gets no visual signal at all; new Stories stay discoverable by position (Coverage ranking, ADR-0009). If that proves blind, a separate, quieter "new" marker is a new decision — not a reuse of the Trending badge.
- Quiet hours can show zero badges to a returning reader; that is the signal being honest, not a defect.
- Calibration knobs (`TRENDING_COVERAGE_DELTA_MIN`, `TRENDING_COVERAGE_RATIO`, `TRENDING_CAP`, `RECOMPUTE_WINDOW_MS`, `BASELINE_TTL_MS`) live in `web/src/trending.ts`. Review after observation with real reader habits; if the wrong Stories badge, tighten the gate first.
- Amended by ADR-0020: the deferred "quieter 'new' marker" exists as the « Nouveau » badge and count pill, on a baseline TTL shared with this badge and lowered to four hours. The cap survives the shorter window — the eligible pool shrinks, the tail does not (replay in ADR-0020).
- Amended by ADR-0029: the trigger becomes Article-count growth ≥ 25 % (the ADR-0027 Summaries gate, shared from the domain) instead of a Coverage gain, the max(2, …) floor and this ADR's cap of three are gone, and the badge is uncapped on every page that runs the signal.
