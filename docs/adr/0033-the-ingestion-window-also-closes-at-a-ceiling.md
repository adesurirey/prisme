# The Ingestion window also closes at a ceiling

Amends ADR-0027 (whose silence rule stays in force for the common case).
Decided 2026-10-27.

ADR-0027's silence rule never closes a continuously covered event: every
absorbed Article extends the window 12 hours past itself, so coverage
that never pauses keeps the Story live forever. The Trappes attack Story
reached 383 Articles over 4.0 days (founding → newest), past ADR-0027's
own measured max lifetime (103 h, replay) and on la Une continuously
since 2026-10-23 — watch-protocol item 5 of ADR-0027 firing. Mega-Stories
remain the feature (« one place per event, whole »); only the
pathological tail is bounded. The remedy is a ceiling, not a tighter
silence: shrinking `INGESTION_SILENCE_MS` was analyzed and rejected —
it re-fragments the median Story and does not fix the drift-blind
window.

## Decision

The Ingestion window becomes
`[founding, min(max(founding + 24h, newest + 12h), founding + 72h)]`, in
instant arithmetic — a new constant, `INGESTION_CEILING_MS` = 72 h
(`pipeline/src/liveness.ts`).

- **The floor and the silence term are untouched.** ADR-0026's
  guarantee (every Story at least one full day) and ADR-0027's
  extension-by-coverage stand unchanged.
- **The ceiling binds only in the extension regime** — iff the newest
  Article lands past `founding + 60h`; before that, `newest + 12h` stays
  under `founding + 72h` and the rule is exactly ADR-0027's. The first
  60 hours of any Story are governed by the silence rule alone.
- **At the ceiling the Story freezes, permanently (ADR-0005)**, and the
  same-event coverage that arrives later births an Episode (ADR-0018)
  that threads the Story's Topic (ADR-0024) — the mechanism the rallies
  Story already exercised (born separately, inherited its Topic at
  confirmation). The ADR-0030 birth guard only checks live Stories, so
  a ceiling-closed Story never absorbs a birth: the handoff to the
  Episode mechanism is structural, not a special case.
- `EPISODE_MAX_AGE_DAYS = 7` (grouping.ts) comfortably contains a 72 h
  chain: every day-3+ Episode stays inside the Topic age window.
- No civil-date logic: the ceiling is pure elapsed time, DST-proof like
  the rest of the window rule.

## Evidence

Lifetime replay over the 541 Stories on disk (build
2026-10-27T09:01Z; founding = min `publishedAt`, newest = max):

- lifetime > 24 h: 24 · > 36 h: **10** · > 60 h: **2** (median 17 h,
  p90 30 h, max 103 h at ADR-0027's replay baseline).
- The > 60 h pair is the pathology: Trappes 95.2 h (383 Articles),
  Loiret opposants 92.3 h (102). Nothing else comes close — the next
  lifetime is 56.0 h.

A **48 h ceiling was measured and rejected**: it binds iff the newest
Article lands past `founding + 36h`, which reshapes **10** Stories —
including four 37–46 h sagas and three two-day stories (manifestations
56 h, Macron interdiction 52 h, Netanyahou 50 h) that read naturally as
one Story — to catch a tail of two. 72 h catches exactly the two
pathologies and leaves ADR-0027's p90–p99 untouched.

## Rollout: live, no wipe

Windows are derived on demand, never stored — the ADR-0027 precedent
applies unchanged. Story files need no translation, no compat branch;
every consumer of `isLive`/`ingestionIsOpen`/`joinsIngestionWindow`
(grouping, cleanup, summarize, frontpage, edition-history) treats a
ceiling-freeze exactly like a silence-freeze — none assumes « frozen ⇒
the window ran to newest + 12h ».

One transitional effect, decided rather than accidental: at the deploy
build, exactly one live Story has its newest Article past
`founding + 60h` (Trappes; Loiret already closed by silence) — it
freezes mid-coverage and its day-4 coverage births an Episode at the
same build. Steady-state behavior, arrived mid-story. The archive is
kept (ADR-0027's rejection of the wipe stands; `edition:wipe` is paid
and destroys published Story files, ADR-0005).

## Watch protocol (7 days)

1. **Episode-proposal rate** — free via `pnpm backtest:episodes`;
   baseline ≈ 6/day Topic inheritances (ADR-0027 item 1). The ceiling
   adds saga continuations; the lexicon's noisy proposals (the current
   backtest shows 0.30–0.50-score proposals onto the Trappes thread)
   are disposed by Membership as designed, but their volume is the
   thing to watch.
2. **Ceiling-fires count** — free lifetime replay; expected ≤ 1/week
   after the initial fire (2 of 541 over the archive's ten days).
3. **Membership check volume per build** — a glance; the guard and
   Topic confirmations grow with the extra Episode births.

## Considered Options

- **MAX_AGE = 48 h**: measured (above) — ten reshapings to catch a tail
  of two; rejected.
- **Shrinking `INGESTION_SILENCE_MS`**: analyzed and rejected in-session
  — it re-fragments the median Story (ADR-0027 measured the same
  failure for the pure-rolling rule: 252 of 339 frozen earlier) and
  does not bound a continuously covered chain at all.
- **A count or Outlet cap** (> 40 Articles / > 15 Outlets): retired in
  ADR-0027 — it was already void, and it caps the file, not the chain.
- **Un-freezing Stories when Membership confirms a later match**:
  rejected in ADR-0027 — kills fragments but reintroduces the
  unbounded mega-Story with no closure rule at all.
- **`pnpm edition:wipe` before shipping**: rejected — paid, destroys
  published Story files (ADR-0005), and buys nothing: derived windows
  self-correct at the next build.

## Consequences

- **A Story's chain is at most 72 hours.** Beyond it, « come back six
  months later » reads the Topic thread, not one file — the Event
  remains one place through the Topic link (ADR-0024) even though no UI
  reads Topics yet.
- **Mega-Story size is bounded by whatever lands in 60 hours of
  continuous coverage** (Trappes-class: ~350 Articles), which also caps
  the Title-pass and Summaries payload growth ADR-0027 flagged for its
  worst merged thread (692 Articles over 4 days).
- **Episodes and Topics become slightly more frequent** for sagas — the
  ceiling converts what the silence rule would have absorbed into
  Episode births, each one a Membership-confirmed Topic thread.
- The GLOSSARY's Ingestion window, Live Story and Frozen Story entries
  are updated by this ADR.
- No schema change, no migration, no compat code (POC rule): the
  formula is one expression, the tests are colocated
  (`liveness.test.ts`), and the archive is untouched.
