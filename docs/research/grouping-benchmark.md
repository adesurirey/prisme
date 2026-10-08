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

| Model | Fixture | Coverage | Bad targets | Dup-seeds | Splits | Over-merged | Stability | Latency | Cost/run |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Flash-Lite (baseline, free tier) | from-empty | 98.0% | 9 | 0 | 3/15 groups | 105 pairs | 45.2% | 53 s | $0 |
| Flash-Lite (baseline, free tier) | long-context | 92.3% | 11 | 0 | 2/15 groups | 37 pairs | 58.0% | 15 s | $0 |
| DeepSeek V4 Flash 0731 ($0.006/MTok in — cheapest paid on OpenRouter) | from-empty | 43.7% | 250 | 0 | 3/15 groups | 140 pairs | 64.1% | 365 s | $0.0089 |
| DeepSeek V4 Flash 0731 | long-context | 94.4% | 8 | 0 | 1/15 groups | 7 pairs | 71.4% | 121 s | $0.0027 |

Observations from the recorded runs (variance is high for both — reruns
matter):

- **Neither model is clean.** Flash-Lite's free tier returned an *empty*
  proposal under load (503s on one recording attempt, one zero-assignment
  response in an earlier run) and invents Story ids or drops assignments on
  a third of runs. DeepSeek's cheapest snapshot assigned up to 250/444
  from-empty Articles to ids it never declared (one id swallowed 79
  Articles) and times out past 10 minutes on from-empty under load.
- **Dup-seeds: 0 for both** on the long-context fixture — neither proposes
  a Story duplicating a live one. The seed guard's cross-build job is not
  exercised by these runs.
- **Splits:** DeepSeek splits slightly less on long-context (1/15 vs 2/15),
  at the price of worse field discipline. On from-empty they tie (3/15).
- **Cost is not the constraint**, as the issue predicted: even the slow,
  expensive-output DeepSeek run is ~$0.009/build, against the < $0.50/build
  rule. Latency (6 minutes for one from-empty call) and field discipline
  are what disqualify it.

## Decision status

**Keep Flash-Lite + the scaffolding for now.** No candidate met the rule
(dup-seed rate 0, coverage 100%, split rate ≤ baseline, both fixtures, <
$0.50/build): the cheapest OpenRouter model trades coverage and id
discipline for a lower split rate, and the baseline itself shows the
free-tier variance the scaffolding exists to absorb. Re-run when a new
candidate appears; the comparison table regenerates from the recorded
results.

Remaining for a replacement decision: the ~30 hand-labeled pairs
(`decision-model-benchmark`-style sanity check of the pseudo-ground-truth)
is not done yet — the metrics above are pseudo-ground-truth only.

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
the numbers.

To pick a candidate: sort OpenRouter's model list by input price and skip
free-tier listings (`:free`, $0 — the variance this benchmark tries to
escape) and router ids. The harness disables reasoning and requests a
65 536-token output cap; a candidate that cannot produce ~35k output tokens
in one structured response cannot serve a from-empty rebuild.