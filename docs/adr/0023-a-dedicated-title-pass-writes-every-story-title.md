# A dedicated Title pass writes every Story title

Story titles used to be a side output of the Grouping call: the model that
assigned ~700 Articles also wrote new-Story titles and `titleUpdates`, and
the title rules — the densest instructions in the prompt — were buried mid-
bullet. Drift followed in both directions (ADR-0013 amendments), and the
Oregon-episode title of 2026-10-17 dropped every shared fact of its
3-headline group while using half the old character budget. Decided: the
Grouping model only groups — keys and assignments — and a dedicated **Title
pass** (one structured-output call per build, after resolution, before any
file is written) writes every title. Considered and rejected: piggybacking
titles on the Summaries call — its budget (top-20 Stories, ADR-0022) would
leave out-of-budget Stories untitled, its input sees only unseen Articles so
the title could not be framed from the whole group (ADR-0013), and its
silent-failure posture is wrong for the homepage's main entry.

## What the pass receives

- **Births** — Stories created this build (survived the seed guard, ≥2
  Articles): their headlines, keyed by the Grouping proposal's key, plus the
  previous **Episode** when one exists — the most headline-similar Story on
  disk (token overlap ≥ 0.25, `episodeContext`), so the title can carry what
  changed since the episode the reader already saw. This is what makes the
  Edition read as day-by-day episodes from titles alone.
- **Updates** — existing Stories that gained Articles: their full headline
  history and current title. Retitling is guarded by the old rule: only when
  a better title exists, else the Story keeps its title.

A failed pass — HTTP, unparseable after one retry, or a birth key left
untitled — fails the build: nothing is written, the last committed Edition
stays live (same posture as Grouping, ADR-0005). The rules of ADR-0013
(actor + verb + complement, symmetric qualification fidelity, facts from the
group's headlines) live here and nowhere else: `pipeline/src/title-pass.ts`.

## Consequences

- The slug is derived from the final title, at creation, and never
  re-derived: a retitle of a live Story changes only `story.title`, the slug
  stays (ADR-0005). A Story carries neither title nor slug until the pass
  has answered.
- Grouping's schema sheds `title` on `newStories` and the whole
  `titleUpdates` field; the grouping benchmark harness's schema copy is
  synced.
- One more call per build (~24/day) against the shared Gemini free tier —
  well inside the RPD 500 budget that ADR-0022 derived; a from-empty rebuild
  makes the pass input as large as the Grouping call itself, so the output
  cap and retry posture match.
- The pass input is headlines only (ADR-0003): teasers never leave memory
  for titling.
- A frozen Story's title is immutable like its slug; the only correction
  path after freezing is a manual edit of the story file (the repo is the
  database, ADR-0002).