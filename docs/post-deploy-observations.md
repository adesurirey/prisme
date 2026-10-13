# Post-deploy observation points

Things accepted by design that must be checked in production after a few editions, before any code change. Each entry names its review trigger; do not act on an entry until its trigger fires.

## Trending on the first visit of the day ("En hausse")

- **Source**: ADR-0017 (Stories belong to one day, Edition backfills previous days), spec issue #96 / ticket #100.
- **Behavior**: the per-visitor "En hausse" badge (ADR-0014) implicitly applies to current-day Stories only — a frozen backfill Story cannot gain Outlets. On the first visit of a day, nearly every current-day Story may be marked as trending.
- **Accepted for now**: no code; the badge semantics are unchanged.
- **Review trigger**: after a few editions under the dated-Edition behavior (ticket #97, #98, #99), check the early-morning home page (shortly after midnight, Europe/Paris): how many current-day Stories carry "En hausse"? If nearly all of them do on a regular basis, revisit the Trending criterion (e.g. relative to Coverage velocity within the day) in a dedicated design session.