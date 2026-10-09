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
| GPT-6 Luna ($0.10/MTok in) | from-empty | 95.0% | 19 | 0 | 8/15 groups | 4 pairs | 66.4% | 141 s | $0.0110 | 2/2 |
| GPT-6 Luna | long-context | 100.0% | 0 | 0 | 3/15 groups | 10 pairs | 87.0% | 71 s | $0.0055 | 2/2 |
| GLM-5.3-flash ($0.15/MTok in; reasoning mandatory) | from-empty | — | — | — | — | — | — | timed out | — | 0/2 |
| GLM-5.3-flash | long-context | 92.3% | 11 | 0 | 3/15 groups | 15 pairs | — | 233 s | $0.0151 | 1/2 |

Observations from the recorded runs (variance is high — reruns matter):

- **GPT-6 Luna is the strongest candidate, and now fully measured** (2/2
  valid runs on both fixtures, after two harness fixes — see below). Its
  long-context record passes most of the rule: coverage 100%, 0 bad
  targets, dup-seeds 0, splits 3/15 (baseline's 2/15, within one),
  over-merge 10 pairs vs the baseline's 37, stability 87.0% (baseline
  58.0%). On from-empty it fails coverage (95.0% — 19 invented ids) and
  splits (8/15 vs the baseline's 3/15), but its over-merge count (4 pairs
  vs the baseline's 105) shows far fewer thematic mega-Stories, and it is
  more stable than the baseline (66.4% vs 45.2%). Latency is the other
  blocker: 141 s on from-empty and 71 s on long-context, both over
  production's 60 s grouping timeout.
  Two harness bugs had masked this picture: a naive first-{ … last-} JSON
  extraction returned `{}`-junk-prefixed responses unparseable (three
  "failures" were complete payloads — fixed with a balanced-object scan,
  `firstJsonObject`), and an earlier recording caught only 1/2 valid runs.
  `strict: true` (OpenAI structured outputs) did NOT prevent the model
  from giving up mid-task: on the 444-Article from-empty pass it once
  emitted visible in-stream reasoning prose — "300+; impossible token …
  no time" — followed by an empty proposal. That self-reported capacity
  limit is the strongest argument for chunking the large pass.
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

## Sanity sample: is the answer key straight? (2026-10-09)

30 pairs sampled from the recorded disagreements of the two models that
drive the decision (Flash-Lite baseline + GPT-6 Luna; 12 splits, 12
over-merges, 6 agreement controls; cross-model-deduped, blind — the
worksheet shows two headlines only), labeled by hand. Verdicts:
docs/research/grouping-labels.json (ids only; the gitignored sample lives
in `.benchmark/grouping/labels/`).

| model | bucket | snapshot claims | human agrees | n |
| --- | --- | --- | --- | --- |
| Flash-Lite | split | same | 100% | 6 |
| Flash-Lite | over-merge | different | 29% | 7 |
| Flash-Lite | control-different | different | 100% | 4 |
| GPT-6 Luna | split | same | 100% | 6 |
| GPT-6 Luna | over-merge | different | 0% | 5 |
| GPT-6 Luna | control-different | different | 100% | 2 |

Reading:

- **The key's same-claims are straight: every sampled split is a real
  error** (100% agreement, both models). The split metric needs no
  correction — Luna's 8/15 splits on from-empty are genuine, not
  answer-key noise.
- **The key's different-claims are crooked where candidates merged: the
  human sided with the model on most sampled over-merges** (Flash-Lite
  29%, Luna 0% key agreement). The snapshot under-merged the from-empty-
  era folders — lycée-mobilisation, Budget 2027 and phone-hygiene pairs
  the models correctly merged were held apart by the key. The over-merge
  metric therefore over-penalizes, and the candidate-vs-baseline gap on
  over-merging (4–10 pairs vs 105) shrinks once corrected — though the
  direction survives (a ~70–100% correction still leaves Flash-Lite
  worse).
- Caveats: small n (5–7 per model per bucket) and pairs sampled uniform
  over co-clustered pairs, so each model's biggest merged cluster
  dominates its sample; treat the rates as direction, not precision. A
  replacement decision that hinges on over-merge numbers needs a larger,
  per-fixture rebalanced sample.
- The "messy answer-key folder" worry from the #41 discussion was right,
  and now it is *typed*: the snapshot is over-split (under-merged), not
  over-merged — the key punishes correct consolidation, not correct
  splitting.

## Decision status

**Keep Flash-Lite + the scaffolding for now.** No candidate met the rule
(dup-seed rate 0, coverage 100%, split rate ≤ baseline, both fixtures, <
$0.50/build, two valid runs for stability). GPT-6 Luna is now fully
measured, and the sanity sample settles the answer-key question: the key
is straight on same-claims (splits are real errors — Luna's 8/15 from-empty
splits stand) and over-split on different-claims (most penalized
over-merges were correct merges the snapshot missed). The corrected
picture is *more* favorable to Luna than the raw table, not less — but the
hard blockers stay: from-empty coverage 95.0%, splits above the baseline,
and latency (141 s / 71 s) over the 60 s production grouping timeout.

Follow-ups, in order:

1. **Chunk the from-empty call** (~150-Article pages): Luna's own
   give-up prose ("300+ impossible") marks the single-pass capacity limit,
   and smaller passes would also help both the latency budget and the
   from-empty coverage/splits. Same lever serves production's 60 s
   timeout.
2. **Re-grade against a corrected key if a replacement ever hinges on
   over-merge numbers**: a larger, per-fixture-rebalanced sanity sample
   (the current one is 30 pairs, direction-only — see caveats above), then
   recompute the table with unjustified over-merges only.
3. Consider a **prompt-side output-compaction** (shorter keys, no
   titleUpdates) to halve the output tokens on large builds.

## Reproduce

```sh
# Baseline + candidate (any gemini/<model> or openrouter/<model> spec):
pnpm benchmark:grouping -- gemini/gemini-3.5-flash-lite \
                         openrouter/deepseek/deepseek-v4-flash-0731
# Add a new candidate anytime; the report regenerates from all recorded
# results in .benchmark/grouping/results/:
pnpm benchmark:grouping -- openrouter/<vendor>/<model>
# Sanity sample (issue #41, no model calls): 30 blind pairs from the
# recorded models' clashes with the snapshot key — the human labels
# verdicts in .benchmark/grouping/labels/, the grader prints agreement
# per bucket and writes the committed ids+verdicts labels file:
pnpm benchmark:grouping-sample && pnpm benchmark:grouping-grade
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