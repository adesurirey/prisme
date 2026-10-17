# Topics are proposed by headline overlap and confirmed by Membership

The Title pass (ADR-0023) already computes, for every new Story, the previous
**Episode**: the most headline-similar Story on disk (`episodeContext`, token
overlap ≥ 0.25). A backtest of that mechanism over the whole archive — 5 days,
160 Stories, 52 proposed links, graded by hand (`pipeline/src/episode-backtest.ts`,
free to re-run) — graded **28 true, 13 partial (same thread, distinct events),
11 false (21 %)**. The false links share one cause: generic vocabulary (sports
results, protest coverage, parliamentary votes, "école") with no distinctive
proper noun. Product-wise, Threads of episodes are worth persisting: a **Topic**
entity would let a reader follow one event day by day — but decided: build
Topics in `data/` only, no UI, and let real builds run for a few days before any
product decision. Considered and rejected: assigning Topics on lexical overlap
alone — a 21 % false rate compounding through inheritance would entangle threads
permanently; and a pure-LLM topic assignment with no lexical bound — it would
re-check the entire archive every build, cost with no benefit over a bounded
proposal.

## What a Topic is

A Topic is a thread of episodes: one event followed across days, not a theme
(theming is the Classification's Section) and not a recurring format (the
"PSG matches" question — whether recurring-format events merge into one Topic —
is deliberately deferred to the product phase). A Topic exists from two
Episodes, like a Story exists from two Articles (ADR-0015): a singleton story
is not a Topic, and most news never becomes one. Every Story still carries its
Topic key for life — the Episode it continues, or its own id as a
prospective key when it founds — because the key is what lets a second
Episode attach to the thread whenever it arrives, and an inert key on a
never-continued Story costs nothing. The Topic id is the founding Story's
id (immutable); the label is the founding Story's final title,
taken from its file at confirmation — a Frozen Story's title is final — and
alongside it the registry entry carries a **short display label**: two or
three words naming the thread without being an article title (« Mobilisation
lycéenne »), computed once at confirmation from the thread's own headlines —
the most distinctive repeated word pair, weighted by how often the thread
repeats it and by the word's rarity across the archive, keeping its source
order and accents (`pipeline/src/topic-label.ts`, deterministic, model-free);
`pipeline/src/topic-registry.ts` owns the merge and the slug minting —
registry state never travels through grouping.
If observed labels disappoint, the product phase may replace this with one
cheap model call per confirmed Topic; the registry fields would stay. The
registry entry also carries the topic's **public slug**, minted once at
confirmation from the label (`slugFor(label, …)` against the slugs the
registry already uses): its own namespace, never a Story slug, so a future
`sujets/<slug>` page cannot collide with a Story page. The internal key
(`topicId` = the founding Story's id) stays what it is — it must exist at
birth, before any label or slug does.
The registry is `data/topics.json` and lists only confirmed Topics; Story files
carry `topicId`. The registry is written once per Topic — later Episodes of
an already-listed Topic change nothing.

## How a Topic is assigned

The seed-guard pattern (ADR-0018): **the lexicon proposes, Membership disposes**.

The check has its own question (`TOPIC_QUESTION`, `pipeline/src/decision-model.ts`)
and its own payload (`topicPayload`): the **whole thread**, oldest first —
each episode bounded to its most birth-relevant headlines — against the
whole birth, final title and member headlines. Two lessons from the
real-scale replay of 2026-10-17 (52 Jev checks over the archive):
reusing the belongs question verbatim failed — its criteria deliberately
refuse “same theme, other fact” (ADR-0018 — a new fact is a new Story),
but a new fact of the same event is exactly what an Episode is, and the
Guerre Ukraine and Budget threads never formed; and judging a birth
against its lexically-matched episode only fragmented the threads — a
political reaction was judged against the strike story it matched, never
against the war it belongs to, so the subject scattered into micro-threads
that no build revisits. The criteria are frontal about what an episode
may be: a reaction, decision or announcement concerning the event, even
staging other actors than the last episode.

Topics resolve **before the Title pass**. The naive order — title first, then
resolve Topics — fed the Title pass an episode chosen by lexical match alone:
a birth whose match Membership refused still got “poursuit l'épisode X” and
its title could anchor on the wrong subject. With resolution first, the
pass's episode context is only fed a Jev-confirmed thread — and the confirmed
thread's display label goes with it (“poursuit le sujet « Mobilisation
lycéenne » — épisode « … »”), finer context than a lone episode title. The
untitled birth takes no part in the label pool or the same-subject payload:
its headlines carry the subject, and its founding key is its own id.

An age window bounds the proposal (`EPISODE_MAX_AGE_DAYS = 7`, shared with the
Title pass's episode context): a Story on disk more than 7 days older than the
birth's day is never proposed, and nothing from after the birth's day either.
The Title pass context claims to be the episode the reader already saw — an old
match is not that — and for Topics, inheriting from a stale Story is where a
weak lexical match compounds into a permanent wrong thread. Seven days is
generous against the 0–3 day range the backtest measured for true links, so
sagas that breathe keep their thread; the backtest revises the window as the
archive grows. An event resuming after the window founds a new Topic.

- A birth with an `episodeContext` match (overlap ≥ 0.25) is Membership-checked
  against that episode: "same subject?" Confirmed — the birth inherits the
  episode's Topic; refused — the birth founds a new Topic. Refusals cost one
  cheap check; confirmations inherit for free.
- A birth with no match founds a new Topic directly.
- Updates (Stories that gained Articles) keep their Topic unchanged.

A failed Membership check — HTTP, unparseable, or null — fails the build:
nothing is written (same posture as the seed guard, ADR-0005). No
retro-assignment: the 160 Stories already on disk carry no `topicId`; Topics
start accumulating from the first build after this decision. There is no
merge/split reconciliation in this phase — if two Topics turn out to be one
event, the observation period is meant to reveal it, and the fix is a wipe and
rebuild, not migration code (ADR-0002, POC).

## Consequences

- The archive gains an observation surface, not a product surface: Topics exist
  to be graded after a few days of builds, with the backtest script as the
  grading tool. Nothing in `web/` reads them yet.
- The lexical false rate (21 %) is contained at the gate: an inheritance now
  needs both a strong headline overlap and a Membership confirmation. The
  residual risk — a false confirmation that entangles two threads — is what the
  observation period measures.
- Every build spends at most one extra Membership check per birth with a match
  (bounded by the births of one build, typically a handful — noise against the
  ADR-0022 budget).
- Whether recurring-format events (sports, budget votes) belong in one Topic is
  a product question, not a pipeline question — left open on purpose.
- Topic assignment happens once per Story, at birth, before the file is written;
  Story slugs and titles are untouched by this decision.


