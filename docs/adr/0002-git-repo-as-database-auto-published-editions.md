# The git repository is the database, and Editions auto-publish hourly

Date: 2026-10-10 · Amended: cadence reduced to four builds a day (2026-10-07), then restored to hourly (2026-10-10)

Prisme has no budget, so there's no server and no database. A scheduled GitHub Actions run rebuilds the current Edition once an hour, all 24 hours, commits the JSON to the repository and deploys the static React site to GitHub Pages. Actions minutes and Pages hosting are free for public repos, and git history doubles as the archive and the version record of every Edition.

Every build commits, even when no Story changed: `edition.json` sets `builtAt` unconditionally each run, so its diff is never empty and the home page's « dernier point à hh h » always reflects the real verification time of the latest build — a reader can see the data was checked recently even on a quiet night. That costs roughly 24 `data: update edition` commits a day, accepted as archive noise against the benefit of freshness and continuous visibility.

The cron fires at :23 past the hour, deliberately off the 00/15/30/45 slot minutes where GitHub's shared scheduler queue is crush-congested and scheduled runs slip by tens of minutes.

Builds publish automatically, with no review. With roughly 24 builds a day, reviewing each one isn't realistic. A mistake lasts at most until the next build, can be reverted in git, and readers can report errors from the site.

## Considered Options

- PR per Edition with a human merge: rejected once Editions became living documents. It would either block updates or need a dozen reviews a day.
- Hosted database or serverless backend (Supabase, Cloudflare D1/Workers): adds cost and moving parts. A read-only dataset rebuilt a few times a day doesn't need them.
- Running the pipeline only on a laptop: kept as a fallback (same script), not the default, because it relies on the machine being on.
