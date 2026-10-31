# « À la une » is one page; a select switches its window; only the home edition is indexed

Decided 2026-10-23. Owns the editions header the rolling windows of
ADR-0027 render into, and the indexation of those windows.

## Context

Four editions are coming — Aujourd'hui (24 h), 7 jours, 30 jours, En
direct — all lists over the same Stories, differing only in window and
floor. 80 % of visits are phones: the header cannot hold four links next
to the h1 on a 360 px screen. Two patterns were weighed on accessibility
and familiarity — inline pills on a horizontal scroller, and a native
`<select>` — and the select wins: the platform picker (iOS wheel, Android
bottom sheet) is the pattern readers already operate daily, its touch
target, font scaling and pop-up-button announcement need no ARIA and
cannot be mis-wired, while an overflowing pill row hides its own
affordance.

On the SEO side, the windowed editions are near-duplicate lists over the
same Story URLs — the Story pages, the real ranking assets, are shared —
so preserving a crawlable link graph between editions buys nothing worth
keeping. Indexing every window would instead hand Google a canonical
contest between lists over the same Stories, with the freshest page (the
home) not guaranteed to win; the live edition — a strict subset that
churns hourly — must never compete at all.

## Decision

- **« À la une » names the surface and is the h1 on every edition page.**
  The h1 never changes; the *window* is the select's preselected value.
  EditionHeader renders all editions from one `EDITIONS` list (« 30
  jours » and « En direct » append when their pages ship).
- **The switcher's face is a real button** — the browser's own focus
  ring, the OutletGroup disclosure's recipe — at back-link size (muted
  text, caret in the same color), opening the native picker of a
  visually hidden select via showPicker(). No platform text rendering,
  no width jump when the value changes, native picker semantics; the
  change on the select navigates. Pre-showPicker browsers fall back to
  the transparent overlay (the select stretched over the face).
  `<noscript>` links for readers without JS — those links exist for
  humans, not crawlers. It is not sticky: edition switching is a
  top-of-visit act.
- **The temporal anchor collapses, the pill survives.** Under `sm:` the
  row is h1 + select (+ the per-reader « Nouveau » pill on the home);
  the day / « depuis le … » anchors hide — the footer count line already
  carries the timestamp.
- **Back links always say « À la une ».** The wording names the page;
  the behavior is unchanged — a reader arriving from « 7 jours » still
  gets history.back() (scroll restored) and a retargeted href. The label
  tells the truth about the page; the select states the filter they
  will land on.
- **Only the home edition is indexed.** Every other edition ships
  `<meta name="robots" content="noindex">` and stays out of the sitemap,
  with crawling allowed — a robots.txt disallow would hide the page from
  the very crawler that must read the noindex. robots.txt is untouched.
  The 7-day edition forfeits whatever indexed presence it had; the move
  is one meta tag per page and therefore reversible.

## Consequences

- The brand brief owns the catchline as a brand string, not page titles:
  docs/brand.md no longer declares the home h1.
- A new edition costs one entry in `EDITIONS`, one page, one
  sitemap-filter path and one `noindex` — never a header redesign.
- The select replaces the last crawlable link between editions; that is
  accepted because the destinations are deliberately not indexed. If a
  windowed edition is ever re-indexed, it must also re-enter the sitemap
  and grow real links (footer or desktop) at the same time.
- Amended by ADR-0029: « En direct » ships as the picker's first entry —
  the order reads freshness-first (En direct, Aujourd'hui, 7 jours;
  « 30 jours » after « 7 jours » when it ships) — and the temporal
  anchors return on small screens on every edition: the hiding existed
  to fit the « Nouveau » pill, which ADR-0029 removes.
- Amended by ADR-0036: « Le fil » joins the picker — the order reads
  chronology-first (En direct, Le fil, Aujourd'hui, 7 jours): pure
  chronology, chronology weighted by Coverage, pure Coverage, the week.
- Amended by ADR-0037: « 7 jours » leaves the picker the same day — the
  three shipped editions are En direct, Le fil, Aujourd'hui.
