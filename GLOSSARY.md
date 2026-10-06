# Prisme

Prisme shows each day's front-page news from the major French outlets, and how each political leaning covers it. The UI is in French and code/domain names are in English.

## Language

### Outlets and leanings

**Outlet**:
A widely read French general-news publisher whose Front page and Articles Prisme reads (e.g. Le Monde, Le Figaro). Outlets are chosen for readership or editorial significance, never to balance Leanings.
_Avoid_: Source, newspaper, media, publisher

**Leaning**:
The political position assigned to an Outlet: Gauche (left), Centre or Droite (right). It belongs to the Outlet, never to an individual Article.
_Avoid_: Bias, prism, side, orientation

**Front page**:
The Articles an Outlet puts forward as "à la une" at a given moment. For some Outlets this is approximated by their most recent Articles.
_Avoid_: Homepage, headlines, top news

### Articles and stories

**Article**:
A single piece published by one Outlet. Prisme links to it on the Outlet's website.
_Avoid_: Post, item, link

**Opinion piece**:
An Article that argues a position (editorial, column, op-ed) rather than reporting news. It informs Summaries but does not count toward Coverage.
_Avoid_: Editorial, tribune (as a generic term)

**Kind**:
The classification of an Article: news, opinion, live or not_news. The Decision model assigns it from the headline and teaser. A not_news Article never reaches the Edition; an Opinion piece never counts toward Coverage.
_Avoid_: Type, category, tag

**Decision model**:
The cheap language model Prisme uses to assign each Article its Kind and Section.
_Avoid_: Classifier, judge, AI (alone)

**Story**:
A news event or topic, made up of the Articles that report on it. National and international news are both in scope. A Story's id and slug are fixed when it is created and never change.
_Avoid_: Topic, cluster, event, subject

**Story title**:
The neutral French name of a Story, written by the Grouping model. Distinct from any Outlet's headline, and can change over time.
_Avoid_: Story headline

**Live Story**:
A Story with at least one Article less than 24 hours old. Live Stories can gain Articles and make up the Edition.
_Avoid_: Active story, open story

**Frozen Story**:
A Story with no live Articles left. It has left the Edition; its page stays published and is never modified again.
_Avoid_: Archived story, closed story, expired story

**Grouping model**:
The cheap language model Prisme uses each build to assign new Articles to live Stories or start new ones.
_Avoid_: Clustering, matcher, AI (alone)

**Membership check**:
A yes/no check that decides whether an Article the Grouping model matched with low confidence joins that Story.
_Avoid_: Verification, noul check

**Section**:
The part of the news a Story belongs to: Politique, International, Économie, Société, Sport, Culture, Sciences/Tech, Faits divers. A Story's Section comes from the Sections of its Articles. Shown as a label, never a filter.
_Avoid_: Category, rubric, topic

**Edition**:
The current selection of top Stories that Prisme publishes, updated throughout the day.
_Avoid_: Issue, digest, daily, run

### Reading a story

**Prism**:
A Story seen through every Leaning at once: its Coverage, its Articles grouped by Leaning, its Summaries and its Differences.
_Avoid_: Analysis, breakdown

**Coverage**:
How a Story's reporting is distributed across Leanings and Outlets: the number of Outlets reporting the Story (each with at least one reporting Article), counted per Leaning. Opinion pieces never count toward Coverage.
_Avoid_: Distribution, reach, share

**Blindspot**:
A Leaning with no reporting Outlet on a Story reported by three or more Outlets (reporting Outlets only, Opinion pieces excluded). Shown as a badge; one badge per absent Leaning.
_Avoid_: Gap, missing coverage

**Summary**:
A short, bullet-point account of a Story as told by the Outlets of one Leaning.
_Avoid_: Digest, recap, abstract

**Differences**:
A comparison of how the Leanings frame, emphasise or leave out parts of a Story.
_Avoid_: Contrast, comparison, diff
