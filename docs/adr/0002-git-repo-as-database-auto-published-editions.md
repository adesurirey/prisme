# The git repository is the database, and Editions auto-publish every 2 hours

Prisme has no budget, so there's no server and no database. A scheduled GitHub Actions run rebuilds the current Edition about every 2 hours, commits the JSON to the repository and deploys the static React site to GitHub Pages. Actions minutes and Pages hosting are free for public repos, and git history doubles as the archive and the version record of every Edition.

Builds publish automatically, with no review. With roughly 9 builds a day, reviewing each one isn't realistic. A mistake lasts at most until the next build, can be reverted in git, and readers can report errors from the site.

## Considered Options

- PR per Edition with a human merge: rejected once Editions became living documents. It would either block updates or need a dozen reviews a day.
- Hosted database or serverless backend (Supabase, Cloudflare D1/Workers): adds cost and moving parts. A read-only dataset rebuilt a few times a day doesn't need them.
- Running the pipeline only on a laptop: kept as a fallback (same script), not the default, because it relies on the machine being on.
