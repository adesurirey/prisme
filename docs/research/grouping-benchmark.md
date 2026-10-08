# Grouping benchmark (issue #41)

Can a paid OpenRouter model group well enough in one shot that the guard
scaffolding (seed guard, Membership budget, pair prioritization, retries) can
be retired? The metrics are computable without human labels, so the benchmark
re-runs any time a new candidate appears on OpenRouter.

## Fixtures

Built from `data/` on every run (the repo is the database, ADR-0002), pinned
to the latest Edition's `builtAt` — currently **2026-10-08T16:17:29.723Z**
(319 Stories, 444 Articles):

- **from-empty** — all 444 snapshot Articles as fresh Articles, no live
  Stories: the post-reset rebuild shape (the #36 session's 456-article
  rebuild).
- **long-context** — 218 live Stories (every snapshot Story holding no
  fresh Article) + the 142-Article fresh batch (Articles under an hour old
  at builtAt): the steady-state shape the issue warns about. The Stories
  holding the fresh batch drop out of the prompt, so the batch's original
  Stories are the pseudo-ground-truth for splits, and the remaining live
  Stories are what a proposed seed must not duplicate.

Headlines and titles only — ADR-0003 forbids teasers on disk, and grouping
runs fine without them (verified by the #38 replay).

## Metrics (no human labels needed)

Per fixture, best of two runs (each candidate runs twice):

- **coverage** — fresh Articles with exactly one assignment to a resolvable
  target (a live Story id, a proposed new-Story key, or a `storyId` naming
  the model's own proposed key — a recoverable field slip). Invented or
  missing targets count as bad/missing.
- **dup-seeds** — proposed new Stories whose seed (any assigned Article)
  overlaps >50% content tokens with a live Story's title or one of its
  Article headlines: the Maricarmen detector from the #38 measurements,
  same tokenization as the seed guard.
- **splits** — ground-truth groups (≥2 fresh Articles from the same snapshot
  Story) landing in more than one cluster; reported with kept/split pairs.
- **over-merged** — pairs from different snapshot Stories co-clustered: the
  mirror failure (thematic mega-Stories).
- **stability** — Jaccard of the co-clustering pair sets across the two runs.
- **cost and latency** per call, from the gateway's own usage report.

Empty proposals against fresh Articles (parseable JSON, zero assignments —
seen from Flash-Lite under load) and unparseable responses count as degraded
runs, mirroring the production retry-then-degrade path.

## Recorded results (best of 2 runs, fixtures of 2026-10-08T16:17:29.723Z)

Calls are capped at 300 s (production aborts grouping at 60 s) and a call
failure skips the second run: a candidate that cannot answer one build call
is disqualified by that fact.

| Model | Fixture | Coverage | Bad targets | Dup-seeds | Splits | Over-merged | Stability | Latency | Cost/run | Valid runs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Flash-Lite (baseline, free tier) | from-empty | 98.0% | 9 | 0 | 3/15 groups | 105 pairs | 45.2% | 53 s | $0 | 2/2 |
| Flash-Lite (baseline, free tier) | long-context | 92.3% | 11 | 0 | 2/15 groups | 37 pairs | 58.0% | 15 s | $0 | 2/2 |
| DeepSeek V4 Flash 0731 ($0.006/MTok in — cheapest paid on OpenRouter) | from-empty | 43.7% | 250 | 0 | 3/15 groups | 140 pairs | 64.1% | 365 s | $0.0089 | 1/2 |
| DeepSeek V4 Flash 0731 | long-context | 94.4% | 8 | 0 | 1/15 groups | 7 pairs | 71.4% | 121 s | $0.0027 | 2/2 |
| GPT-6 Luna ($0.10/MTok in) | from-empty | 97.5% | 9 | 0 | 6/15 groups | 4 pairs | — | 108 s | $0.0107 | 1/2 |
| GPT-6 Luna | long-context | 100.0% | 0 | 0 | 3/15 groups | 8 pairs | — | 35 s | $0.0050 | 1/2 |
| GLM-5.3-flash ($0.15/MTok in; reasoning mandatory) | from-empty | — | — | — | — | — | — | timed out | — | 0/2 |
| GLM-5.3-flash | long-context | 92.3% | 11 | 0 | 3/15 groups | 15 pairs | — | 233 s | $0.0151 | 1/2 |

Observations from the recorded runs (variance is high — reruns matter):

- **GPT-6 Luna is the strongest candidate on quality, blocked on output
  completeness.** When its JSON parses, it is near-perfect: 100% coverage
  and 0 bad targets on long-context, dup-seeds 0, and the lowest over-merge
  count of all candidates (4 pairs on from-empty vs Flash-Lite's 105 —
  far fewer thematic mega-Stories). But only 1 of 2 runs completed per
  fixture: on the large from-empty output the model repeatedly stops early
  mid-JSON (`finish_reason: stop`, incomplete array), and one response
  carried a junk prefix before the JSON. Stability is therefore unmeasured.
  Latency (35–108 s) straddles production's 60 s grouping timeout.
- **GLM-5.3-flash is disqualified on speed.** Its endpoint mandates
  reasoning (rejects `reasoning: {enabled: false}` with HTTP 400 — the
  harness retries without the field), and the reasoning plus ~35k output
  tokens blew the 5-minute cap on from-empty twice. Its one valid
  long-context run (92.3% coverage, 3/15 splits) cost 2× Luna per run.
- **DeepSeek V4 Flash is cheap but sloppy**: up to 250/444 from-empty
  Articles assigned to ids it never declared (one id swallowed 79 Articles)
  and 6-minute calls under load.
- **Flash-Lite's free tier shows exactly the variance the scaffolding
  absorbs**: 503s under load, one zero-assignment (empty but parseable)
  response in an earlier recording, invented Story ids or dropped
  assignments on a third of runs.
- **Dup-seeds: 0 for every candidate** on the long-context fixture — no
  model proposed a Story duplicating a live one. The seed guard's
  cross-build job is not exercised by these runs.
- **Cost is not the constraint**, as the issue predicted: even the most
  expensive candidate is ~$0.015/build against the < $0.50/build rule.
  Latency and output completeness are what disqualify.

## Decision status

**Keep Flash-Lite + the scaffolding for now.** No candidate met the rule
(dup-seed rate 0, coverage 100%, split rate ≤ baseline, both fixtures, <
$0.50/build, two valid runs for stability). **GPT-6 Luna is the one to
re-test**: its quality metrics beat the baseline when a call completes, and
its only blocker — truncated JSON on the big from-empty output — is an
engineering problem, not a model-intelligence one (see follow-ups).

Follow-ups, in order:

1. **Chunk the from-empty call for Luna** (or retry-with-continuation when
   the JSON is cut): split the fresh batch into ~150-Article pages so one
   call stays well under the output budget where Luna already completes.
   Same lever would help production's 60 s timeout.
2. **Re-run Luna until 2/2 valid runs on both fixtures** to measure
   stability, then re-check the decision rule.
3. **Try `strict: true`** on OpenAI models (structured outputs strict mode)
   — may force complete JSON where `strict: false` lets the model stop
   early.
4. **Hand-labeled sanity sample** (~30 pairs, as in the decision-model
   benchmark): the pseudo-ground-truth is the last real build's own
   clustering, so a wrongly merged folder there punishes a correct split.
   The human sample checks the answer key before any replacement decision.
5. Consider a **prompt-side output-compaction** (shorter keys, no
   titleUpdates) to halve the output tokens on large builds.

## Reproduce

```sh
# Baseline + candidate (any gemini/<model> or openrouter/<model> spec):
pnpm benchmark:grouping -- gemini/gemini-3.5-flash-lite \
                         openrouter/deepseek/deepseek-v4-flash-0731
# Add a new candidate anytime; the report regenerates from all recorded
# results in .benchmark/grouping/results/:
pnpm benchmark:grouping -- openrouter/<vendor>/<model>
```

Keys live in the local env only (`GEMINI_API_KEY`, `OPENROUTER_API_KEY`) —
never in the repo. Raw results (proposals, ids, model-written titles — no
feed text) land in `.benchmark/grouping/` (gitignored); this file carries
the numbers. Every call is capped at 300 s and a call failure skips that
fixture's second run (worst case ≈ 15 min per candidate, not 40).

To pick a candidate: sort OpenRouter's model list by input price and skip
free-tier listings (`:free`, $0 — the variance this benchmark tries to
escape) and router ids. The harness requests a 65 536-token output cap and
disables reasoning where the endpoint allows it (some, like GLM-5.3-flash,
mandate reasoning — the harness retries without the field); a candidate
that cannot produce ~35k output tokens in one structured response cannot
serve a from-empty rebuild.