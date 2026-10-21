# Stories ingest for 24 hours from their founding Article

> **Partially superseded by ADR-0027** (2026-10-21): the fixed 24h window
> below is gone — a Story ingests until silence, `max(founding + 24h,
> newest + 12h)` — and the Edition's sharp exit is gone with it: Editions
> are rolling windows ranked by Coverage counted inside the window. The
> founding-instant derivation, the instant arithmetic and the strict
> no-pre-founding bound remain in force.

Supersedes the appartenance rule and the 06:00 Ingestion window of
ADR-0017 (whose Story day, URLs, archive pages and backfill deletion —
as reshaped by ADR-0022 — remain in force). Decided 2026-10-19.

A Story founded in the French evening dies within hours. Its Ingestion
window is supposed to stay open until 06:00 Europe/Paris the day after its
Story day (ADR-0017), but the belonging rule only ever admits Articles of
the Story's own Publication day — so the window is nearly dead code for
ingestion: a Story founded at 23:00 has ~1 hour of real ingestion, and
every Article about the same event published after midnight is rejected.
That is exactly when international news develops — the USA and other far
time zones publish their main cycle during the French night. A US decision
announced in the French evening produces follow-up coverage overnight Paris
time, which cannot join the evening Story. The archive shows the failure
twice on 2026-10-18: « Donald Trump accuse Volodymyr Zelensky… » and
« Donald Trump apporte son soutien à Benjamin Netanyahou… », both founded
~22:00 and frozen at 06:00 — each leaving the Edition after a few hours,
each spawning a next-day duplicate fragment of the same event, each
understating the event's Coverage by splitting it across fragments.

## Decision

A Story ingests for **24 hours from its founding Article**, instead of
belonging to one Publication day with a 06:00 grace window.

- The **founding instant** of a Story is the earliest `publishedAt` among
  its Articles, derived on demand — never stored. Under strict membership
  it always equals the founding (seed) Article's publication instant and is
  stable for the Story's life.
- The **Ingestion window** is `[founding, founding + 24h]`, computed as
  instant arithmetic. ADR-0017's wall-clock construction (Story day + 06:00
  Europe/Paris, DST offset probing) is deleted; no civil-date logic remains
  in the window rule, so DST transitions cannot mis-time it.
- The **belonging rule**: an Article joins a Story if and only if its
  `publishedAt` falls inside that window — `founding ≤ publishedAt ≤
  founding + 24h`, strictly, with no pre-founding Articles. An Article
  published before a candidate Story's founding is rejected at assignment
  time and stays Unassigned (re-presented next build); it is never stored
  into the Story it matched. Accepted consequence: ADR-0017's motivating
  example (an Article published 23h50, collected after midnight) no longer
  finds a Story founded at 23h55; the Article orphans and is lost if no
  window ever admits it — rare and cheap, revisited if the trial shows
  real loss.
- The **Edition** shows exactly the window-open Stories, ranked by the
  unchanged ADR-0009 key, with a sharp exit at the window close: a Story
  can never sit on la Une beyond 24 hours of age. The defensive future-day
  guard is retained. The GLOSSARY's Live Story entry now states the window
  rule directly — a window-open Story's Articles are all less than 24
  hours old by construction, so the old formulation (an Article less than
  24 hours old, within the Ingestion window) stays true.
- The **Grouping model** sees only window-open Stories (the pool moves
  from day-based to window-based); the seed-guard candidate filter, the
  key-member filter at claim time and the post-assignment rejection check
  all move from Story-day equality to window containment.
- **Story day** is unchanged — the Europe/Paris Publication day of the
  founding Article, fixed at creation. URLs, archive pages, the Episode
  age window and Topic resolution keep their day-based arithmetic.
- **Episodes and Topics**: no mechanism change. A Story whose window
  closed births an Episode for later coverage, as today; with the longer
  window, fewer spurious Episodes are born for overnight continuations.
- **Data**: no schema change, no migration, no wipe, no compatibility
  branch. Existing Story files stay valid; their windows are computed by
  the same uniform rule from their earliest member, which self-corrects as
  in-flight Stories freeze within a day. Summaries budget, Membership
  gate, Decision model, Title pass, front-page history and edition history
  are untouched.

French Stories keep behaving sensibly (a mid-morning Story absorbs its
day's coverage and next-morning follow-ups within the window);
evening-founded international Stories gain the overnight cycle they
currently lose; no Story ever grows into a rolling, topic-like mega-Story
because the window is bounded from birth.

## Trial protocol

The change rolls out on the live pipeline — no wipe, no replay stage — and
is observed for 2–3 days of real editions against four agreed checks:

1. **Episode fragmentation** of international sagas: overnight coverage
   lands in one Story instead of a next-day duplicate fragment.
2. **Mega-story guardrail**: no Story approaching the pre-0017 shape
   (> 40 Articles or > 15 Outlets in one file).
3. **Unassigned-Article rate** in build logs: watch for a spike from the
   strict lower bound (an Article published before every candidate
   window's founding is lost if nothing re-admits it).
4. **French mid-morning Stories** absorbing next-morning follow-ups within
   the window instead of forking.

**Revert trigger**: the mega-story pattern reappears, or French Stories
fork visibly worse than under the day rule.

## Considered Options

- **Visibility-only fix** (keep Stories visible longer without reopening
  ingestion): rejected — it leaves the 1-hour effective ingestion window,
  the duplicate forking and the false Coverage computation untouched.
- **Extend the grace window alone**: with Publication-day equality in
  place, extending the close merely orphans next-day Articles the model
  has already proposed into the open Story.
- **The pre-0017 rolling behavior** (a Story alive as long as Articles
  keep arriving within 24h of the last one): explicitly rejected — the
  path to topic-like mega-Stories (ADR-0005's 273-Article Story).
- **A replay/backtest harness for window variants**: considered and
  dropped — the trial runs in production on the live pipeline instead.

## Consequences

- The belonging rule is one arithmetic expression (founding + 24h) instead
  of Publication-day equality plus a grace window: the code finally
  matches what the ADR claims the system does, and the ADR-0017
  consequence that accepted the 23h fragmentation is void.
- Coverage is computed per Story over its whole window: a Story is no
  longer split into per-day fragments whose Coverage both understate the
  event's real reach.
- An Article up to 24h old can reach a Story founded up to 24h before it,
  but no pairing can exceed the window: the mega-story bound holds by
  construction, and a Story leaves the Edition at most 24 hours after its
  founding — la Une never carries a two-day-old headline.
- A late-evening founding still keys the Story to its own Paris day, so
  archive organization and stable date-based URLs are untouched.
- The strict lower bound widens the class of forever-Unassigned Articles
  (nothing re-admits one published before every open window's founding);
  the unassigned count in build logs is the watch metric of the trial.
