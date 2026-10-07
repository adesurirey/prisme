# Per-Leaning Summaries live in Story files and are written only while the Story is Live

Every Story page must carry its Summaries and Differences (issue #7), but Prisme has no database and never stores teaser text (ADR-0003) — the teasers the Summaries are built from exist only in memory during a build. Regenerating Summaries later is therefore impossible: the input material no longer exists. Summaries are computed at build time, by Gemini Flash-Lite (free tier, shared with the Grouping model and Membership checks), one structured-output call per Live Story in the Edition **that gained Articles since its Summaries were last written** — unchanged Stories make zero calls. The input is the previous Summaries and Differences plus the new headlines and teasers, each with Outlet name, Leaning, Opinion-piece flag and Front-page flag, plus the Story title and Section; never article pages, never full feed bodies. The call writes into the Story file: `summaries` (per-Leaning bullet lists, **only for Leanings that actually cover the Story**), a single `differences` paragraph, `promptVersion` (`sum-1`, bumped by hand whenever the prompt text or schema changes) and `summarizedArticleCount` (Articles are append-only, so a count suffices to identify "the new headlines" next build). A Story with a single covering Leaning gets a model-generated Differences that describes that Leaning's framing and says plainly there is nothing to compare — no invented contrasts — while the "Non couvert par la gauche/le centre/la droite" tab text is derived in the UI from Coverage, never stored. The prompt is neutral, summaries never name Outlets (they speak for the Leaning as a whole), Differences may name Outlets sparingly and stays descriptive ("met l'accent", "omet") — it never adjudicates who is right.

## Considered Options

- Generate Summaries at render time or on demand: impossible without stored teasers, and it would change a published Story page's content after the fact.
- Store Summaries for all three Leanings, including placeholders: model output for an uncovered Leaning invites invention, and it doubles the prompt's job with text the UI can derive deterministically.
- Rewrite a frozen Story's Summaries (e.g. make-up run after an API outage): violates ADR-0005 — frozen files are never edited, full stop.
- Gemini Flash instead of Flash-Lite: roughly twice the request cost against the free tier; a one-day side-by-side on real Stories (recorded in `docs/research/summaries-model-comparison.md`) decides instead of guesswork.

## Consequences

- Summaries must be written no later than the Story's last Live build; the call retries within the build. A hard API failure across retries on that last build leaves a permanently published page without Summaries — an accepted loss, bounded by the retry.
- A frozen page's Summaries always cover its complete Article set (the last write happened after the final Articles arrived), except in the failure case above.
- Summaries and Differences are model *output*, not stored feed text, so ADR-0003 is respected; the prompt instructs paraphrase, and no automated teaser-parroting guard is possible (teasers are never stored to compare against).
- The Flash-Lite free-tier budget is shared with grouping and Membership checks (~1,000 requests/day against a worst case of ~230): `run.ts` logs per-build usage for both consumers.
