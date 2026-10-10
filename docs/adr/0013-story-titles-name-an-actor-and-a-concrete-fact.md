# Story titles name an actor and a concrete fact, not a noun phrase

Story titles used to come out flat: the grouping prompt only asked for a
"neutral title describing the event", which the model read as license for
agentless noun phrases — *Condamnation de…*, *Attribution du prix Nobel…*,
*Annonce d'accords…* — or for verbatim outlet headline formats (leading
quote, `« citation » : …`, `À la une:`). A dry run over the 27 multi-article
Stories of one Edition showed ~15 of 27 titles in that nominal style, and,
worse, titles that ignored what the group's member headlines established
(a Story of 7 articles about a Trump–Putin diesel agreement titled from the
first article alone). A dry rewrite applying a concrete style produced
clearly better titles for most of them.

The fix is in the grouping prompt (`pipeline/src/gemini.ts`):

- **Style**: a named actor, an action verb, a concrete complement (number,
  place, stake). 40–110 characters. Never an agentless noun phrase.
- **Banned**: a title starting with a quotation; the outlet
  `« citation » : …` format; prefixes like `À la une`.
- **Neutrality is about stance, not form.** No rhetorical or judgment
  words — but informative and concrete is expected.
- **`titleUpdates` is systematic**, not optional: every existing Story that
  gains Articles gets a title pass framed from *all* member headlines,
  keeping the most precise and most recent fact the group establishes —
  not just the first Article's headline.
- **Proper nouns must survive** (people, places, acronyms): `seedCandidates`
  in `pipeline/src/grouping.ts` matches new-Story seeds against
  `tokens(story.title)`, so a title that drops entity tokens weakens the
  duplicate-detection candidate selection.

## Consequences

- Titles are mutable while a Story is live; slugs are frozen once assigned
  (ADR-0005), so retitling never breaks Story URLs.
- Titles for single-Article Stories follow the same rules when they gain
  Articles later; a fresh single-Article Story starts from the model's
  title, not the raw headline.
- The rules are prompt-only: there is no style linter in CI yet. A
  regression is visible in `data:` commits, not caught by tests. Adding a
  title sample to the grouping benchmark is the follow-up if drift appears.