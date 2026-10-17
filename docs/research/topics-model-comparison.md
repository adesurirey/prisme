# Comparing Membership models for Topics

The Topic mechanism (ADR-0024) is graded by replaying the archive through the
production resolution (`resolveTopics`) with a live Membership checker: one
archived Story per step, against everything already on disk. The tool is
`pnpm replay:topics` (`pipeline/src/topic-replay.ts`); raw transcripts land in
gitignored `.benchmark/topics/`. Three runs are recorded here, all Jev
(`typesafe/jev-1.13` via OpenRouter), differing only in the question and the
payload — the two knobs the replay experiment of 2026-10-17 turned:

| Run | Question | Payload | checks (yes/no) | Topics | Transcript |
| --- | --- | --- | --- | --- | --- |
| A | belongs (« même fait ? ») | episode vs seed headline | 26/26 | 15 | `.benchmark/topics/jev-belongs-question-episode-payload-2026-10-17.txt` |
| B | TOPIC_QUESTION (« même sujet ? ») | episode vs whole birth | 33/19 | 17 | `.benchmark/topics/jev-samesubject-question-episode-payload-2026-10-17.txt` |
| C — production | TOPIC_QUESTION | whole thread vs whole birth | 39/13 | 17 | `.benchmark/topics/Jev-2026-10-17T10-11.txt` |

## What each knob changed

- **The question (A → B)**: the belongs criteria deliberately refuse “same
  theme, other fact” (ADR-0018) — so the threads Topics exist for never
  formed: Guerre Ukraine and Budget stayed dead, a strike on Kyiv's power
  grid was refused by its own previous story. The dedicated same-subject
  question fixed the formations while every known-false link stayed refused.
- **The payload (B → C)**: judging a birth against only its lexically-matched
  episode fragmented threads — political reactions were judged against the
  strike story they matched, never against the war. With the whole thread in
  the payload, Budget went 2 → **5** épisodes (abattement, commission Sécu,
  taxe Zucman absorbed), Volodymyr Zelensky 2 → **4** (Zelensky Bruxelles,
  Trump sanctions), Mouvement lycéen 7 → **12** (FNSEA, Républicains piraté,
  sondage, Macron, journée du 17 octobre).

## The graded baseline (hand-checked against the archive)

Every no in run C is correct except two arguable false negatives —
« Donald Trump juge honteuse la reprise des frappes » against the frappes
thread (a reaction the criteria should admit; it was captured by the
Volodymyr Zelensky thread instead), and « L'Assemblée nationale valide la
contribution française au budget de l'UE », refused while the budget thread
was still two episodes long and confirmed later for equivalent votes. Every
known-false link (Lens/LOSC, drones Bulgarie, Peshawar/Mexique, OL/PSG,
Rennais/OL, Musk Roadster/Starlink, Brésil/Insee, Yémen — confirmed by the
user as true) is judged correctly in run C.

## Comparing a new model (e.g. Clef-flash)

1. Give the checker a `sameSubject(episodes, birth)` implementation (same
   `MembershipAnswer` contract, own question file if the model needs one).
2. Point `topic-replay.ts` at it (a one-line swap of `membershipModelFromEnv`).
3. Run `pnpm replay:topics`, save the transcript in `.benchmark/topics/`.
4. Compare against run C, three axes: checks yes/no ratio, the registry table
   (topics, labels, épisode counts), and the per-link verdicts on the arguable
   pairs listed above — they are the discriminating set.