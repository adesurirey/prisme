# The « 7 jours » edition is removed

Decided 2026-10-30. Removes ADR-0027's third window (its floor and its
page); amends ADR-0022's floor note, ADR-0027, ADR-0028's picker
enumeration and ADR-0036's.

## Context

« 7 jours » shipped (issue #128, ADR-0027) as the catch-up edition for
the reader who follows the news less often — a 7-day window floored to
Stories covered by ≥ 10 Outlets. In practice it is the unread edition:
the daily-visit habits are served (« En direct », « Le fil »,
« Aujourd'hui »), and the weekly habit never formed — the page churns
too slowly to earn a place in the picker, and its near-duplicate of la
Une over the same Stories costs more attention than it returns.
Experiments over editions (ADR-0036's premise) mean keeping the picker
honest: an entry nobody reads dilutes the three that are used.

## Decision

- **The window, its floor and its page are deleted**: no `week` in the
  Edition assembly, no `WEEK_WINDOW_MS`/`WEEK_FLOOR_OUTLETS`, no
  `weekStories` in the Edition artifact (no compat — the POC archive is
  disposable), no `/7-jours/` page, no picker entry.
- **The Editions are three again**: En direct, Le fil, Aujourd'hui —
  chronology, weighted chronology, coverage (ADR-0036's gradient).
- **`everInEdition` stamping follows the shipped windows** (day + feed,
  with latest ⊂ day): a frozen Story that never entered one of them is
  deleted by the never-entered rule, as before — the week was never a
  stamping promise, just one more window that did.
- **The weekly-visit habit stays unserved for now.** If it ever earns
  its return, it returns as a new experiment with its own measurement —
  not by re-adding this page.

## Consequences

- `/7-jours/` 404s; it was noindexed and out of the sitemap, so nothing
  linked or indexed breaks.
- GLOSSARY's Edition entry and the Méthode page drop the week scale;
  the build log counts En direct, Le fil, Aujourd'hui.
- No wipe: the next build simply writes an Edition without
  `weekStories`.
- The old `weekStories`-keyed artifacts in past `data/` commits are
  historical; nothing reads them (POC, no backward compatibility).
