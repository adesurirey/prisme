# Opinion pieces count toward Coverage and the ranking

Date: 2026-10-09 · Amends ADR-0009 · Spec: issue #54

## Context

ADR-0009 keyed the Edition ranking on Coverage defined as distinct **reporting** Outlets, with Opinion pieces excluded: only `news` and `live` Articles counted. The rationale was that Coverage answers *"who investigates this story?"* — an editorial is an Outlet reacting to a story, not covering it, so letting it count would inflate perceived coverage and could erase a Blindspot badge on the strength of a single column.

That rationale answers a different question than the product's mission. Prisme exists to show how media shape the way their audience sees events (issue #52-era framing: the reader's lens, not the newsroom's). For a reader who consumes a single outlet, an editorial may be the **only** piece they ever see on a story — it frames the event, picks the culprits, and forms opinion as much as, sometimes more than, a straight report. Under the old rule, a group whose readers were being actively fed a framing through editorials could still wear the "tout le monde en parle sauf eux" badge. The badge accused the group of silence while its editors were speaking — loudly — to their audience.

Scale check on the day's edition (746 Stories): 62 Opinion articles across 58 Stories. Counting them changes group counts on 57 Stories (+60 group-outlet additions) and removes exactly one Blindspot badge. The visible change is small; the doctrine underneath is not.

## Decision

Opinion pieces count toward Coverage. `isReporting()` in the domain accepts `news`, `live` **and** `opinion`; `not_news` and unclassified Articles still never count. Because Coverage counts, Blindspot badges, the Edition ranking key and the Summaries' "covering Leanings" all derive from that one predicate, they adopt the doctrine together — the rule changes in exactly one place.

Consequences chosen deliberately:

- **Blindspots go fully symmetric.** An editorial weighs the same as a report. A badge now means *"not even an editorial"* — rarer, and much stronger. The asymmetric alternative (an editorial may erase a badge but never create Coverage) was considered and rejected: it is harder to explain in the UI, and symmetry makes the classification-error story strictly better (below).
- **The secondary article count includes Opinion pieces** (`countedArticles` counts every Article) — the displayed footprint matches the doctrine.
- **Story images stay decoupled.** `pickStoryImage` still draws only from news/live Articles and computes its Coverage tiers from those Articles alone; an editorial never supplies or shifts the visual.
- **Summaries change emergently, not structurally.** All-Opinion Stories now have a covering Leaning and become summarizable. The prompt's guardrail is unchanged: *"les tribunes éclairent le positionnement de leur camp mais restent des prises de position, pas des faits établis"* — an editorial informs a camp's summary but is never laundered into an established fact. `promptVersion` stays.
- **The UI keeps saying "Non couvert par …"** — "couvert" naturally spans the editorial case.

## Accepted trade-off: classification error

The benchmark (`docs/research/decision-model-benchmark.md`) shows the Decision model confuses news and opinion on roughly 10% of labeled pairs. Tying Coverage to that classification makes misclassifications visible. With full symmetry, the failure mode is benign in the damaging direction: a report misread as an opinion piece can only make its group look *more* covered — it can erase a badge falsely but can never create a false accusation of silence, which is the error the badge must never make. We accept this and will revisit (asymmetry or re-grading) only if a visible badge failure appears in production.

## Considered Options

- Keep ADR-0009's exclusion (status quo): rejected — it answers "who investigates?" when the product's question is "what do these readers see?".
- Count Opinion toward Coverage but rank on news-only Coverage: rejected — two Coverage notions invite drift; the mission statement covers the ranking too.
- Asymmetric Blindspots (editorial erases but never creates): rejected — complexity in the UI story, and the symmetric rule already makes classification errors fail safe.

## Consequences

- Stories covered solely through editorials can now enter the Edition and earn per-Leaning Summaries.
- Existing Story files and slugs are untouched (ADR-0005); the change surfaces on the next `pnpm edition` run through Coverage-derived displays and future rankings.
- GLOSSARY.md entries for Opinion piece, Kind, Coverage and Blindspot were updated to match.
