# The Membership check matches facts, not topics

Date: 2026-10-14 · Amends ADR-0005 (the Membership check's question and inputs), ADR-0013 (the grouping prompt) · Glossary: `Story`

## Context

The 2026-10-14 edition shows the failure mode this change fixes. Five
Stories exceed 25 Articles; the lycéen-mobilization Story alone holds 92
Articles across 23 Outlets, mixing four distinct sub-facts — policing and
its judicial follow-up (18 Articles), the political stakes (16), street
damage (12), the announced 17 October march (8) — that a hand analysis
would split into Stories of 8–38 Articles each. Two follow-up facts are
plainly mistreated: the American-intelligence thread of the Kyiv strikes
(9 Articles, 6 Outlets) appears in none of the Story's 11 summary bullets,
and neither does the IMF warning (7 Outlets). The per-Leaning summaries
(ADR-0006) can only carry 3–4 bullets per group; inside a mega-Story those
bullets catch whatever surfaced last, not the sub-facts a reader needs.
And the Blindspot badge (ADR-0010) can never fire inside a mega-Story:
every camp covered the umbrella, so no camp ever looks silent — the
strongest difference-of-treatment signal the product has stays dark.

Two mechanisms produce this. The Membership check's question explicitly
accepts a topical match — « le même événement **ou le même sujet** » — and
judges from the Story title alone (« juge uniquement à partir du titre de
la story »): a topically named Story is a gravity well that every
on-topic Article joins. The Grouping model sees each live Story as title
plus Section only (`GroupingInputStory`), so it cannot tell a distinct
sub-fact from the Story it is being offered, and matches everything
on-topic into it.

A retrospective cure — a splitter pass re-clustering oversized Stories
from their full Article list — was analysed and deferred: it works, but it
re-writes live Story files and must amend membership stickiness and
frozen-file permanence (ADR-0005), a bigger change with its own failure
modes. Prevention comes first.

## Decision

The granularity line moves from topic to fact on both sides of grouping —
prompt and inputs together, one coherent change. No pipeline structure
changes: no new phase, no new model, no ranking change.

1. **The Membership question matches facts.** Verbatim (`MEMBERSHIP_QUESTION`):

   > Cet article rapporte-t-il le même fait que cette story, ou un
   > développement direct de ce fait ? Juge à partir du titre de la story,
   > des titres d'articles déjà joints à cette story, et du titre et chapô
   > de l'article fournis.
   >
   > **Oui** : même fait — l'article rapporte le fait même de la story, ou
   > un développement direct de ce fait (suites d'enquête, nouveaux bilans,
   > décisions ou réactions qui le concernent directement).
   >
   > **Non** : autre fait — même s'il relève du même thème général (même
   > mouvement, même dossier, mêmes acteurs), un article qui rapporte un
   > autre fait ne rejoint pas la story.

   The « ou le même sujet » acceptance — the door the 92 walked through —
   is gone, and the « ni fait ni thème » mis-proposal falls into the no
   criterion instead of forcing the model outside the binary.

2. **The check sees the Story's members.** `MembershipGate.ask` forwards
   up to five member headlines, picked by token overlap with the candidate
   Article's headline — the same content tokens as the seed guard, Jaccard
   score, recency as tie-break, original order as final tie-break. The
   selection is local and deterministic: no model call, no extra check;
   the checker still decides. Recency alone would blind the check to
   sub-facts whose Articles are older than the Story's newest five.
   For a proposed new Story the anchor stays the seed Article (the
   proposed title may be generic) and the digest is the key's
   already-claimed members; member headlines identical to the anchor are
   dropped.

3. **The Grouping model sees what Stories already say.** Each open Story
   in the prompt carries its three most recent member headlines after the
   title, and two instructions are added to the prompt (verbatim):

   > Les derniers articles déjà joints à chaque story existante te sont
   > donnés : ils disent ce que la story raconte déjà. Un article qui
   > rapporte un fait distinct de ces titres ne fusionne pas dans la
   > story, même s'il relève du même thème : s'il a un jumeau dans le lot
   > (même fait), regroupe-les sous un « newStoryKey » ; s'il est seul,
   > laisse-le sans entrée — il sera représenté au prochain build.
   >
   > Au sein d'un même événement d'envergure, des faits distincts (volet
   > judiciaire, volet politique, journée à venir) donnent des stories
   > distinctes ; ne les fond jamais dans la story-mère au seul motif
   > qu'ils touchent au même sujet.

   A distinct-fact Article with a twin in the batch is grouped under a
   `newStoryKey` (the ADR-0015 two-Article minimum does the rest); an
   alone one stays unassigned and re-presents next build (ADR-0015
   retry-ability).

4. Nothing else changes. No splitter pass, no EDITION_SIZE or ranking
   change, no wipe of the current archive — the daily cycle (ADR-0017)
   already re-opens granularity on fresh days, and the current
   mega-Stories freeze at 06:00 the next day and remain as published POC
   artifacts. The seed guard inherits the reformulated question unchanged
   (it already routes through the same Membership check).

## Considered Options

- Prompt-only hardening, no input change: rejected — the checker cannot
  distinguish sub-facts it is not shown; its current question even forbids
  judging beyond the title.
- A retrospective splitter pass over Stories above a size threshold (an
  hourly phase re-clustering oversized Stories from their full member
  list): deferred, not rejected — the right cure if prevention
  under-delivers; requires an explicit ADR-0005 amendment (membership may
  change once, while live, by the splitter) and its own failure policy.
  Parent Story keeps id and slug, children get fresh ids; live Stories
  only, frozen files untouched.
- Weighted ranking keys (coverage × freshness × …): rejected — ADR-0009's
  doctrine stands; granularity reaches the Edition through Stories, not
  through a blended score.
- Wipe and rebuild the current archive under the new prompt: rejected —
  paid (the consent rule), and unnecessary: tomorrow's Stories are born
  under the new prompt anyway.

## Consequences

- Topical mega-Stories stop growing. A distinct sub-fact joins a Story
  only if it is that Story's fact or a direct development of it.
  Expected shape: sub-fact Stories of roughly 8–20 Articles instead of one
  90-Article Story; more Stories carry their own Coverage into the
  Edition (a hand replay of the 2026-10-14 build with the split applied
  put two children in the top-20 at 11 Outlets each and pushed two
  7-Outlet tail Stories out — the cut stays coverage-ruled, ADR-0009).
- The Story unit is sharpened in the Glossary: a Story holds a fact,
  never a theme; the operative test is that two reasonable readers agree
  the Articles report the same news.
- Orphan churn rises. Stricter refusals leave distinct-fact Articles
  unassigned until a sibling arrives — retry-able, bounded by the 24h
  window (ADR-0015); the build log already counts them.
- The check payload grows by about five headline lines (~100 tokens) per
  check — negligible against the pair-ledger bound (ADR-0012). The
  grouping prompt grows by about three headlines per open Story; the
  call count per build is unchanged, and the free tier's headroom is
  verified by the replay (recorded in docs/research/grouping-benchmark.md).
- Validation. The grouping replay compares a same-fixture baseline with
  the changed prompt: over-merged pairs down ≥ 25% per fixture, split
  rate ≤ 1.5× baseline, coverage ≥ baseline − 2 pts, dup-seeds 0,
  stability ≥ baseline. The Membership question has no benchmark — its
  verdict comes from the next real day (the spot-check convention of
  issue #5) and from the observation gate.
- Observation gate at J+1: re-formation of a >40-Article Story on a busy
  day; orphan rate; sub-fact Stories making the Edition; summary quality
  on newly born Stories; top-20 churn at the 7-Outlet line. Mega-Story
  re-forms → the splitter pass (option 2, its own ADR). Fragmentation
  (orphan or singleton surge) → loosen the question. Mixed → iterate the
  wording.
