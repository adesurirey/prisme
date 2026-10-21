# The Edition is uncapped; the AI budget caps Summaries, not stories

Supersedes the backfill tier of ADR-0017 and the `EDITION_SIZE = 20` cut.
Decided 2026-10-17.

> **Partially superseded by ADR-0026** (2026-10-19): the live pool's
> definition below (« today's, and yesterday's until 06:00 Paris ») is gone
> — the Edition is every Story whose Ingestion window `[founding,
> founding + 24h]` is open, with a sharp exit at the close. The uncapped
> ranking and the Summaries budget remain in force.

> **Partially superseded by ADR-0027** (2026-10-21): the Edition is no
> longer the live pool — it is a rolling window over all Stories (frozen
> included) ranked by Coverage counted inside the window. The 24-hour
> Edition stays uncapped; the « 7 jours » Edition carries a significance
> floor (≥ 10 Outlets). The Summaries budget survives, now gated by
> growth (≥ 25 % since a Story's last pass).

The Edition was capped at 20 Stories for one reason only: the free tier of
the Gemini API could not afford more Summaries calls. That leaked an AI
budget into editorial visibility — Stories were hidden from readers because
they had no summary, not because they lacked importance. The cap is
removed; the budget moves to where it belongs.

## The Edition is uncapped

The Edition is every live Story — today's, and yesterday's until 06:00
Paris (the ingestion window of ADR-0017 is untouched) — ranked by the
ADR-0009 key, with no cut. Backfill (previous days' frozen
`everInEdition` Stories) is deleted: with 21–43 Stories observed per day,
the live pool alone covers the start of a new day, and uncapped backfill
would make the Edition grow forever with old frozen Stories. A Story born
right after midnight still ranks in (issue #75's protection holds: with no
cut, every live Story ranks in), and its file and page stay permanent
under the ADR-0005 `everInEdition` rule.

Consequence: the never-in-Edition deletion rule becomes a dormant
guardrail — with every live Story ranking in, it essentially never fires.
It is kept on purpose: it is the garbage collector for the wrong-merge
failure mode the Membership check exists to bound (ADR-0005), not
compatibility code. Storage was checked and is not a constraint: Story
files average ~8 KB (teasers are never on disk, ADR-0003), so the git
database grows ~10 MB/year.

## The AI budget caps Summaries, not visibility

At most 20 Stories gain a Summaries call per build: the top-20 ranked
Stories among those that gained Articles since their last Summaries run.
Unchanged Stories cost zero calls. A Story outside the top-20 keeps its
existing summary as-is — no staleness marker — until it re-enters the
top-20. The budget is per build, recomputed on the fresh ranking, so a
Story hovering just below the cut re-summarizes as soon as it climbs
back.

### The measured budget

The number 20 is derived, not guessed. The Summaries model
(`gemini-3.5-flash-lite`, free tier, shared with Grouping) is limited by
measured quotas from the project's Google AI Studio dashboard
(2026-10-17):

- **RPD 500** — the binding constraint. Grouping makes 1 call per build
  (~24/day hourly builds), leaving ~476 calls for Summaries across ~24
  builds: ~20 per build. The old cap was, by accident, exactly the
  sustainable worst case.
- **RPM 15** — not binding: the pipeline calls sequentially, and the
  45 s 429 backoff (issue #40) absorbs the occasional collision of
  Grouping and Summaries in the same minute (observed peak 17/15).
- **TPM 250K** — not binding (~120K peak observed).
- **RPD headroom in practice**: ~162/500 used, because most builds have
  few changed Stories. Raising the budget above 20 would trip RPD 500 on
  busy days; the per-build retries would then waste quota on failures.

## Pagination

The front page renders every Edition Story in the static HTML; Stories
beyond the first 20 are hidden and revealed by a French "Afficher plus de
sujets" button toggling visibility client-side. Rendering everything
was chosen over JS-appended pages: at ~8 KB of markup per Story the full
page is trivial (images are lazy-loaded), and every Story stays in the
initial HTML — crawlable, where a fetch-based "load more" would hide
Stories 21+ from search engines (no sitemap exists).

## Consequences

- Nothing is hidden from readers for budget reasons; only Summaries are
  rationed.
- `data/edition.json` and the front page grow with the live pool; the
  archive is still pruned only by the never-in-Edition rule.
- Reaching the free tier's ceiling requires raising the budget number
  from a re-measured dashboard, not a code rework.
