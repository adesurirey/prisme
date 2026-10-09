# Membership checks have no per-build budget

Date: 2026-10-09 · Supersedes the ≤ 20 per-build Membership budget of ADR-0005

## Context

Since the tracer bullet (#15), every merge into an existing Story and every proposed new-Story seed has been gated by a Jev Membership check, and all those checks shared a per-build budget of 20 (`MAX_MEMBERSHIP_CHECKS`, ADR-0005). Pairs past the budget were never asked, and an unchecked pair was treated exactly like a refusal: it split. The check verdicts are a tri-state — `yes`, `no`, `failed` — and the materialization loop distinguishes only "yes" from everything else, so **budget exhaustion was indistinguishable from a genuine refusal**.

The budget was sized for the tracer bullet's traffic and never revisited. Its motivation — bounding spend — had quietly evaporated: the Membership checker (Jev through the OpenRouter System One gateway) costs 0.042 USD per million input tokens and output is free, so the worst build ever observed (the from-scratch rebuild of 2026-10-08, PR #38-era data commit `107bae5`) ran **481 checks in one build for roughly 0.006 USD**. A full busy day of builds at that rate costs cents.

Meanwhile the damage became measurable. Edition runs log `Membership: 20 checks this build (budget 20)` — the cap was binding on **every** build. After the uncapped 2026-10-08 rebuild produced 319 Stories (88% singletons), three budgeted builds on 2026-10-09 regressed the archive to 950 then 1276 Stories at **96–97% singletons**. Because Story files are permanent and membership never changes once assigned (ADR-0005), each starved check baked one permanent one-Article Story page. The code comment claiming a starved merge "self-heals on the next build" was wrong: only *future fresh Articles* get another chance; the wrongly split Article is never fresh again.

The guard-first ordering also inverted on crowded days: with hundreds of proposed seeds, guard checks alone could exhaust 20 checks, leaving merges unchecked — while an unguarded seed creates the failure mode ADR-0005 itself calls worse (a duplicate Story).

## Decision

Remove the per-build Membership budget entirely. There is no `MAX_MEMBERSHIP_CHECKS`, no `PRISME_MAX_CHECKS`, and no budget parameter on the Membership gate. Every candidate pair — every merge into an existing Story, every non-seed member of a proposed Story, every seed-guard candidate that survives the token-overlap pre-filter — is checked, in the same order as before (guards first, then merge pairs by headline overlap).

This is safe because the budget was never the thing preventing a runaway:

- **The gate's dedup ledger bounds every (Article, Story) pair to exactly one check.** The number of candidate pairs is finite by construction (assignments + proposed-Story members + overlap-filtered seed candidates), so the number of checks is finite with or without a cap.
- **The Grouping call is already loop-free**: one structured-output call per build, one retry with a fixed backoff, failure = build fails.
- **The total-failure rule is unchanged**: a build where every check failed (checker down, missing key with checks pending) still fails loudly and writes nothing.

In its place, one observability guard: a build issuing more than `MEMBERSHIP_CHECKS_WARN` (2000) checks logs a warning pointing at ADR-0012. It blocks nothing and degrades nothing — an unusual check count is a signal to inspect the Grouping proposal, not a license to split silently. If the warning ever fires, the response is to investigate (or add a real, loud guard), never to re-derive a silent cap.

## Considered Options

- Keep the 20-check budget (status quo): rejected — it was binding on every build and measurably fragmented the archive to 97% singletons on 2026-10-09.
- Raise the budget to a high number (e.g. 1000): rejected — it keeps a variable whose only remaining behavior is to degrade silently in an unpredictable situation, contrary to the fail-loud doctrine settled in issue #40; a milder variant (cap reached = build fails rather than splits) was also dropped as redundant with the log warning, since the ledger already makes a runaway structurally impossible.
- Adaptive budget (`max(1000, 2 × candidate pairs)`): rejected — it never binds by construction, so it is an uncapped budget with extra state.
- Add a second-chance grouping pass over refused Articles and new singletons: deferred — a distinct design question (one check target per pair today); the budget removal must be measured first, and split causes (genuine `no` vs. former budget starvation) should be observed before any such pass is built.

## Consequences

- Busy-day builds check every pair; the expected order of magnitude is a few hundred checks per build at ≈ 0.006 USD worst-case per build — negligible against the free-tier cost of the Grouping and Summary calls it accompanies.
- The seed guard keeps its first claim on the checks: with no budget, guards and merges are no longer in competition at all; guard ordering survives purely as determinism (cross-build candidates before within-build twins).
- The one-check-per-pair invariant is now the tested specification (the former cap test asserts every pair is asked exactly once).
- Wrong splits remain possible exactly where they were before — a genuine Jev `no` or an isolated `failed` still splits permanently (ADR-0005). What changes is that no split is ever caused by an arbitrary number.
- GLOSSARY.md's Membership check entry loses its "≤ 20 per build" phrasing.
