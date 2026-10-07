# Summaries model: Flash-Lite vs Flash

The Summaries model (issue #7, ADR-0006) runs one call per live Edition Story that
gained Articles — worst case ~200 calls/day on the ~500/day free tier, shared with
the Grouping model. Flash-Lite (`gemini-3.5-flash-lite`) is the default; this page
records the side-by-side against Flash (`gemini-3.5-flash`) that decides whether the
extra quality is worth the extra budget.

## Protocol

- **Corpus**: the top live Stories of one real day's collection (by Article count), same inputs for both models — previous Summaries (none on first run), new headlines and teasers, Outlet tags. Teasers never leave memory; results stay in `.benchmark/` (ADR-0003).
- **Run**: `GEMINI_API_KEY=… pnpm --filter @prisme/pipeline exec tsx src/benchmark/summaries-side-by-side.ts 5`
- **Read**: per Story, both models' Summaries (Gauche/Centre/Droite) and Differences; latency and call count per model.
- **Grading** (manual, like the Decision model benchmark): bullet accuracy against the headlines, French quality, Differences honesty (describes framing, never adjudicates; no invented contrasts on single-Leaning Stories), teaser paraphrasing (never copied).

## Result (2026-10-07)

- Corpus: the top 5 live Edition Stories of the day (78, 8, 7, 6 and 4 Articles; one single-Leaning Story included), full outputs in `.benchmark/summaries-side-by-side.md` (gitignored, ADR-0003).
- **Flash-Lite**: succeeded 5/5, ~2–7 s per call. Bullets accurate against the headlines, always reformulated (no teaser copying); Differences stayed descriptive — named Outlets only as evidence of framing (Le Figaro, L'Humanité, Europe 1, Le JDD) — and the single-Leaning Story's Differences said plainly there was nothing to compare.
- **Flash**: succeeded 2/5 (the other 3 hit free-tier 429s / 503 "high demand" even when run sequentially — Flash-Lite kept succeeding in the same window), and 3–6× slower when it did (30 s on the 8-Article Story vs 5 s). On its 2 successes the quality was marginally more fluent, with no factual gain over Flash-Lite.
- **Decision**: keep Flash-Lite — same usable quality, a fraction of the latency, and it holds up under the free tier where Flash gets rate-limited. Re-run this protocol if Differences quality regresses on real days.
