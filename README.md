# Prisme

Prisme shows each day’s front-page news from the major French outlets, and how
each political leaning covers it — same story, every leaning, side by side.

## How it works

Every build (once an hour, all 24 hours, triggered by an external cron-job.org
job that calls the workflow's `workflow_dispatch` API — GitHub's own scheduler
dropped most hourly slots) runs the pipeline,
then commits the result to `data/` — the git repo is the database, and CI publishes it as a
static site. Purple-stroked nodes run a language model; dashed nodes are stores
on disk — only what changed is written or re-read.

```mermaid
flowchart LR
    classDef store stroke-dasharray:4;
    classDef model stroke:#8250df,stroke-width:2;
    A[Collect<br>every Outlet’s RSS feed] --> B[Classify<br>Decision model — Kind + Section]:::model
    B --> C[Group<br>Grouping model — new Articles into Stories]:::model
    C --> T2[Topic<br>Membership — threads Episodes into sujets:<br>same-subject checks, label + slug]:::model
    T2 --> T[Title<br>Title pass — every Story title anchored on<br>a Jev-confirmed thread]:::model
    T --> D[Rank<br>front pages, Coverage, recency → Edition]
    D --> E[Summarize<br>Flash-Lite — Summaries + Differences]:::model
    E --> F[(Write<br>edition.json + topics.json + story files)]:::store
    F --> G[Publish<br>Astro prerender]
    B -. new ids only .-> H[(Classification cache)]:::store
    C -. changed Story files .-> I[(Story files)]:::store
    I -. episode matching .-> T2
    I --> D
```

Five cheap model steps run the show, three pinned models; each pinned for
traceability.

| Step | Model | Provider |
| --- | --- | --- |
| Classify (Kind + Section), Membership and Topic checks | Jev (`typesafe/jev-1.13`) | OpenRouter — chosen by a hand-labeled benchmark |
| Group (Stories from new Articles; never titles) | Flash-Lite (`gemini-3.5-flash-lite`) | Gemini free tier |
| Topic (Sujets: same-subject checks, labels, slugs — `data/topics.json`) | Jev (`typesafe/jev-1.13`) | OpenRouter — one check per birth that matches an episode |
| Title (every Story title, at birth and on retitle) | Flash-Lite (`gemini-3.5-flash-lite`) | Gemini free tier |
| Summarize (Summaries + Differences) | Flash-Lite (`gemini-3.5-flash-lite`) | Gemini free tier |

Leanings are set by hand, one per Outlet, backed by sources — never classified
by a model.

## Fixing a bad split: merging two Stories by hand

The Grouping model sometimes splits what a human judges should be one Story —
two pages about the same development, each holding a handful of Articles.
`pnpm merge-stories` merges them by hand:

```sh
pnpm merge-stories <base-slug> <absorbed-slug>            # review, then confirm
pnpm merge-stories <base-slug> <absorbed-slug> --dry-run  # print the plan only
```

The slugs are the story pages' own (`/<day>/<slug>/`). The **base** (first
argument) survives whole — its URL, title, Summaries and Topic stay — and the
**absorbed** story (second) gives it its Articles and disappears. The next
hourly build re-summarizes the merged set from scratch, so the bullet points
take the incoming Articles into account.

Guard rails: the command prints its plan and asks for confirmation before
writing, and never commits — it prints the git command to review and paste.
Two merges are refused without `--force`: across story days, and into a frozen
Story (whose Summaries the pipeline never rewrites). A Story that once ranked
into the Edition keeps its published URL alive after the merge: a redirect
entry lands in `data/redirects.json`, and the site serves the old path as a
0-second meta-refresh redirect to the surviving page (Astro's built-in
redirects — honored by the dev server and emitted as stub pages by the
build).

## Benchmarking the Decision model (Kind + Section)

Same pattern as the grouping benchmark (issue #4): hand labels check the
models, `docs/research/decision-model-benchmark.md` carries the graded
results and the winner rule (not_news precision first — never wrongly
drop a real Article — then kind accuracy, then section accuracy).

1. **Sample** — `pnpm benchmark:export` fetches every Outlet's feeds and
   samples ~110 real headline+teaser pairs (seed 4; 70 general, 40
   “suspects” oversampled by a rare-kind heuristic — horoscopes, live
   blogs, tribunes…). Writes the gitignored `.benchmark/samples.json`
   (grader input) and `.benchmark/worksheet.md` (what you read), plus the
   committed `docs/research/decision-model-labels.json` — ids and URLs
   only, teaser text never enters git (ADR-0003).
2. **Label** — fill `kind` and `section` for every item in
   `decision-model-labels.json` (kinds: news, opinion, live, not_news).
3. **Grade** — `pnpm benchmark:grade` replays every configured model over
   the labeled sample and rewrites
   `docs/research/decision-model-benchmark.md`. Keys from `.env`:
   `OPENROUTER_API_KEY` (OpenRouter models), `JEV_API_KEY` (Jev direct),
   `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (Clef-flash) — a
   missing key just skips that model. Needs network (samples are taken
   from live feeds; grade replays the gitignored teaser text).

## Benchmarking a new Grouping model

The pinned Grouping model can be challenged anytime — issue #41 settled the
method, `docs/research/grouping-benchmark.md` carries the full methodology,
recorded results and the decision rule. The short recipe:

1. **Pick a candidate** on OpenRouter: paid (skip `:free` listings and $0
   prices — free-tier variance is what this escapes), structured outputs,
   1M context. Sort by input price.
2. **Run it from a checkout whose `data/` matches the recorded edition**
   (every results file carries its `fixtureBuiltAt` — the fixtures rebuild
   from `data/`, so new pipeline runs move the reference; re-run the
   baseline alongside when the edition moved):

   ```sh
   pnpm benchmark:grouping -- gemini/gemini-3.5-flash-lite \
                            openrouter/<vendor>/<model>
   # large-batch give-ups? try the chunked variant:
   pnpm benchmark:grouping -- openrouter/<vendor>/<model>:chunked150
   ```

3. **Read** `.benchmark/grouping/report.md` — it aggregates every recorded
   results file, so reruns extend the comparison.
4. **Apply the decision rule**: dup-seeds 0, coverage 100%, split rate ≤
   baseline on both fixtures, < $0.50/build, two valid runs for stability.

Keys come from the local `.env` (`GEMINI_API_KEY`, `OPENROUTER_API_KEY`) —
never the repo. Results land in gitignored `.benchmark/grouping/`; a
candidate that cannot answer one build call in 5 minutes is disqualified
by that fact (production aborts grouping at 60 s).
