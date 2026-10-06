# AI reads only RSS headlines and teasers, and outlet text is never published or stored

Several Outlets (Le Figaro, franceinfo, Ouest-France…) formally opt out of text and data mining (`tdmrep.json`, EU DSM Directive art. 4), and most block AI crawlers. French press neighbouring rights also cover the display of article snippets. So the AI reads only the headline and teaser each Outlet publishes in its own RSS feed. It never reads article pages or full bodies included in a feed. The site publishes headlines, links and Prisme's own Summaries and Differences, never Outlet text.

The same input for every Outlet also keeps Differences fair. If some Leanings were summarised from full articles and others from headlines, the comparison would be skewed.

Builds are incremental. Each build updates Summaries from the previous Summary plus new headlines and teasers, so teasers are never stored anywhere.

## Consequences

- Summaries are short and depend on how much each teaser says, by design.
- Paywalled and free Articles are treated the same.
- Summaries can't be regenerated from scratch later (e.g. after a prompt change), because the original teasers are gone.
- Don't "improve" Summaries by scraping article pages or by storing feed content without revisiting this decision.
