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

The fix is in the grouping prompt (`pipeline/src/gemini.ts`) — moved to the
dedicated Title pass (`pipeline/src/title-pass.ts`) by ADR-0023, same rules:

- **Style**: a named actor, an action verb, a concrete complement (number,
  place, stake). 40–110 characters. Never an agentless noun phrase.
- **Banned**: a title starting with a quotation; the outlet
  `« citation » : …` format; prefixes like `À la une`.
- **Neutrality is about stance, not form.** No rhetorical or judgment
  words — but informative and concrete is expected.
- **`titleUpdates` follows the same style when it fires**, framed from all
  member headlines, not just the first Article's. It stays optional at
  first: the systematic pass was deferred — it adds output load to the
  single grouping call, and the two changes were split so a grouping
  regression can be attributed. Activating it later can catch up live
  Stories, since titles are mutable while a Story is live.
- **Proper nouns must survive** (people, places, acronyms): `seedCandidates`
  in `pipeline/src/grouping.ts` matches new-Story seeds against
  `tokens(story.title)`, so a title that drops entity tokens weakens the
  duplicate-detection candidate selection.
- **Amendment — qualification fidelity is symmetric** (after the
  `attentat`-escalation fix produced the opposite drift): the title's event
  qualification must come from the group's headlines in *both* directions.
  No word of qualification that no source headline uses (the original rule,
  against escalation), and no weakening of a qualification the sources
  share — « frappes meurtrières sur un aéroport » must not become
  « des frappes sur un aéroport ». The first fix was one-sided: it capped
  the title above the sources but said nothing about staying below them,
  and the model read the permission as an invitation to hedge, stripping
  the shared facts (figures, casualties, place precision) the headlines
  did establish. Structure still must not be copied from outlets — but
  factual vocabulary (names, places, figures, consequences) must come
  from the group's headlines, and what several headlines affirm must
  appear in the title. A neutral title is not a vague title.

**Amendment — no length limit (2026-10-17, after the Oregon-episode drift):**
the 40–110-character cap and the « when length allows » clause were read
by the model as permission to drop shared facts. A 3-headline group whose
headlines *all* asserted that the school-shooting suspect was a former
pupil of the school produced « Un adolescent auteur d'une fusillade dans
une école aux États-Unis » — 66 of the 110 allowed characters used, no
place (Oregon), no school level (primaire), none of the shared new fact
(ancien élève), no action verb. The whole length sentence is deleted
rather than replaced with a looser one — absent guidelines, the model
infers there is no limit — and the proper-noun rule folds into the
shared-facts clause as four words (« noms propres compris »), since the
seed guard matches title tokens. Downstream already
tolerates any length: slugs truncate at 64 characters (`slugify`), the UI
has no title clamp. The same amendment repartitions the title rules into
three bullets — fidelity, content, style — one job each; no rule text
changes, the dense single paragraph was split (and the duplicated
« citation » : … interdiction deduplicated).

## Consequences

- Titles are mutable while a Story is live; slugs are frozen once assigned
  (ADR-0005), so retitling never breaks Story URLs. Amended in ADR-0023:
  the retitle now happens in the dedicated Title pass, and only when a
  Story gained Articles — a frozen Story's title is immutable.
- Titles for single-Article Stories follow the same rules; a fresh
  single-Article Story starts from the model's title, not the raw headline.
  (Stale since ADR-0015 — no Story is ever born from one Article; every
  Story is titled at birth by the Title pass.)
- Watch the grouping behavior over the next Editions (false merges, duplicate
  Stories). If drift appears, suspect the added title load first; the remedy
  is a dedicated title pass in a separate call, then the systematic
  `titleUpdates` pass. **Done — ADR-0023**: the drift appeared (Oregon
  episode, 2026-10-17), and the dedicated pass is now the only writer of
  Story titles, with the previous Episode as context for continuing events.
- The rules are prompt-only: there is no style linter in CI yet. A
  regression is visible in `data:` commits, not caught by tests. Adding a
  title sample to the grouping benchmark is the follow-up if drift appears.
  Drift has now appeared in both directions (nominal escalation to
  « attentat », then post-fix dilution); if it recurs after the symmetric
  rule, the benchmark title sample is the next step, before any separate
  title pass.