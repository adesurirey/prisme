# Stories ingest until silence, and Editions are rolling windows

Supersedes the fixed window and the sharp-exit Edition rule of ADR-0026
(whose founding-instant derivation, instant arithmetic and strict
no-pre-founding bound remain in force); amends ADR-0022 (Edition windows,
growth-gated Summaries budget), ADR-0015 (birth minimum gains the Outlet
dimension), ADR-0009 (the ranking key is counted inside the window) and
ADR-0003 (the teaser cache). Decided 2026-10-21.

ADR-0026 capped a Story at 24 hours from its founding to keep the
pre-0017 mega-Story from returning. The cap now costs more than it
protects. A saga covered for three days becomes one big Story plus one or
two next-day fragments with near-duplicate titles and understated
Coverage — the reader who returns six months later finds the event
scattered, and every fragment was preventable: the Grouping model, after
its prompt iterations, holds the same-fact line reliably (the splits are
verified; the trial's own mega-Story guardrail — > 40 Articles or > 15
Outlets — is already void: 21 of the 339 files in the 2026-10-13→10-21
archive exceed it, the largest at 441 Articles across 26 Outlets, all
under the 24h cap). Meanwhile the product wants the opposite of the cap:
one place per event, whole. Replaying the archive hourly confirms the
shape of the change: with day-fragments merged through the production
Topic links, Story lifetimes run median 17 h, p90 30 h, max 103 h — most
Stories still die in a day; only chained sagas run long.

## Decision

### The Ingestion window — silence closes a Story

`[founding, max(founding + 24h, newest + 12h)]`, in instant arithmetic.
The founding instant is ADR-0026's (earliest `publishedAt` among members,
derived on demand, never stored) and the strict lower bound stays: no
Article precedes the founding. The 24h term keeps ADR-0026's guarantee —
every Story at least one full day, evening Stories their overnight cycle.
The 12h term extends the Story while coverage continues: each new Article
buys 12 more hours, so a Story closes 12 hours after its newest Article
once that is later than founding + 24h. A silence longer than the
extension closes the Story, permanently (ADR-0005); later coverage of the
same event births its Episode (ADR-0018) and threads its Topic
(ADR-0024). A pure 12h-from-newest rule was measured and rejected: it
would freeze 252 of the 339 existing Stories *earlier* than ADR-0026
does — a Story quiet for half a day would lose up to 12 h of window, so
fragments would multiply, not shrink. The hybrid is never shorter (0 of
339) and longer for 87. The 24h collection window (what the feeds bring
each build) is unchanged; the ingestion rule and the collection window
decouple from here on.

### Editions are rolling windows

The Edition stops being « the Stories whose window is open » and becomes
a windowed view over all Stories: **everything with at least one Article
published inside the window — frozen Stories included**, so a Story that
just closed keeps sinking until its Articles age out instead of
vanishing at a clock edge. Ranked by ADR-0009's Coverage **counted
inside the window** — distinct Outlets with at least one Article
published in the window, Opinion pieces included (ADR-0011) — tie-broken
by the newest Article in the window, then creation time, then id,
deterministic across builds. Two prerendered editions:

- **« Aujourd'hui » (the home, `/`)** — the last 24 hours, **uncapped**
  (ADR-0022). Rolling, not calendar-day: at 07:00 the overnight
  international coverage is still on la Une; nothing thins out at
  midnight.
- **« 7 jours » (`/7-jours/`)** — the last 7 days, same rule, floored to
  Stories covered by **≥ 10 Outlets** in the window (~34 % of the 29
  configured; measured: a 7-day window holds 205–296 Stories, ~50 pass
  the floor). No hard count cap — the floor adapts to the week; it is
  the « significant at the scale of a week » cut. No per-reader
  « Nouveau » / « En hausse » badges on this page: those are daily-visit
  semantics.

A 30-day edition is deliberately deferred until the 7-day one is read.
A Story leaves la Une by decay — no Outlet reporting it inside the
window — never by a clock, and never again as a fragment of itself.

### Birth needs two Outlets

Amends ADR-0015: a Story is born only from **at least two Articles from
at least two distinct Outlets** (an Opinion piece counts toward the
birth, ADR-0011). Measured: 2 of the 339 current Stories are
single-Outlet — a near no-op tightening, not a behavior shift. The
Grouping model never sees Outlet ids (ADR-0003 prompt), so the rule is
enforced at the drop pass like the two-Article minimum: a proposed Story
whose members are all one Outlet is dropped, its Articles stay
Unassigned and retry each build until a second Outlet covers the event
or the 24h collection window expires. The founding instant is the
earliest Article of the member set — the scoop anchors the window even
if the second Outlet lands ten hours later.

### AI passes see whole Stories, gated by growth

Two hard rules on the model-input side, both learned the hard way
(ADR-0006's sum-1..3 lineage; the 2026-10 windowed-pass attempts):

1. **Summaries and Differences always re-synthesize from the whole
   Article set** — never a delta, never a window. A windowed pass
   summarizes the Story's last day, not the Story.
2. **Retitles always see the whole headline set.** Same principle: the
   title names the event, not its latest development.

The pressure this creates on multi-day Stories (the worst measured
merged thread: 692 Articles, 27 Outlets over 4 days — ~62 k chars of
headlines in one pass) is bounded by *when* passes fire, not what they
see: a Story re-enters the Summaries budget (unchanged: top-20 of the
24h Edition, ADR-0022) and the Title pass's updates list only when it
**grew ≥ 25 % since its last pass** — births always pass. Measured over
218 hourly builds: −22 % of Summary calls (1 567 → 1 220, median 7 → 5
per build), and the pathological case — a 100-Article Story
re-summarized for +1 Article — disappears. Staleness of at most 25 % of
a Story's Articles is the accepted cost; each pass keeps its own
watermark counter (`summarizedArticleCount`; retitles gain their own).

### The teaser cache

Amends ADR-0003. Whole-Story passes on a multi-day Story would read its
day-1 Articles headline-only: teasers are in-memory only, feeds rotate
in hours, and ADR-0003 itself conceded the teasers are gone for any
later pass. The collector now **accumulates every teaser it ever sees**
into a gitignored cache (`.cache/teasers.json`, ~5 MB/month); the
Summaries pass reads aged teasers from it; CI round-trips it through
`actions/cache`, private to the repo's Actions. Nothing Outlet-written
enters the public git repo or any page — ADR-0003's line moves from
« never stored anywhere » to « never published ». The cache starts empty
at deploy (nothing retroactive exists to recover) and also fixes the
same-day rotation loss and the per-Leaning fairness skew of
fast-churning feeds. Eviction degrades to headline-only input — never
corrupts.

### Rollout: live, no wipe

No schema change — windows are derived on demand — so the change ships
on the live pipeline, like ADR-0026's trial. One transitional effect,
decided rather than accidental: liveness has no stored state, so at
deploy every Story frozen under ADR-0026 whose newest Article is < 12 h
old reopens once and absorbs the current coverage — exactly the
fragments being fixed; self-limiting to ~12 h. Old fragment files stay
permanent (ADR-0005) and age out of the 7-day window within a week.

## Watch protocol (7 days)

1. **Fragment rate** — Stories born that continue a < 7-day-old Story
   (episode proposals per day, free via `pnpm backtest:episodes`;
   baseline ≈ 6/day: 53 Topic inheritances over 9 days). If it does not
   drop measurably, the premise — the model is ready — was wrong.
2. **Grouping prompt size and live pool** (deploy baseline: pool median
   35, p90 55; stories-block ~15 k chars — the hybrid does not grow
   either; merging fragments removes pool members).
3. **Title-pass payload chars** per build.
4. **Summary calls per build and worst staleness.**
5. **Story lifetime distribution** (upper-bound baseline: median 17 h,
   p90 30 h, max 103 h).
6. **« 7 jours » size** at the ≥ 10 floor (~50 expected).

## Considered Options

- **Pure rolling 12h-from-newest**: measured to freeze 252/339 Stories
  earlier than today — more fragments, not fewer. The hybrid keeps the
  floor.
- **Calendar-day (midnight-to-midnight) editions**: thin morning edition
  that drops overnight international coverage at 00:00; rolling windows
  match rolling Stories.
- **Windowed or delta AI passes**: tried, reverted — a window summarizes
  the Story's last day; the whole point is the whole Story. Bounded
  *frequency* instead (the 25 % gate).
- **Storing teasers in `data/`**: the repo is public and Outlets opt out
  of TDM (ADR-0003's reason); the gitignored private cache keeps the
  line.
- **Wipe-and-rebuild**: no corruption argument exists — windows are
  derived, the Edition rebuilds each run, fragments age out of the
  windows within a week — and the week's archive is worth keeping. Live
  rollout.
- **Un-freezing Stories when Membership confirms a later match**: kills
  fragments entirely but reintroduces the unbounded mega-Story with no
  silence rule at all; ADR-0005 permanence stays.
- **A hard count cap on « 7 jours »**: a floor (≥ 10 Outlets) adapts to
  the week's weight; a cap is a number pulled from nowhere.

## Consequences

- **Episodes and Topics become rarer but stay load-bearing**: they are
  the mechanism for silences longer than 12 h — weekends, slow sagas.
  The sparse phase of a saga is still several Stories threaded by
  Topics; no UI reads Topics yet (ADR-0024 unchanged).
- **Mega-Stories are the feature, not the failure**: one place per
  event, whole — « come back six months later ». The > 40 / > 15
  guardrail of ADR-0026's trial is retired (it was already void). The
  Story page collapses to one Article per Outlet (~29 rows), so it
  reads the same at 40 or 700 Articles.
- **The Grouping model's pressure does not grow**: its prompt is bounded
  per Story (title + 3 latest headlines) and the live pool shrinks
  (median 35 → 24–36 across merge bounds) as fragments merge into their
  parents; Membership checks grow ~30–50 % (~+6/build), feed-driven
  Article volume unchanged.
- `LIVE_WINDOW_MS` splits: collection (24 h) and ingestion (the silence
  rule) are two named constants now — the « one product decision, one
  constant » note of ADR-0026's era is gone.
- **Frozen Stories keep their last-written Summaries while visible in a
  window** (ADR-0005/0006: never edited after freeze); a Story outside
  the Summaries budget or below the growth gate keeps its existing
  Summary as-is.
- The GLOSSARY's Edition, Ingestion window, Live Story, Frozen Story,
  Summaries budget and Unassigned Article entries are updated by this
  ADR.
- Amended by ADR-0029: the Editions are three windows — « En direct »
  (the last 12 h by founding instant, ranked latest-first, widened
  from 8 h by ADR-0035) joins
  « Aujourd'hui » and « 7 jours », and the growth gate above moves to
  the domain package, shared with the web's « En hausse » badge.
- Amended by ADR-0033: the Ingestion window also closes at a ceiling —
  `min(max(founding + 24h, newest + 12h), founding + 72h)` — so a
  continuously covered event cannot hold its Story open past three days;
  the silence rule above stays in force for the common case.
- Amended by ADR-0036/0037: the Editions are « En direct », « Le fil »
  and « Aujourd'hui » — the week window and its 10-Outlet floor are
  gone (ADR-0037); the rolling windows and the decay rule above stand.
