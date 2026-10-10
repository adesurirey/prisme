---
name: add-outlet
description: Add a new Outlet (media) to the Prisme Edition when an élargissement issue (labelled prd, ready-for-agent) asks for it — e.g. "add Challenges/Le Telegramme to the Outlets config", issue #72-style tasks. Covers the sourced dossier, the typed config entry, evidence tests, feed/TDM re-verification and the PR.
---

# Add an Outlet

The perimeter is open (issue #10): an Outlet enters the Edition when audience
evidence (ACPM or equivalent), a working RSS feed, and a sourced Leaning are
all in place. The method's source of truth is `docs/research/outlet-leanings.md`
(Méthode section) and the typed encoding is `packages/domain/src/outlets.ts` —
read both headers before starting. The rules that bind are in AGENTS.md
(ADR-0001: Leaning belongs to the Outlet, set by hand; the UI is French, code
and data keys English).

Work the six steps in order. Everything ends in one branch and one PR that
closes the issue.

## 1. Research the candidate

Fetch the FrIdéo page (score, 95% confidence interval, band, rank, evidence
families, final owner): `https://frenchnewslab.org/fr/medias/<slug>`. The slug
is usually the lowercase name without punctuation, but it is not guessable —
`/challenges`, yet `/l-opinion` (apostrophes dropped) — so read it off the
media list (`/fr/medias`) instead of guessing.

Then gather ≥ 2 independent citable sources for the Leaning: the FrIdéo page
plus Wikipédia (with its press citations), Media Bias/Fact Check, Lucide,
Acrimed, or a founding charter. **Done when**: you can quote each source
verbatim (one-line French takeaway) and any disagreement between them is
written down, not averaged away.

## 2. Write the dossier

Append a section to `docs/research/outlet-leanings.md`, in the existing
format and position (grouped by Leaning): `### <Name> — <Leaning>`, then
**Placement / Désaccords entre sources / Sources / Audience / Flux vérifiés /
Paywall / TDM**. Headings and section text are French and publishable as-is
on `/pourquoi-ce-classement`; quotes stay citation-length (ADR-0003: the site
never republishes Outlet text).

Mandatory details per the method: cite FrIdéo with its version (v1.0,
2026-08-10) and the panel-relativity caveat; state the confidence interval,
and when it contains zero, say the band is a convention (Limites connues,
point 3); justify the feed choice (`latest` = the most complete feed, `une`
only for a real front-page feed); give the 24 h window count, not the raw
feed size (a 250-item feed may carry ~17 articles/day).

Update the summary table (row at the right position) and the count line
« À ce jour, **N médias** » — a domain test fails when this line or any
dossier heading drifts from the config count, so the test is the completion
check. **Done when**: the dossier reads like its neighbours and the table,
the heading count and the config agree.

## 3. Add the typed entry

Add an `OutletConfig` to `packages/domain/src/outlets.ts`, in the Leaning
group matching the dossier, carrying the same evidence: `leaningSources`
(each takeaway = the French quote from the dossier), `leaningNote`,
`readership`, `feedChecks`, `tdm`, `paywall` (`none` / `partial` / `full` —
keep the dossier's own wording, e.g. « en grande partie payant » maps to
`partial` with the nuance kept in the table). Use the single `CHECKED`
constant for every `checkedAt` — all Outlets are re-verified the same day.
Code stays English except the publishable French values.

**Done when**: dossier and config are strictly consistent — same names, same
paywall wording, same TDM facts, same feed URLs.

## 4. Test

Add one issue-specific test to `packages/domain/outlets.test.ts` following
the existing per-issue tests (Outlet in the Edition, expected Leaning, feed
URLs, TDM facts, not in `excludedOutlets`). The module's evidence-rule tests
(≥2 sources, feed checks, TDM dates) run for free. **Done when**: the full
domain suite and `pnpm typecheck` pass.

## 5. Verify for real

Run `pnpm verify` (browser User-Agent). Judge its output, not raw curl calls:
- The TDM probe **follows redirects** (Node fetch). A bare curl can report
  403/301 and miss a published reservation — Challenges publishes
  `tdm-reservation: 1` through a 301 from `/.well-known/tdmrep.json` to
  `/tdmrep.json`. Trust `pnpm verify`'s `reserved` field.
- Compare each feed's status/items/span/images against the dossier and
  config; correct either side if they disagree.
- Anti-bot notes (GPTBot/CCBot/PerplexityBot blocking) are anti-AI facts,
  distinct from TDM reservations — record both where they differ.
If the feed needs a parser feature (CDATA, missing dates, Arc XP endpoint),
fix `pipeline/src/feeds.ts` first with a regression test — as a separate
`fix(pipeline)` commit. **Done when**: `pnpm verify` prints no surprises and
every number in the dossier is observed, not copied.

## 6. Ship

**Never run `pnpm edition` without the user's explicit consent** — it calls
paid classification and summary APIs (Gemini) and costs real money. If the
user consents, you may smoke-test the full flow locally, and then **leave
`data/` out of the PR**: revert any edition output before pushing; `data/`
updates belong to CI's hourly commits (ADR-0002). Branch as
`feat/<issue>-<slug>`, commit as `feat(domain): add <Name> to the Outlets
config (issue #N)`, put `Closes #N` in the PR body, then run the code-review
skill and answer its findings before requesting review.

## Known traps (each one already cost a fix)

- Feeds can wrap **every** field in CDATA (Challenges): the parser must route
  dates through the CDATA-aware helper or it throws.
- FrIdéo page slugs are irregular (see step 1).
- The doc count line drifts from the config — trust the test, not memory.
- A large feed says nothing about volume: report the 24 h contribution.
- Marianne's WAF blocks GitHub runners even with browser headers
  (`x-amzn-waf-action: captcha`) — CI editions may differ from local runs.
