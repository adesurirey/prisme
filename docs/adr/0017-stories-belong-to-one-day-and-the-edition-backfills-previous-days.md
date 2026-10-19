# Stories belong to one day, and the Edition backfills previous days

> **Partially superseded by ADR-0022** (2026-10-17): the backfill tier and
> the EDITION_SIZE cap are gone — the Edition is the uncapped live pool.
> **Superseded by ADR-0026** (2026-10-19): the appartenance rule (one
> Publication day per Article) and the 06:00 ingestion window below are
> gone — a Story ingests for 24 hours from its founding Article, in
> instant arithmetic. Do not reintroduce the one-publication-day rule from
> this record alone. The Story day (fixed at creation), the archive pages
> and the day-based Episode/Topic arithmetic remain in force.

Continuous-news Stories spanned days and froze the ranking (ADR-0005 × ADR-0009): the home was a rolling cumulative and the day-by-day evolution was invisible — one Story reached 273 Articles across 27 Outlets with 103 Articles in its last 12 hours. Decision: a Story belongs to **one Publication day** (Europe/Paris) — the day of its founding Article, fixed at creation. An Article may only join a Story of its own Publication day (the Europe/Paris day of its `publishedAt`); a new day means new Stories. The Grouping model and prompt are untouched; the candidate pool shrinks to the current day, so the prompt gets shorter. A Story stays open to ingestion until 06:00 Europe/Paris the day after its day, so an Article published 23h50 but collected after midnight still finds its Story; past that it is frozen (ADR-0005 permanence untouched) and a late-collected old Article stays Unassigned. The Edition ranks current-day Stories first by ADR-0009 Coverage, then fills remaining slots up to EDITION_SIZE (20) with **backfill**: previous days' Stories that have `everInEdition`, newest day first (J-1, then J-2, J-3… as far back as needed), each day ranked by Coverage. Backfill erodes through the day as current-day Stories push it down; at midnight the changeover is smooth. Backfill cards get no visual marking, and a Story may repeat across days (yesterday's episode under today's) — accepted as a chronology the reader already tracks; a lexical dedup heuristic was explicitly rejected. Pages `/archives/<YYYY-MM-DD>/` (ISO date) are rendered at build time from the permanent Story files filtered by Story day — all `everInEdition` Stories of that day, unlimited, ranked like the home — with previous/next navigation from the home plus access by date. This is an appartenance rule, not a scheduled job: no midnight cron. The "chaîne" concept (predecessor links, chain index pages, "Jour 3" labels) is deliberately deferred.

## Amendment (2026-10-14): the midnight gap — window-open Stories rank into the Edition

The assembly rule as written (« current-day Stories first ») had no path into the Edition for a Story **born after midnight** for the previous day: at 00h01 Paris the build's « current day » has already rolled over, so such a Story was neither current-day nor `everInEdition` — born structurally invisible, then deleted by the never-in-Edition rule (issue #75) once frozen. The real build of 2026-10-13 22h01 UTC (00h01 Paris) hit exactly this: 8 Stories born, 0 rankable. Amendment: the Edition's first tier is every Story whose **ingestion window is still open** — today's Stories, and yesterday's until 06h00 Paris — ranked together by the same ADR-0009 key; backfill still draws only from closed `everInEdition` Stories. Outside the 00h00–06h00 range the behavior is unchanged (only today's window is open). A Story born in the grace period ranks into an Edition, acquires `everInEdition`, and survives its freezing as backfill material; a Story born and frozen without ever ranking stays deletable, unchanged. The ingestion window itself (06h00 Paris, wall-clock, no cron) is untouched.

## Considered Options

- A midnight cron closing the day: racy (build timing vs midnight), and redundant — the appartenance rule alone produces the day cut.
- Amend the never-in-Edition deletion rule (ADR-0005, issue #75) so sub-cut Stories of day D survive to backfill: rejected; backfill draws only from `everInEdition` Stories, deletion stays unchanged — a Story that never ranked leaves no hole readers can notice.
- A lexical dedup of continuing subjects across days: rejected (degrades signals, adds a heuristic the Grouping model already handles semantically).
- Building the chaîne/chronology links now: deferred — risk of loading the Grouping model, and readers already track multi-day news mentally.

## Consequences

- An event breaking at 23h starts a small Story of day J that can never compete for the next day's front: its day's Coverage ranks it inside backfill only, while the big Story of day J+1 grows in the current-day pool.
- Multi-day events fragment into one URL per day; chronology is implied by adjacency, and an in-page temporal grid is a possible later addition.
- A late-collected Article whose day's Stories are all closed stays Unassigned (ADR-0005) and is retried only against open Stories next build; if none match, it is lost — rare and cheap.
- Backfill Stories are frozen yet displayed in the Edition: "En hausse" implicitly applies to current-day Stories only (a frozen Story cannot gain Outlets). First visit of the day may mark nearly every current-day Story as trending — accepted for now, to be observed over a few editions before any change.
- `edition:wipe` deletes `data/stories/`, so past archive pages are lost with it: archives are derived pages, disposable like the rest of `data/` (ADR-0002) — no preservation mechanism.
- Frozen Stories' files remain permanent (ADR-0005), which is what makes archive rendering deterministic at build time, ingestion window included.
