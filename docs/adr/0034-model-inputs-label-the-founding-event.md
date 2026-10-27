# Model inputs label the founding event

Extends ADR-0018 (the member digest) and ADR-0023 (the Title pass);
companion to ADR-0033 (the 72 h ceiling). Decided 2026-10-27.

## Context

Every judgement a language model makes about a Story is made against a
*partial presentation* of her: the Grouping prompt shows the title plus
the 3 latest member headlines; the Membership check (merge, birth guard)
shows the title plus a 5-headline digest ranked by token overlap with
the candidate. On the 2026-10-27 Trappes Story (383 Articles over 4
days) both views drifted with the Story's latest sub-thread:

- Replayed against the real member set, the founding headline's token
  overlap with late candidates measured **0.000** — it never appeared in
  a digest, and the 3 latest headlines were all garde-à-vue coverage.
  The check judged « same fact as this story » against a Story presented
  *as her latest sub-thread*.
- The title itself had drifted through three retitles, each naming the
  then-latest development (enquête → garde à vue psychiatrique → garde
  à vue reprise) — feeding back into both prompts: a ratchet.
- The boundary was inconsistent across days: 17 hommage/rassemblement
  Articles merged into the attack Story on 10-25, while the same class
  of coverage birthed separately on 10-26 — same kind of fact, opposite
  treatment, decided by what the drifted digest happened to contain.

The mega-Story itself is ADR-0027's design and ADR-0033 bounds it; what
was broken here is the *reference frame* of the judgements inside the
window. Changing the yes/no criteria was considered and rejected: the
judgements follow the rule as written (« a suite du même fait »), and
retuning criteria on one event's evidence is the magic-number tuning
this repo has refused before (ADR-0030, against top-k caps).

## Decision

Every model input that presents a Story now labels her **founding
anchor** — the earliest member's headline and Paris day, derived on
demand like the founding instant (`foundingAnchor`, grouping.ts; nothing
stored):

- **Grouping prompt** (gemini.ts): `— fondateur (2026-10-23) : « … »`
  between the title and the latest headlines, plus one consigne: the
  founder says what the Story *is*, the latest headlines where she *is*.
- **Membership payloads** (decision-model.ts): `Événement fondateur
  (2026-10-23) : « … »` right under the Story line, in both the merge
  question and the ADR-0030 birth guard; both instruction sentences say
  to judge from it. The criteria text is untouched.
- **Title pass updates** (title-pass.ts): the same labeled line heads
  each update block — the founding event is explicit, not inferred from
  a headline pile that is mostly newer. The retitle rule (« le titre
  actuel nomme l'événement qui a fondé la story ») finally has its
  anchor in the payload.
- **Benchmark parity** (benchmark/grouping-fixtures.ts): fixtures send
  the anchor too — the replay exercises what production sends.

The recency and overlap views stay: they do jobs the anchor cannot
(the digest answers « does the Story already report this fact » for
same-fact re-reports; the latest headlines carry the distinct-sub-fact
test of the grouping prompt). The anchor is added, nothing is replaced.

## Consequences

- The reference frame of every merge/birth/retitle judgement stops
  moving: a multi-day Story presents her founding fact first, and the
  « aurait-il sa propre existence sans lui » test is answerable against
  the event, not the sub-thread.
- Expected effect, to be observed on the live builds: the
  hommage/rassemblement class stops merging into long-lived Stories
  (refusal ledger), and retitles of grown Stories stop naming the
  latest development. Same-fact re-reports keep merging; ADR-0030's
  chain duty is unchanged (a chain bunch is still « une suite directe »
  of the founding event).
- Payloads grow by one line per Story; checks, prompts and passes keep
  their shapes otherwise. No `data/` change, no wipe: rolls out live.
