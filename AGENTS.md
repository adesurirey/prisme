## Agent skills

### Issue tracker

Issues are tracked in this repository’s GitHub Issues via `gh`. See `docs/agents/issue-tracker.md`.

### Domain docs

single-context. See `docs/agents/domain.md`.

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
- `pnpm test` — all packages (vitest, pipeline).
- `pnpm typecheck` — all packages (tsc + astro check).
- `pnpm --filter @prisme/web build` — build the static site (needs `data/` to exist; run `pnpm edition` first).

Packages: `packages/domain` (shared types), `pipeline` (collector, `tsx`), `web` (Astro + React).

### Hard rules from the ADRs

- **Never write teaser or outlet text to disk.** Teasers exist only in memory inside the collector (ADR-0003). Nothing in `data/` may contain feed description text; if a diff shows teaser-like content in `data/`, stop and fix before committing.
- **Leaning belongs to Outlets, set by hand** in config, backed by sources (ADR-0001). Never classify Articles by Leaning.
- **The UI is French; code, data keys and domain names are English** (GLOSSARY.md).
- **Story pages stay up permanently**: slugs are stable and never reused; a slug collision must be resolved deterministically (by Article id), never by ordering.
