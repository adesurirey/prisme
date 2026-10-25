# Prisme

Prisme shows each day's front-page news from the major French outlets, and how each political leaning covers it. The UI is in French and code/domain names are in English.

## Language

### Outlets and leanings

**Outlet**:
A widely read French general-news publisher whose Front page and Articles Prisme reads (e.g. Le Monde, Le Figaro). Outlets are chosen for readership or editorial significance, never to balance Leanings.
_Avoid_: Source, newspaper, media, publisher

**Leaning**:
The political position assigned to an Outlet: Gauche, Centre gauche, Centre, Centre droit or Droite. It belongs to the Outlet, never to an individual Article.
_Avoid_: Bias, prism, side, orientation

**Front page**:
The Articles an Outlet puts forward as "à la une" at a given moment. Prisme marks Front-page Articles only when the Outlet declares them as such; it never infers the Front page from recency.
_Avoid_: Homepage, headlines, top news

### Articles and stories

**Article**:
A single piece published by one Outlet. Prisme links to it on the Outlet's website.
_Avoid_: Post, item, link

**Opinion piece**:
An Article that argues a position (editorial, column, op-ed) rather than reporting news. It counts toward Coverage and informs Summaries (ADR-0011); it never supplies a Story's image.
_Avoid_: Editorial, tribune (as a generic term)

**Kind**:
The classification of an Article: news, opinion, live or not_news. The Decision model assigns it from the headline and teaser. A not_news Article never reaches the Edition; an Opinion piece counts toward Coverage like any other Article (ADR-0011).
_Avoid_: Type, category, tag

**Decision model**:
The cheap language model Prisme uses to assign each Article its Kind and Section.
_Avoid_: Classifier, judge, AI (alone)

**Undated Article**:
An Article whose Outlet's feed carries no publication time. Prisme stamps it with the exact instant of its collection (ADR-0007) — its URL's Publication day serving only as a freshness guard — and marks it `datedAtCollection`; the UI shows the stamp as received.
_Avoid_: Dateless, missing date, guess

**Publication day**:
The day an Article was published, when that is all Prisme knows about when it appeared. In an Undated Article's URL it serves as a freshness guard (ADR-0007), never as a dating source.
_Avoid_: Timestamp, exact date

**Story**:
A precise news event, or the directly connected chain of developments on one, made up of the Articles that report on it. A Story holds a fact, never a theme: Articles on the same broader topic but a different fact belong to their own Story. National and international news are both in scope. A Story's id and slug are fixed when it is created and never change.
_Avoid_: Topic, cluster, event, subject, theme

**Topic**:
A thread of Episodes: one event followed across days — not a theme (theming is the Classification's Section) and not a recurring format (whether "PSG matches" merge is a deferred product question). A Topic exists from two Episodes, like a Story exists from two Articles (ADR-0015); every Story still carries its Topic key for life — the Episode it continues, or its own id as a prospective key at founding. Topics resolve before the Title pass, so the pass's episode context is only fed a Jev-confirmed thread, with its label. Assignment at birth: the lexicon proposes (`bestEpisodeMatch`, within the age window), Membership disposes (the `sameSubject` question, whole thread vs whole birth). The Topic id is the founding Story's id (internal join key); the registry, `data/topics.json`, lists only confirmed Topics, each with a short display label (two or three words from the thread's own headlines — « Mobilisation lycéenne » — computed at confirmation) and a public slug derived from that label, in its own namespace (ADR-0024). No UI reads Topics yet (ADR-0024).

**Story title**:
The neutral French name of a Story, written by the Title pass (ADR-0023) — never by the Grouping model. Distinct from any Outlet's headline. A Live Story's title may change while it gains Articles; a Frozen Story's title is immutable, like its slug.
_Avoid_: Story headline

**Episode**:
A later Story covering the same news event as an earlier one — the day-by-day continuation the reader follows from titles alone. A Story's Ingestion window closed, or the new development is a distinct fact: a new Episode is born (ADR-0017, ADR-0018), and the Title pass is shown the previous Episode's title — when its thread is confirmed, with the Topic's label — so the new one carries what changed (ADR-0023, ADR-0024).
_Avoid_: Follow-up, part 2, sequel

**Live Story**:
A Story whose Ingestion window is open — at most 12 hours have passed since its newest Article, once that is later than 24 hours from the founding (ADR-0027). Live Stories can gain Articles and appear in the Editions' windows (ADR-0022).
_Avoid_: Active story, open story

**Frozen Story**:
A Story whose Ingestion window has closed — silent past its 24-hour floor plus 12 hours. It no longer ingests and is never modified again; it stays visible in an Edition's window while its Articles are recent enough, and once it has entered the Edition its page stays published. A Frozen Story that never entered the Edition is deleted at the end of each run (issue #75).
_Avoid_: Archived story, closed story, expired story

**Grouping model**:
The cheap language model Prisme uses each build to assign new Articles to live Stories or start new ones. It never writes titles (ADR-0023).
_Avoid_: Clustering, matcher, AI (alone)

**Title pass**:
The cheap language model call, one per build after Grouping resolution, that writes every Story title — births and, for Stories that gained Articles, retitles. The only place a Story title is ever written; a failed pass fails the build (ADR-0023).
_Avoid_: Titling model, retitle job

**Membership check**:
A yes/no check that decides whether an Article joins the Story the Grouping model matched it to, or whether a proposed new Story carries the same event a live Story already has (the birth guard, ADR-0030).
_Avoid_: Verification, noul check

**Unassigned Article**:
An Article this build matched with no Story: refused by a Membership check, mis-targeted, or left unmatched by the Grouping model. It is written to no Story file, so the next build presents it again as fresh. No Story is ever born from fewer than two Articles or fewer than two Outlets (ADR-0015, ADR-0027).
_Avoid_: Orphan (use unassigned), rejected article, floating article

**Section**:
The part of the news a Story belongs to: Politique, International, Économie, Société, Sport, Culture, Sciences/Tech, Faits divers. A Story's Section comes from the Sections of its Articles. Shown as a label, never a filter.
_Avoid_: Category, rubric, topic

**Edition**:
A rolling window over all Stories — frozen ones included — re-ranked at every build. « Aujourd'hui » (the home) is the last 24 hours, uncapped (ADR-0022); « 7 jours » (`/7-jours/`) is the last 7 days, floored to Stories covered by at least 10 Outlets in the window; both rank by Coverage counted inside the window. « En direct » (`/en-direct/`) is the exception: the last 8 hours by founding instant, ranked latest-first (ADR-0029). A Story stays on la Une while Outlets keep reporting it inside the window, then sinks and disappears — by decay, never by a clock (ADR-0027). Summaries are rationed to the top-ranked Stories, never visibility (ADR-0022).
_Avoid_: Issue, digest, daily, run

**En direct**:
The latest-first Edition window: every Story whose founding Article falls within the last 8 hours, newest first, uncapped — the page-shaped answer to "what's new since I was here" for a reader returning several times a day (ADR-0029). Replaces the per-reader « Nouveau » marker (ADR-0020).
_Avoid_: Live feed, newsfeed, breaking news

**Story day**:
The one Publication day (Europe/Paris) a Story belongs to — the day of its founding Article, fixed when the Story is created. It keys the Story's URL, its archive page and the Episode age window; which Articles may join is governed by the Ingestion window, not by the day (ADR-0026, ADR-0027).
_Avoid_: Story date, day of the story

**Ingestion window**:
The period, from a Story's founding, during which the Story still accepts Articles: `[founding, max(founding + 24h, newest + 12h)]` in instant arithmetic, where the founding instant is the earliest `publishedAt` among its Articles and the newest its latest (ADR-0027). Every Story gets at least one full day; while coverage continues, each new Article extends the Story by 12 hours — a silence longer than that closes it, permanently.
_Avoid_: Grace period, closing time, 06:00 rule

**Summaries budget**:
The at-most-20 top-ranked Stories per build that gain a Summaries call — and only when a Story grew at least 25 % since its last pass, or has never been summarized (ADR-0022, ADR-0027; derived from the Gemini free tier's daily quota). A Story outside the budget, or below the growth gate, keeps its existing summary as-is.
_Avoid_: Edition size, story cap

**Archive**:
A dated page (`/archives/<date>/`) rendered at build time from the permanent Story files of that day — the day's record, not a snapshot of the Edition.
_Avoid_: Snapshot, backup

**Trending Story**:
A Story in the Edition that the returning reader is shown as « En hausse » because the Summaries pass re-synthesized it after that reader last saw it — the recorded fact (`summarizedAt`), not a count approximation; however long the absence (ADR-0029 as amended by ADR-0031). Uncapped, on every page that runs the signal; a Story the reader has never seen never trends.
_Avoid_: Rising story, hot story, viral

### Reading a story

**Prism**:
A Story seen through every Leaning at once: its Coverage, its Articles grouped by Coverage group, its Summaries and its Differences.
_Avoid_: Analysis, breakdown

**Coverage group**:
The three-camp grouping of Leanings that Coverage, Blindspots and Summaries work in: Centre gauche counts with Gauche and Centre droit with Droite. The granular Leaning is what the UI shows per Outlet; the group is what the counters and tabs speak in.
_Avoid_: Bucket, camp, bloc

**Coverage**:
How a Story's reporting is distributed across Coverage groups and Outlets: the number of Outlets reporting the Story (each with at least one Article — news, live or Opinion, ADR-0011), counted per Coverage group.
_Avoid_: Distribution, reach, share

**Reach**:
The raw monthly audience figure recorded for an Outlet in its config, with its source and date. A sourced fact, not a judgement: monthly web visits for every Outlet, ACPM-certified where the Outlet is certified, otherwise a flagged estimate (Semrush via Hypestat). The unit is declared so the comparability rule stays checkable.
_Avoid_: Audience (alone), traffic, popularity

**Exposition**:
A Story's Reach-weighted share per Coverage group: each reporting Outlet weighs the square root of its Reach, and a group's Exposition is its sum over the Story's total. A second reading of the same coverage bar, chosen by the reader; never a replacement for Coverage, which stays the default. Computed only when every reporting Outlet has a Reach.
_Avoid_: Weighted coverage, audience share, influence

**Blindspot**:
A Coverage group with no Outlet at all on a Story that the two other groups both report — not even an editorial (ADR-0011). The Story everyone covers except them. Shown as a badge; one badge per absent group.
_Avoid_: Gap, missing coverage

**Summary**:
A short, bullet-point account of a Story as told by the Outlets of one Coverage group.
_Avoid_: Digest, recap, abstract

**Differences**:
A comparison of how the Leanings treat a Story: exactly one treatment bullet per covered Leaning — its media's angle, vocabulary, emphasis, and what it leaves out — read side by side.
_Avoid_: Contrast, comparison, diff
