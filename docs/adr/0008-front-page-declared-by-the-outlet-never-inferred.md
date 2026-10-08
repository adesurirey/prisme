# The Front page is declared by the Outlet, never inferred

For Outlets without a `une` feed, `collect()` marked the 10 most recent Articles of their `latest` feed as Front page — a guess: for 16 of 21 Outlets, "Front page" actually meant "the 10 freshest items of a chronological feed", and readers saw "À la une chez…" for Articles the Outlet never put forward. The same slice also capped every `latest` feed's contribution to 10 Articles, silently hiding Coverage. Decision: `frontPage` is true only when the Outlet itself declares it via its `une` feed; `latest` feeds contribute their Articles unflagged, capped at the 20 most recent (`MAX_LATEST_ARTICLES`) — a cost knob on classification and grouping, not a Front-page claim (`une` feeds stay uncapped; the largest carries 30 items). The ranking tier "Outlets with a Front-page Article" (issue #6) therefore counts only declared Outlets — Le Monde, Ouest-France, Le Figaro, Le JDD, 20 Minutes — and Coverage, now fed by the larger slice, carries the ordering for everything else. "À la une chez…" on Story pages shows only declared Outlets.

## Considered Options

- Keep the 10-most-recent guess: it was glossary-sanctioned and worked, but it claimed editorial knowledge the Outlet never gave — exactly the guess this ADR removes.
- Guess only for undated feeds (Le Parisien): inconsistent; date order is no more a Front-page declaration than feed order.
- Reclassify feeds that are literally the Outlet's une page (`lexpress/rss/alaune.xml`, `tf1info/rss-une.xml`) as `une` feeds: plausible, but each reclassification needs per-Outlet evidence like everything else in `outlets.ts`; a future issue can bring that evidence Outlet by Outlet.
- Take every in-window Article with no cap: the biggest feeds carry 100–200 items, and the Decision model and grouping bill per Article; the slice exists to bound that.

## Consequences

- "À la une chez…" thins to the five declared Outlets until more `une` feeds are verified; the thinning is the honest state, not a bug to fix by guessing.
- The ranking tier's semantics change without a code change: sparser but true; ties fall through to Coverage, which gains real input from the larger slice.
- The `'à la une'` marker in Summary prompts likewise appears only for declared Front-page Articles.
- `everFrontPage` flags recorded during the guessed era stay frozen in their Story files (ADR-0005); new Stories get them only from declared Front pages.
- Superseded in part by [ADR-0009](0009-coverage-rules-the-edition-ranking.md): the front-page ranking tier is gone (issue #37); front-page flags remain display metadata only.
