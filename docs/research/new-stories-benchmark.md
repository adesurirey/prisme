# New-stories benchmark (the "Nouveau" gap)

"En hausse" (issue #102) never badges a Story that is entirely NEW since the
reader's last visit — `markTrending` filters baseline-absent Stories out
explicitly (`trending.ts`: "a Story absent from the reader's baseline never
badges… never 'this is new'"), and a new Story appears wherever its Coverage
ranks it, mixed into the coverage-sorted Edition. This benchmark surveys how
real news products spot NEW stories on an importance-ranked index, and how
they treat "live" updates of an ongoing story, then maps each pattern onto
Prisme's constraints (static Astro prerender, ~hourly rebuild, no server
session, client-side localStorage baseline already in place).

Evidence labels: **direct** = verified on the cited primary page;
**second-hand** = reported by a secondary source, or product behavior I could
not verify from a primary source; **inference** = my own extrapolation,
labeled in the text.

## Surveyed products (primary sources first)

- **NYT** — the Reader Center's breaking-news guide describes the red "Live"
  word on the home page as a build-time signal ("a word in red at the top of
  the page: Live. This signals a specific type of Times coverage…") and the
  live format's fixed top item ("a headline and summary with a short, fixed
  item at the top that helps a reader understand") —
  https://www.nytimes.com/2025/04/07/reader-center/new-york-times-breaking-news-process.html
  (page blocked direct fetch, content read via search extraction — direct).
  The 2021 Insider piece explains live coverage packaging (blogs, briefings,
  chats) — https://www.nytimes.com/2021/08/22/insider/live-coverage.html.
  The NYT app's exact "New"/"Updated" card handling: **not verified from a
  primary source** (second-hand at best; see Missing evidence).
- **Le Monde** — the newsroom explains the "live" format decision ("elle
  ouvre ce qu'on appelle un « live »… ce format permet de traiter
  l'actualité en temps réel") —
  https://festival.lemonde.fr/accueil/1269-rencontre-avec-la-redaction-en-chef-du-mondefr.html
  (direct). The homepage redesign integrates the "directs" as a form of
  personalization next to the human-edited une —
  https://france-jeunes.net/actualites/monde-devoile-nouvelle-vitrine-numerique-change-sur-site-application/
  (second-hand; the "L'essentiel" summary block on en-direct pages is
  **unverified**).
- **The Guardian** — the fullest engineering write-up found: pinned posts
  ("to orient users when first landing on a live blog… readers can instantly
  see the key news/sport/other lines"), a single pinned post, expandable
  container capped at 40% screen height, core expand/collapse built with
  **pure HTML and CSS because some readers visit with JavaScript disabled** —
  https://www.theguardian.com/info/2022/feb/01/creating-pinned-posts-on-our-live-blogs
  (direct). The key-events-only filter toggle is documented there too, and
  Press Gazette reports live blogs "work better than ever" for BBC, Guardian
  and Sky News — https://pressgazette.co.uk/publishers/digital-journalism/live-blogs-bbc-guardian-sky-news/
  (second-hand for the cross-title claim).
- **BBC** — the Editors blog explains the live page format ("short-form
  updates related to big stories as they unfold") —
  https://www.bbc.co.uk/blogs/theeditors/2011/11/live_coverage_on_bbc_news_onli.html
  (direct); BBC's mobile help page repeats the format description —
  https://www.bbc.com/news/help-33446815 (direct). The current "Key points"
  summary block: second-hand, not fetched.
- **Al Jazeera** — the launch press release describes the homepage "fast
  lane" as "a real time feed of everything we publish… also a live blog
  during breaking news events" —
  https://network.aljazeera.net/en/pressroom/new-aljazeeracom-launched
  (direct). MIT Civic Media's interview adds the liveblog-as-homepage use —
  https://civic.mit.edu/index.html%3Fp=1893.html (second-hand).
- **Reddit** — Reddit Help documents "New comment highlighting — any
  comments added since your last visit will be showcased with a red colored
  dot next to the comment" —
  https://support.reddithelp.com/hc/en-us/articles/360043034412-What-is-a-Reddit-Premium-subscription
  (direct). Ars Technica documents the in-feed "new comment" pill: "a new
  comment dropdown pill will tell you how many new comments have been added
  as you view the post… When a redditor clicks on the new comment indicator,
  the comments will sort by new" —
  https://arstechnica.com/gadgets/2021/12/reddit-adds-real-time-conversation-features-live-upvote-counts-and-more/
  (direct content from a secondary tech outlet).
- **Hacker News** — the official feature is gated: HN moderator dang ships
  "an orange border on the left side of the new comments since your last
  visit of the thread" to an email-in alpha —
  https://news.ycombinator.com/item?id=35282815 (direct content from HN
  discussion; the feature itself is not publicly documented —
  **second-hand**). Its demand is visible in a shelf of community
  extensions (e.g. https://github.com/tradziej/hn-new-comments).
- **X/Twitter** — the "Show N new posts" pill: **second-hand**; primary X
  help docs not fetched. Dev/system-design write-ups describe the mechanic
  (buffer late-arriving items, show a pill, apply on click) —
  https://reactteacher.vercel.app/system-design/infinite-scroll and the
  nostr spec guide "Pattern 1: 'N new posts' banner (recommended for
  feeds)" — https://github.com/nostrability/outbox/blob/main/IMPLEMENTATION-GUIDE.md.
- **Bluesky/Mastodon** — Bluesky's own release notes confirm the pattern:
  "Search and hashtag pages now include Top and Latest tabs!" —
  https://bsky.app/profile/bsky.app/post/3kqxv5yeof32a (direct).
  Mastodon's home-timeline behavior (strictly chronological, no Top sort):
  **unverified**, second-hand — see Missing evidence.
- **Google News** — the launch post defines Full Coverage ("a complete
  picture of how that story is reported from a variety of sources") —
  https://blog.google/products-and-platforms/products/news/new-google-news-ai-meets-human-intelligence/
  (direct); the redesign post documents the in-page sort: "You can sort by
  relevance or date" —
  https://blog.google/company-news/outreach-and-initiatives/google-news-initiative/redesigning-google-news-everyone/
  (direct).
- **Apple News** — the support guide describes the Today feed as
  editor-curated plus personalization ("top stories selected by Apple News
  editors, the best stories from the channels and topics you follow…") —
  https://support.apple.com/guide/iphone/see-news-stories-chosen-just-for-you-iph5b557ed3d/ios
  (direct). A per-story "Updated" badge in the app: **unverified**.
- **Ground News** — the FAQ explains aggregation ("Ground News identifies
  every news article written…") and states Top Stories are the same for
  everyone while My Feed is algorithmic —
  https://ground.news/frequently-asked-questions (direct; the shared-front
  page / personalized-feed split is my reading of that FAQ — inference).
- **Flipboard** — **not verified**; no primary source fetched (missing).
- **Wikipedia watchlist** — the Help page documents the per-user
  "updated-since-your-last-visit" UX: "Pages that have been changed since
  you last visited them are shown with a green marker", the **N** marker for
  page creations, bold text for watched pages on Recent Changes, and a
  filter to show "Updated (since my last visit)" changes —
  https://en.wikipedia.org/wiki/Help:Watchlist (direct).
- **Slack-style new-messages divider** — the "New" divider mechanic:
  **second-hand**; Slack help docs not fetched. Community/dev sources
  describe "a red line separating already seen messages from new messages"
  (https://github.com/Yeraze/meshmonitor/issues/4607) and "Unread counts,
  mention badges, a 'new messages' divider" in a Slack clone
  (https://withfluid.com/) — both second-hand.
- **Sports live (L'Équipe)** — the INA media-review journal documents the
  "live commenté" format as a written radio ("radio écrite") —
  https://larevuedesmedias.ina.fr/live-match-foot-coupe-du-monde-lequipe-20minutes-france24-direct-sport
  (direct); L'Équipe's own Directs page: "mis à jour en temps réel (live)" —
  https://www.lequipe.fr/Football/Directs (direct); L'Équipe Tech explains
  iOS Live Activities (lock-screen score widgets, server-pushed updates) —
  https://medium.com/lequipe-tech/comment-fonctionnent-les-live-activities-sur-lapp-ios-l-%C3%A9quipe-8446ba5c666e
  (direct). ESPN: **not verified**.
- **UX write-ups** — NN/g's 1994 usability study reports users "liked the
  use of a 'New' indicator to highlight new information in a list" —
  https://www.nngroup.com/articles/1994-web-usability-report/ (direct);
  NN/g's prioritize guidance warns "If everything is equally prominent, then
  nothing is prominent" —
  https://www.nngroup.com/articles/prioritize-good-content-bubbles-to-the-top/
  (direct). The OpenNews Source piece (by the NYT live product team) class
  live-coverage forms and notes the NYT "reduced its live blogging… and
  expanded our breaking news forms overall", including live briefings —
  https://source.opennews.org/articles/live-coverage/ (direct). The Reuters
  Institute interview with the Guardian's Chris Moran on live-blogging best
  practice — https://reutersinstitute.politics.ox.ac.uk/news/tips-guardian-live-blogging-and-covering-breaking-news-ukraine
  (direct content from an academic outlet).

## The distinct UX patterns

### 1. Per-user "new since your last visit" highlight (localStorage baseline)

- **Who**: Reddit (red dot next to comments added since your last visit —
  Reddit Help), Wikipedia (green marker on pages "changed since you last
  visited them" — Help:Watchlist), HN (orange left border on new comments
  since last visit, gated alpha), Slack clone community implementations of
  the "new messages" divider.
- **Mechanics**: the product stores a per-user cutoff (last visit time, or
  a set of seen item ids) and highlights items that postdate it. Reddit's
  original gold highlighting and Wikipedia's marker are both cutoff-time
  comparisons; the divider is a single visual line at the cutoff position.
- **Signals**: NEW and UPDATED, relative to *that reader* — exactly the
  signal class Prisme's "En hausse" already implements for Coverage gains.
- **Evidence**: direct (Reddit Help, Wikipedia Help); second-hand (HN
  gated feature, Slack divider).

### 2. Build-time freshness signal on the prerendered card

- **Who**: Wikipedia (**N** marker for new pages, on every watchlist line —
  Help:Watchlist), NYT (the red **Live** word on the home page — Reader
  Center guide), Google News (recency-weighted headlines). Any rebuilt
  product that marks items newer than a cutoff, for all readers.
- **Mechanics**: at build/data-write time the product compares each item's
  age (first-appearance time or newest update time) to a cutoff and stamps
  the card. No reader state involved; the signal is shared by everyone.
- **Signals**: NEW (first appearance) and UPDATED (newest change) for the
  whole readership; complements pattern 1's per-reader signal.
- **Evidence**: direct (Wikipedia markers are per-line legends; NYT "Live"
  is a fixed signal word); the "news apps mark updated cards" variant is
  **unverified** (see Missing evidence).

### 3. "N new items" count pill / divider at the top of the list

- **Who**: Reddit (new-comment pill; clicking it sorts the thread by new —
  Ars Technica), X ("Show N new posts" pill — second-hand), Slack (the
  "New" divider under the cutoff — second-hand), Bluesky-style feeds (the
  nostr guide recommends the "N new posts" banner for feeds).
- **Mechanics**: items arriving after the reader's cutoff are buffered
  rather than inserted mid-list; a compact pill counts them and applies on
  click (scroll to top, sort-to-new, or reveal). The divider variant draws
  the line through the existing list instead.
- **Signals**: NEW, counted and located (top of list) — makes the "mixed
  into the ranked list" problem disappear without changing the ranking.
- **Evidence**: direct (Reddit via Ars Technica); second-hand (X pill,
  Slack divider); the mechanic write-ups are dev sources, not UX studies.

### 4. Latest/Top sort toggle (chronological vs ranked)

- **Who**: Bluesky (Top and Latest tabs on search/hashtag pages — Bluesky
  release notes), Google News Full Coverage (sort by relevance or date —
  Google redesign post), Ground News (shared Top Stories vs My Feed split —
  FAQ), Mastodon (chronological by design — unverified).
- **Mechanics**: the same item set rendered under two orderings; the ranked
  ordering is the default, the chronological one is the "what's new" escape
  hatch. In news products it appears as a sort control on the story-level
  page, not as a homepage toggle.
- **Signals**: gives the reader a NEW-by-time view without destroying the
  importance ranking — the reader switches orderings rather than the
  product mixing two signals in one list.
- **Evidence**: direct (Bluesky, Google News); second-hand (Mastodon).

### 5. Live page / live thread format for an ongoing story

- **Who**: NYT (Live: blogs, briefings, chats — Insider + OpenNews), Le
  Monde (en direct — festival interview), Guardian (live blogs, "the
  focal point of article pages" — Reuters Institute), BBC (live pages —
  Editors blog), Al Jazeera (homepage fast lane doubling as live blog —
  press release), L'Équipe (match en direct, live commenté).
- **Mechanics**: one page holds the whole ongoing story: newest updates at
  the top (or bottom, app-dependent), a fixed orientation item at the top
  (NYT's "short, fixed item"; Guardian's pinned post; Le Monde's "L'essentiel" —
  unverified), updates pushed or polled while the reader is on the page.
- **Signals**: LIVE (the story is moving right now) and UPDATED (each new
  post is the "updated" unit, not the story card).
- **Evidence**: direct (NYT guide, Guardian engineering post, BBC Editors
  blog, Al Jazeera press release, Le Monde newsroom interview, L'Équipe
  Directs page); server-side updates are inherent to the format.

### 6. Orientation block on the live page (pinned/key events)

- **Who**: Guardian (pinned post, one only, expandable to 40% screen
  height, CSS-only core — Guardian info post), NYT (fixed top item —
  Reader Center guide), BBC ("Key points" — second-hand), Le Monde
  ("L'essentiel" — unverified), Wikipedia watchlist ("Updated (since my
  last visit)" filter and grouped "enhanced" display — Help:Watchlist, the
  change-orientation variant for the *reader*, not the story).
- **Mechanics**: one editable block kept at the top regardless of the
  update stream, plus an optional filter that hides everything but the
  key events. The Guardian notes the engineering effort "isn't always
  reflected in what the end user sees; in this case a simple toggle".
- **Signals**: ORIENTATION — tells the returning reader what changed
  without making them replay the stream; it is the "spot the new part of
  an ongoing story" pattern for the story level.
- **Evidence**: direct (Guardian post, extremely detailed; Wikipedia
  options); second-hand (BBC, Le Monde).

### 7. In-page "what changed" affordance for returning readers of one item

- **Who**: Reddit ("N new comments" pill inside a thread), HN (orange
  border on comments since last visit), Wikipedia (green "changed since
  you last visited" + "Updated (since my last visit)" watchlist filter),
  Google News Full Coverage (the sort-by-date control inside the story
  page).
- **Mechanics**: the reader's per-item cutoff is stored; when they return
  to the item, the delta is highlighted in place (border, count, filter).
  Pattern 1 at the item level rather than the index level.
- **Signals**: UPDATED — "you saw this before; here is the part that is
  new", the strongest per-reader signal for an ongoing story.
- **Evidence**: direct (Reddit Help, Wikipedia); second-hand (HN gated).

### 8. Curated top cluster (editorial "Today" section)

- **Who**: Apple News (Today feed, editor-selected top stories — Apple
  support guide), Google News (top headlines), Ground News (Top Stories,
  same for everyone — FAQ), Le Monde (human-edited une alongside the
  "directs" — France-Jeunes, second-hand).
- **Mechanics**: a hand-curated or separately computed section above the
  ranked list. Requires an editorial or editorial-like process at build
  time.
- **Signals**: IMPORTANCE, not newness — included here because it is the
  standard way products separate "the few that matter" from the ranked
  pile; it does not by itself mark new stories.
- **Evidence**: direct (Apple guide, Ground News FAQ, Google post);
  second-hand (Le Monde redesign).

### 9. Ticker / widget-class live feed (scores, lock-screen updates)

- **Who**: L'Équipe (Directs pages "mis à jour en temps réel"; iOS Live
  Activities pushing lock-screen score updates), ESPN-class tickers
  (unverified), Al Jazeera's fast lane.
- **Mechanics**: a continuously server-updated feed (page region, widget,
  ticker), content-class specific (scores, minutes).
- **Signals**: LIVE, continuously. Not a "new story" pattern; listed for
  completeness because the task named sports tickers.
- **Evidence**: direct (L'Équipe pages and tech post); second-hand (ESPN).

## Options for Prisme

Grounding for complexity: `index.astro` maps `edition.stories` in order
into `StoryHero` + `StoryCard` and ships one `<script>` running
`installTrending()`; `StoryCard.tsx` exposes the card root as
`data-story-id={story.id} data-coverage={reporting}` with an empty
`p[data-trending-slot]` the client script fills; `trending.ts` already
reads cards by `[data-story-id]`, keeps a `SeenBlob`
(`{coverage, seenAt}` per story id) in `localStorage` and a badge-id
session in `sessionStorage`, and — critically — treats
`entry == null` (baseline-absent) as "not eligible", which is exactly the
gap. The Story page header already reads `articles[0]` as the newest
article, and story files live on disk per story (`loadAllStoryFiles`).
ADR-0003: titles/headlines may be on disk, teaser description text may
not. POC rules: adding a `data/` field is fine, but prefer rebuilding over
compat shims.

**Usage rank** = how widely the pattern is used across the surveyed news
products, ranked most-used first (1 = most used).

| # | Option (pattern) | Usage rank | Complexity | What it requires |
| --- | --- | --- | --- | --- |
| A | "Nouveau" badge for baseline-absent Stories | 2 | **Low** | Client-only: extend `markTrending` eligibility — badge ids with `entry == null` as a separate "nouveau" signal (capped, one badge slot next to "en hausse"); `StoryCard`/`StoryHero` need a second slot style. |
| B | Count pill "X nouveaux sujets" at the top of the index | 1 | **Low–medium** | Client-only: same computation as A (ids absent from the baseline); render a pill above the list in `index.astro`; scrolling/reordering on click adds DOM-manipulation code. |
| C | Build-time "Nouveau" stamp on the card | 3 | **Medium** | Pipeline + data change: the Edition writer must persist each Story's first-appearance (like `classifications.json`, a cross-build record) and stamp `addedAt` into `edition.json`; `StoryCard` renders a prerendered badge; shared by all readers, no localStorage. |
| D | Latest/Top toggle ("Les nouveaux en premier") | 4 | **Medium** | Client-only re-sort of `[data-story-id]` elements in the flat list under a sessionStorage flag; needs a per-Story recency key (story page exists; newest-article time is derivable — `articles[0]`), so a data attribute on the card. |
| E | Story-page "what changed" affordance ("Ce qui a bougé") | 2 | **Low–medium** | Client-only: `SeenBlob` gains a per-story `articleCount` (`StoryCard` ships `data-articles`); the Story page marks articles added since the reader's cutoff, or simply shows the newest N under "derniers ajouts". |
| F | Orientation block on the Story page ("L'essentiel") | 3 | **Low** | Build-time only: an Astro component reading story data (headlines/titles — ADR-0003-legal), one block per Story page; no reader state. Does not mark new *Stories*, only orients on new *articles*. |
| G | Live page treatment ("En direct") | 5 | **High** | Not transferable as live: Prisme has no server and rebuilds hourly; the honest static analog is E + F (a Story page that orients on the newest articles, stamped with the build's "dernier point à {updatedTime}"). |
| H | Curated top cluster | 4 | **Medium–high** | An editorial-like process (human or model) above the Coverage ranking; `index.astro` renders a section; Prisme's contract is Coverage-ordered, so this changes the product promise, not just the UI. |
| I | Ticker/Live Activity-class feed | 9 | **High** | Server push — out of scope for a static site; the hourly rebuild + a "dernier point à X h" line (`index.astro` already renders it) is the static ceiling. |

Ranks note: patterns 1, 3 and 7 (per-user new-since-cutoff highlighting,
count pill, in-page what-changed) are near-universal in the social
products and fully present in Wikipedia; pattern 2 (build-time stamp) is
universal in *rebuilt news products* (every homepage marks its live
stories); pattern 5 (live page) is universal *within* its class (every
surveyed newsroom for ongoing stories) but is a product format, not an
index affordance; 4, 6 and 8 are class-dependent. I place A's family
(pattern 1) at rank 2 and C's family (pattern 2) at rank 3 because for an
*index page of stories* the per-reader baseline mechanism is the one both
the most products and Prisme's own architecture already use — inference
from the survey, not a source claim.

## Contradictions

- **HN official feature**: HN discussion says dang's new-comment
  left-border is real and gated; HN has no public documentation — treated
  as second-hand rather than contradicting anything.
- **Guardian key-events**: the engineering post presents the key-events
  toggle as a "month-long backend task" for a "simple toggle" — no
  contradiction, but a reminder that filtering to key events is the
  expensive half of the pattern (my reading — inference).
- **Live page update direction**: classic web live blogs newest-first,
  app formats vary; no source disputes it, I just did not verify each
  product's current direction.

## Missing evidence

- NYT app's per-card "New"/"Updated" badge behavior — no primary help doc
  found (page fetches blocked, 403).
- Le Monde en-direct "L'essentiel" block and Le Monde's app treatment of
  new stories — unverified.
- BBC's current "Key points" block — second-hand.
- X's "Show N new posts" pill and Slack's "New" divider help-doc
  mechanics — second-hand only.
- Mastodon home-timeline chronological guarantee — unverified.
- Flipboard, ESPN tickers — not researched to a primary source.

## Next steps

- Decide A (badge) vs B (pill) vs both: they share one computation and are
  compatible (badge marks the cards, pill counts and locates them); B's
  count is the cheapest fix for "mixed into the list".
- If C (build-time stamp) is wanted for all readers, check whether the
  Edition writer already knows consecutive-edition membership (the
  classifications-like cache) before designing the record.

## Summary table

| Pattern | Usage rank | Complexity for Prisme | Requires |
| --- | --- | --- | --- |
| A "Nouveau" badge (per-reader, baseline-absent) | 2 | Low | Client-only (`trending.ts`, `StoryCard` slot) |
| B Count pill "X nouveaux sujets" | 1 | Low–medium | Client-only (`index.astro` pill + `trending.ts`) |
| C Build-time "Nouveau" stamp | 3 | Medium | Pipeline + `edition.json` field |
| D Latest/Top reorder toggle | 4 | Medium | Client-only + per-Story recency attribute |
| E Story-page "Ce qui a bougé" | 2 | Low–medium | Client-only (`SeenBlob` + Story page) |
| F "L'essentiel" orientation block | 3 | Low | Build-time only (Astro component) |
| G "En direct" live treatment | 5 | High | Static analog of E+F; real live out of scope |
| H Curated top cluster | 4 | Medium–high | Editorial-like process; changes product promise |
| I Ticker/Live-Activity feed | 9 | High | Server push — out of scope |
