# Coverage rules the Edition ranking

Issue #37's audit of the edition built 2026-10-08T11:38:55Z found that the ranking key (issue #6: front-page Outlets, then Coverage) concentrated the Edition on the Outlets with fast-rotating `une` feeds. Of 690 live Stories, 64 had any front-page article — all exactly one (front-page singletons) — so the top-20 cut was decided by Coverage→recency tie-breaks among those singletons: Ouest-France took 10 Edition slots and Le Figaro 9, 28 of the Edition's articles came from those two Outlets, 15 Outlets contributed zero, and the day's highest-Coverage Story (79 articles across ~15 Outlets, no front-page flag) fell below the cut. Front-page presence, a per-Article snapshot of `une` feeds (ADR-0008), measured feed turnover as much as an Outlet's own judgment.

Decision: Coverage — distinct reporting Outlets, Opinion pieces excluded — is the sole ranking key, followed by the newest Article, then creation time and id, fully deterministic across builds. Front-page flags leave the ranking entirely; `une` feeds, `frontPage` and `everFrontPage` recording, and the "À la une chez…" display stay as ADR-0008 defines them, as metadata rather than a ranking signal. The 24h collection window, not the ranking key, bounds staleness: a Story with no new Articles for 24 hours freezes out of the next Edition. EDITION_SIZE stays 20.

## Considered Options

- Count `everFrontPage` alongside the snapshot: it would soften feed-rotation erasure but keeps front-page presence — a property of 5 of 21 Outlets — as a ranking input, reintroducing the concentration mechanism at lower magnitude.
- A Coverage-plus-recency blend or a staleness cutoff: unnecessary; the collection window already expires stale Articles, and a cutoff would be a second, unrequested policy.
- Raise EDITION_SIZE to reach fps=0 Stories: treats the symptom; with fps out of the key the cut reaches all Stories by Coverage.

## Consequences

- Wide multi-Outlet Stories, even with no front-page presence, top the Edition; single-outlet Stories rank by recency among themselves.
- The failure modes to watch over the next editions: tie storms (many equal-Coverage Stories ordered mostly by recency) and evergreen pinning (only possible while a topic keeps generating fresh Articles). No numeric rollback trigger; review after 3 editions.
- The ranking semantics described in ADR-0008's consequences are superseded by this ADR; that ADR's declaration rule — front-page is what the Outlet says, never inferred — stands.
- Issue #37's other suggestions (everFrontPage counting, EDITION_SIZE review) were considered and rejected; the reasoning lives here.
