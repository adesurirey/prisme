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
  rebuild). At the current archive size (5 283 Articles at the 2026-10-25
  edition) this fixture has outgrown the single-call output cap — see the
  deadlock-baseline section below.
- **long-context** — 218 live Stories (every snapshot Story holding no
  fresh Article) + the 142-Article fresh batch (Articles under an hour old
  at builtAt): the steady-state shape the issue warns about. The Stories
  holding the fresh batch drop out of the prompt, so the batch's original
  Stories are the pseudo-ground-truth for splits, and the remaining live
  Stories are what a proposed seed must not duplicate.
- **deadlock** (issue #149) — the 2026-10-24 grouping deadlock reconstructed
  from the archive at a pinned historical build; see the dedicated section
  below.

Headlines and titles only — ADR-0003 forbids teasers on disk. Since #154
(2026-10-25) the production grouping input is headline-only too: fixture
and production inputs are the same shape by construction.

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

## Chunked Luna (2026-10-09): the give-up mode is gone

Spec `openrouter/openai/gpt-6-luna:chunked150` — the fresh batch answered
in 150-Article pages (one call per page against the same live Stories,
proposals merged, page keys namespaced, a page that fails or gives up
fails the whole call). This is the lever Luna's own give-up prose called
for. Full record, 2/2 valid runs on both fixtures:

| Fixture | Coverage | Bad targets | Dup-seeds | Splits | Over-merged | Stability | Latency | Cost/run |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| from-empty | 99.8% | 1 | 0 | 6/15 | 4–15 | 51.1% | 143–165 s | $0.012 |
| long-context | 99.3% | 1 | 0 | 4/15 | 4 | 87.2% | 92–102 s | $0.009 |

Against the single-call record (95.0% coverage, 8/15 splits, one
give-up per recording) this fixes the big pass: **no give-ups, no
truncated JSON, and coverage misses shrink from 21 Articles to one per
fixture**. What chunking cannot fix: splits (6/15 vs the baseline's 3/15
— validated as real errors by the sanity sample) and latency (pages run
sequentially here; parallel pages would put the wall time near a single
page's ~50–60 s, but that is a production architecture change). The
corrected-key reading still favors it on over-merging: most penalized
over-merges were correct merges the snapshot key missed.

Still short of the rule: coverage misses by one Article per fixture,
split rate above baseline on both fixtures, latency over the 60 s
production timeout. Decision unchanged.

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

## Replay after ADR-0018 (fixture of 2026-10-14T19:01:24.669Z)

The ADR-0018 prompt (member headlines in the story lines, the sub-fact
birth rule) replayed against the same model on a refreshed fixture.
Baseline = the pre-ADR-0018 prompt, re-run from the ADR commit in a
worktree; each row is best of 2 valid runs, two runs per fixture.

| Prompt | Fixture | Coverage | Dup-seeds | Splits | Over-merged | Stability | Latency (run 1/2) | In-tokens (run 1) | Cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pre-ADR-0018 | from-empty (723 fresh) | 540/723 (74.7%) | 0 | 0/5 | 0 | 67.2% | 47 s / 30 s | 33 692 | $0 |
| ADR-0018 | from-empty (723 fresh) | 554/723 (76.6%) | 0 | 1/5 | 0 | 55.6% | 63 s / 49 s | 33 853 | $0 |
| pre-ADR-0018 | long-context (16 fresh, 61 live) | 10/16 (62.5%) | 0 | 1/5 | 0 | 85.7% | 2 s / 2 s | 3 382 | $0 |
| ADR-0018 | long-context (16 fresh, 61 live) | 11/16 (68.8%) | 0 | 2/5 | 0 | 100.0% | 2 s / 2 s | 9 012 | $0 |

Reading, per ADR-0018's validation plan:

- **Coverage up** on both fixtures (74.7 → 76.6 %, 62.5 → 68.8 %) — the
  birth rule pairs twins into Stories instead of dropping proposed
  singletons. Dup-seeds and over-merged stay at 0. No collapse.
- **The over-merged −25 % criterion is vacuous here** (baseline 0 on both
  fixtures): this fixture's pseudo-ground-truth *is* the old grouping —
  it cannot measure the sub-fact improvement, only catch degradations.
- **The splits metric counts the intended behavior as a failure.** The
  candidate's counted splits are the ADR-0018 signature working: the
  Aubagne penal-follow-up Article (« Que risque le collégien… ») stays
  unassigned instead of merging into the True-Crime-Community cluster
  (the birth rule: alone → re-presents next build), and the Sevran
  shooting pair (two snapshot Stories for one event) resolves differently.
  The « splits ≤ 1.5× baseline » cap is therefore reinterpreted as a
  regression guard only for runs *reproducing* the old behavior — on this
  fixture, rising splits with coverage up and dup-seeds 0 is the fix,
  not a drift.
- **Stability is the honest caveat**: from-empty run-to-run agreement
  fell (67.2 → 55.6 %) — the birth rule discretizes cluster decisions
  (twins paired or not) and the free tier is noisy at this scale (one
  baseline run covered only 300/723). Long-context stability rose
  (85.7 → 100 %). The replay guards against collapse; it cannot prove
  the improvement — the verdict comes from the next real day (ADR-0018's
  observation gate at J+1).

## Deadlock fixture and baseline (issue #149)

The 2026-10-24 grouping deadlock (spec #147): all day the live magnet Story
(the tribunal ruling on the Paris march route, born 2026-10-22) pulled the
new march Articles, the Membership check refused each merge, and the
Articles stayed Unassigned — re-presented to an unchanged prompt, hour
after hour, until the magnet's Ingestion window closed at 00:53 and the
march Story finally birthed at 01:01 with 61 Articles. The prompt-feedback
ticket (#150) must be graded against that day, so the day became a
fixture:

- **Pin** — `2026-10-24T23:01:20.223Z`, the last hourly build of the day
  (edition commit `6a460674`).
- **Live Stories** — every archive Story that existed at the pin
  (`createdAt ≤ pin`) with members cut at the pin (`publishedAt ≤ pin`) and
  its Ingestion window open there (ADR-0027): 31 Stories, the magnet among
  them with all 41 of its members — the full field the model saw, in the
  production order (newest member first). Accepted approximations: story
  titles are the archive's final ones, members that joined after the pin
  are included when their `publishedAt` precedes it (three Articles, that
  day), and a Story later merged away is absent — none of which touches
  the magnet–march pair.
- **Fresh Articles** — the march Story's Articles inside the pin's 24 h
  collection window: the day's 69 march Articles, exactly the ones that
  sat Unassigned through every build. The rest of the day's 300+
  Unassigned pool left no archive trace and is not reconstructible.
- **Ground truth** — each fresh Article → the march Story it eventually
  founded.

Baseline (2026-10-25, `gemini/gemini-3.5-flash-lite`, the production model,
two runs per fixture; from-empty skipped — at 5 283 Articles it has
outgrown the single-call output cap, so this round ran
`--only long-context,deadlock`):

| fixture | fresh | live | coverage | → magnet | born | dup-seeds | splits | over-merged | stability | latency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| long-context | 11 | 466 | 90.9% | — | — | 0 | 0/3 groups | 0 | 100.0% | 3.4 s |
| deadlock | 69 | 31 | 98.6% | 0 | 65 (1 cluster) | 0 | 1/1 groups | 0 | 91.1% | 7.0 s |

**The finding: the reconstructed state does not reproduce the loop — the
current prompt already births.** Both runs propose one new Story claiming
65 and 64 of the 69 march Articles (run 2 sends a single Article to the
magnet, run 1 none), scattering 2–4 to other on-topic live Stories (the
Conseil d'État and Gilets-jaunes mobilizations) and leaving one
unassigned. The production loop was emergent from the full-day state,
which the archive cannot reconstruct:

- the real fresh pool held 300+ mixed Articles — the march Articles
  interleaved with everything else the day collected. A clean block of 69
  same-event Articles makes the twins rule (ADR-0018) trivially
  applicable; diluted among 300+, the model matched by topic proximity to
  the magnet instead.
- production prompts carry teasers (in memory only); benchmark fixtures
  never do (ADR-0003). The march Articles' teasers often recapped the
  route/tribunal context — exactly the evidence that pulls a same-fact
  judgment toward the magnet.

Consequence for #150's validation gate: « the deadlock fixture must birth
the march Story » is already true of the baseline, so the criterion
degrades to a regression guard — the landed variant must keep the birth
(and not worsen the scatter), while the standard fixtures carry the
no-regression rule (split rate, dup-seeds, coverage). The deadlock's
real-world fix rests on the refusal cache (#148, landed) plus the prompt
feedback graded on the standard fixtures. The fixture keeps its value:
the magnet-vs-birth behavior and the scatter are now pinned under
measurement, and the recorded baseline is the « before » any variant must
not regress against.

## Grouping input drops teasers (issue #154, 2026-10-25)

The fresh-Article half of the production grouping prompt loses the
teaser — headline + Section only (`GroupingInputArticle`). Membership
(ADR-0018), the birth-guard (ADR-0030) and Topic resolution (ADR-0024)
keep their inputs. What this buys, honestly ranked:

1. **Parity by construction** — production and benchmark grouping
   inputs are byte-identical; the teaser gap that made the 2026-10-24
   deadlock unreproducible closes, and the next real grouping failure
   becomes reproducible as a fixture. This is the ticket's primary
   justification.
2. **Cost** — the grouping call was the only place teaser tokens were
   measurable; expect a large input-token drop per build.
3. **Deadlock pull (unproven)** — the march teasers' route/tribunal
   recap plausibly pulled same-fact judgments toward the magnet, but
   the benchmark cannot A/B teasers (its fixtures never had them; the
   #149 baseline already *is* the headline-only behavior). Observation
   of the next heavy news day in CI is the only test.

**Regression gate for the paid run** (fixed before running, per the
#149 baseline — breach → revert, no debate; as everywhere in this doc,
per-fixture figures are the **best of two runs** — that selection rule
is part of each threshold, so « the deadlock fixture keeps the birth »
means the best-of-2 record births, while a run-level magnet flood is
the bimodality under measurement, not a breach):

- deadlock fixture keeps the birth (its role as regression guard);
- per fixture, coverage ≥ baseline − 1 pt (deadlock: 98.6 %,
  long-context: 90.9 %);
- dup-seed rate and split rate ≤ baseline + 1 pt absolute (both 0 at
  baseline).

**Observation gate** — the next busy day's CI logs: Unassigned counts,
magnet-Story warnings, and refusals-per-build against the pre-ship week
(the direct measure of the named risk: less evidence per Article could
raise wrong-merge proposals → more Membership refusals; the #148 cache
absorbs the cost, the rate is what tells us).

**Gate run** (2026-10-25, `gemini/gemini-3.5-flash-lite`, two runs per
fixture, from-empty skipped as outgrown): **pass — no threshold
breached.** Deadlock keeps the birth (best of 2: born 68, 0 → magnet,
1 cluster), coverage 98.6 % (= baseline) and 100 % (long-context, its
fresh pool drifted to 4 Articles — it is rebuilt at run time, unlike
the pinned deadlock fixture), dup-seeds 0, splits at baseline. Recorded
honestly: the second deadlock run flooded the magnet (62/69 assigned to
it, 0 born) — the run-to-run bimodality the fixture exists to measure,
now visible on headline-only input too. It halves the best-of-2
stability (83.7 % vs baseline 91.1 %, ungated) and is exactly what the
observation gate watches for in production.

## Reproduce

```sh
# Baseline + candidate (any gemini/<model> or openrouter/<model> spec):
pnpm benchmark:grouping -- gemini/gemini-3.5-flash-lite \
                         openrouter/deepseek/deepseek-v4-flash-0731
# Add a new candidate anytime; the report regenerates from all recorded
# results in .benchmark/grouping/results/:
pnpm benchmark:grouping -- openrouter/<vendor>/<model>
# Restrict a paid run to part of the fixture set (e.g. when from-empty's
# current size cannot complete under the output cap):
pnpm benchmark:grouping -- gemini/gemini-3.5-flash-lite --only long-context,deadlock
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