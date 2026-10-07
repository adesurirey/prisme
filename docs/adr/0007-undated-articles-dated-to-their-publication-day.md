# Undated Articles are dated to the end of their Publication day, never to an invented clock time

Le Parisien's feeds carry title and link only — no `pubDate`, no description, no image (verified 2026-10-06; re-verified 2026-10-07 across every official feed variant, including the Arc XP outbound feeds). The "en-continu" feed answers 200 with 0 items and the "une" feed serves 2019 archives. So `collect()` rejected every Le Parisien Article on the 24h filter, and the outlet contributed nothing (issue #12). Decision: when a feed item has no date, Prisme reads its Publication day from the Article's own web address — Le Parisien slugs embed `DD-MM-YYYY`, matching 96 of 100 items on any given day — and dates the Article to the end of that Paris day, deliberately generous so yesterday-evening Articles stay within the 24h window. When even the day is unknown, the Article is dated to the moment it was collected, but only while the feed's `lastBuildDate` is itself within the 24h window: a stale feed must not freeze old headlines into the Edition as fresh. Such Undated Articles carry a day-precision marker so Story pages show the day without a time — the UI never presents a fabricated clock time as if it were real. The rule lives in the feed parser as a fallback for dateless items, not as a per-Outlet flag: it only fires where a feed has no dates to offer, so no other Outlet's dating changes.

## Considered Options

- Google News RSS as the date source (`site:leparisien.fr when:1d`): real timestamps, but items link through `news.google.com` redirects — that breaks Article identity, direct reading and TDM attribution, and the redirect-decoding step is fragile against Google changes.
- Scrape the homepage's embedded Arc XP ANS JSON: exact `publish_date`, images and occasional descriptions, but a new non-RSS feed format fed by a ~2 MB minified page that breaks silently on redesigns. Remains the upgrade path if Le Parisien's feed stays degraded.
- Exclude Le Parisien from the window (the issue #2 status quo): a top-2 PQR would never contribute to the une or Coverage.
- Keep `publishedAt` empty for undated items and special-case every consumer: date sorting and window filtering are everywhere in the pipeline; one documented convention beats empty-string branches everywhere.

## Consequences

- Dating is day-level: the end-of-day convention is generous by up to a day, bounded by the fact that the feed itself churns daily.
- A Story whose newest Article is Undated shows a date without a time of day.
- Le Parisien Articles still have no images and no teasers: a Story only it reports has no cover image, and its Articles classify from the headline alone (already supported).
- The collection-time fallback dies with the feed's freshness: a stale feed keeps its URL-dated Articles but drops its undated ones and logs a failure.
- Once written to `data/` (ADR-0002) and frozen into Story files (ADR-0005), these day-end timestamps are permanent; changing the convention later leaves mixed semantics across history — that is the cost this ADR records.
