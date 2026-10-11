## Agent skills

### Issue tracker

Issues are tracked in this repository’s GitHub Issues via `gh`. See `docs/agents/issue-tracker.md`.

### Domain docs

single-context. See `docs/agents/domain.md`.

Adding an Outlet to the Edition (élargissement issue, `prd` + `ready-for-agent`): follow the `add-outlet` skill (`.agents/skills/add-outlet/SKILL.md`) — dossier, typed config, tests, verification and PR in one pass.

Brand (name, catch line, mission, voice): `docs/brand.md`. Read it before writing or changing any user-facing copy — taglines, page titles, meta descriptions, badges, legal pages.

Outlet Leanings and their sources: `docs/research/outlet-leanings.md` (the research behind the typed config in `packages/domain/src/outlets.ts`). Read it before changing an Outlet's Leaning, adding or removing an Outlet, or answering "why is this media classed there?".

Article classification (Kind and Section): `docs/research/decision-model-benchmark.md` (the benchmark behind the Decision model in `pipeline/src/decision-model.ts`). Read it before changing the classification prompt or criteria, swapping the model, or re-grading. The labeled pairs live only in the gitignored `.benchmark/` cache; the committed labels file carries ids and URLs — feed text never enters the repo (ADR-0003).

## Conventions

### Commits — Conventional Commits

Every commit message uses the [Conventional Commits](https://www.conventionalcommits.org/) format:

```text
<type>(<scope>): <imperative summary>

[body: what and why, wrapped at ~72 chars]

[footer: Closes #<issue>, when applicable]
```

- Types in use here: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`. Scope is optional; when used, name the package: `pipeline`, `web`, `domain`, `data`, `ci`.
- Subject line imperative, lowercase first word, no trailing period.
- Generated files still get real commits — `data/` is the database (ADR-0002), so pipeline runs commit as `data: update edition (<UTC timestamp>)`.

### Repo layout & commands

pnpm monorepo. Run everything from the repo root:

- `pnpm edition` — run the pipeline: fetch all Outlet feeds, write `data/edition.json`, `data/outlets.json`, `data/stories/<slug>.json`. Same command locally and in CI.
- `pnpm verify` — re-check the Outlet config evidence: feed status, item count, time covered, image presence, TDM reservations (feeds and TDM probes only; prints stats).
- `pnpm test` — all packages (vitest, pipeline).
- `pnpm typecheck` — all packages (tsc + astro check).
- `pnpm --filter @prisme/web build` — build the static site (needs `data/` to exist; run `pnpm edition` first).
- `pnpm benchmark:export` / `pnpm benchmark:grade` — sample headline+teaser pairs for hand labeling, then grade the decision models against the labels (grade needs `OPENROUTER_API_KEY` in env).

Packages: `packages/domain` (shared types and the sourced Outlet config), `pipeline` (collector, `tsx`), `web` (Astro + React).

### Hard rules from the ADRs

- **Never write teaser or outlet text to disk.** Teasers exist only in memory inside the collector (ADR-0003). Nothing in `data/` may contain feed description text; if a diff shows teaser-like content in `data/`, stop and fix before committing.
- **Never run `pnpm edition` without the user's explicit consent.** It calls paid classification and summary APIs (Gemini) and costs real money. `pnpm verify` (feeds and TDM probes only) is free and needs no consent.
- **Leaning belongs to Outlets, set by hand** in config, backed by sources (ADR-0001). Never classify Articles by Leaning.
- **The UI is French; code, data keys and domain names are English** (GLOSSARY.md).

### No backward compatibility (POC)

The archive (`data/`) is disposable, not a contract — this is a POC.

- **Never add migration, versioning, or compat shims** for `data/` shapes — no schema
  versions, no "handle legacy field", no tolerant readers of old files, no code paths
  that exist only to keep past runs readable.
- **When the pipeline algorithm or a domain type changes, wipe and rebuild instead of
  translating**: `pnpm edition:wipe` deletes `data/stories/` + `data/edition.json` and
  reruns from scratch. Prefer that over writing compatibility code. It runs `pnpm
  edition`, so it costs API money — get the user's explicit consent first, same rule
  as above.
- One deliberate exception: `data/classifications.json` survives a wipe. Article ids
  are content-based, so the classification cache stays valid across algorithm changes
  **unless the id scheme itself changed** — then delete it too and say so.
- Frozen-Story permanence (ADR-0005) is a product guarantee, not a compat concern: it
  governs what the edition promises readers, not how `data/` evolves internally. Don't
  cite it to justify keeping old data formats around.
- When reviewing, treat any fallback/optional handling for a `data/` shape that no
  current pipeline run can produce as dead compat code — prefer deleting it.
- **Story pages stay up permanently — once in the Edition**: a Story that has entered the Edition (`everInEdition`) is never edited once frozen and its slug is never reused; a slug collision must be resolved deterministically from Story ids, never by ordering — across builds the existing file keeps its slug, within a build the smallest Story id keeps the bare slug, and other claimants get a Story-id suffix. A frozen Story that never entered the Edition is deleted at the end of each run (issue #75).
