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

## Result (pending — filled from the keyed run in the PR)

Not yet run: the side-by-side needs `GEMINI_API_KEY`, which build environments hold as a secret. The PR for issue #7 must include the run (script above) and this section filled before merge.

- Corpus: _n live Stories, date_
- **Flash-Lite**: _accuracy, Differences honesty, latency_
- **Flash**: _same, and request cost_
- **Decision**: _keep Flash-Lite or switch, and why_
