# Blocked Outlets are excluded, not mirrored

Some outlets' feeds sit behind bot walls that block CI egress regardless of
client: Marianne's AWS WAF answered 405 (`x-amzn-waf-action: captcha`) to
GitHub runner IPs in 144/144 CI runs since 2026-10-06, and 403 to datacenter
IPs generally (probed through r.jina.ai), while the direct feed answers 200
from residential egress. Les Échos answers 403 outright. For such outlets we
exclude the Outlet from the Edition rather than route collection through an
aggregator mirror — until the block lifts, when the Outlet comes back on
its own feed.

The obvious alternative — a Google News RSS mirror
(`site:<domain>+when:1d`, verified 200 from CI with 16–100 items/24 h) — was
examined and rejected. Its item descriptions only repeat the headline plus
the source name: no teaser, no image. The Decision model would classify
Marianne — a politique-heavy outlet where Kind and Section often hinge on
the teaser — headline-only, and Summaries would run on headlines alone even
though ADR-0003 says Summaries depend on how much each teaser says, by
design. Keeping the mirror's redirect as the canonical URL was also
examined: since 2024 the redirect payload no longer embeds the publisher
URL, and resolving it needs Google's internal `batchexecute` API behind a
per-article signature on a consent-walled landing page; a decoder that
sometimes fails would give the same Article different ids across builds, and
Story membership is keyed on article ids — so link purity loses to id
stability. (Bing News RSS, the other aggregator escape hatch, supports
neither `site:` queries nor useful result counts — 2 items for Marianne, 0
for Les Échos.)

Consequences: a blocked Outlet's contribution is zero and the Edition reads
as such; re-entry requires the direct feed to answer 200 from CI, a fresh
`pnpm verify` pass, and re-sourcing the Leaning.
