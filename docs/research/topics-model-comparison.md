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
| D | TOPIC_QUESTION | whole thread vs whole birth | 45/7 | 17 | `.benchmark/topics/Clef-flash-2026-10-17T10-14.txt` |

Run D is Clef-flash (`cloudflare/clef-flash`) through the same OpenRouter
gateway — the model-comparison candidate at the pinned benchmark prices:
$0.09/MTok input vs Jev's $0.042/MTok, i.e. ~2× **more** expensive per input
token on this route (a cheaper Clef-flash route would be Cloudflare-direct,
which needs its own keys). The lexical proposal is unchanged, so the same 52
links are judged.

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

## Run D vs run C (2026-10-17): 6 divergences on 52 links

Clef-flash is the more permissive judge. It fixed **every** false negative of
run C — « Trump juge honteuse la reprise des frappes » against the frappes
thread, « Le pape demande une trêve », « contribution française au budget »,
and « médicaments à l'unité » — and its 7 refusals are all correct (every
known-false link, plus taxi/lycéen kept separate). Two divergences count
against it: « Le RC Lens perd contre le Sporting » joined the LOSC–Arsenal
thread, forming a « Ligue champions » topic — exactly the recurring-format
merge ADR-0024 defers to the product phase (defensible if recurring-format
topics are wanted, wrong under the event-thread definition); « médicaments à
l'unité » joined the budget thread (borderline-true — it was voted during the
budget debates). Net: Clef-flash graded 50/52 on the hand baseline vs 49/52
for Jev — marginally more accurate, and its extra links are recurring-format
merges, a product decision, not a model decision. Cost runs the other way:
on the pinned prices Clef-flash costs ~2× more per input token on this
gateway, so the switch buys granularity, not savings.
## Appendix — Jev run C, verdict by verdict (the production baseline)

The durable memory of the graded run: 52 links in replay order, the episode
(first, abbreviated) against the birth. `YES` = the birth joined the thread,
`NO` = it founded its own prospective key.

| Verdict | Episode (thread) | Birth |
| --- | --- | --- |
| NO | Le LOSC s'incline lourdement face à Arsenal en Ligue des cha | Le RC Lens perd à domicile contre le Sporting en Ligue des c |
| NO | Le RC Lens perd à domicile contre le Sporting en Ligue des c | Deux navires touchés par des drones au large de la Bulgarie |
| YES | Un ancien membre de gang est condamné pour le meurtre de Tup | Duane Davis condamné pour le meurtre de Tupac Shakur |
| NO | Un policier est mis en examen après un tir de LBD à Tours | La mobilisation lycéenne entraîne des heurts et des dégradat |
| YES | L'Assemblée nationale rejette la motion de censure sur le bu | Le gouvernement défend le budget 2027 à l'Assemblée national |
| YES | Des frappes russes touchent une centrale électrique à Kiev | Une série de frappes russes touche des infrastructures énerg |
| YES | Des frappes et des interceptions de missiles visent l'Arabie | Des attaques de drones et de missiles touchent l'Arabie saou |
| YES | Le géant américain Nvidia entre au capital de la plateforme  | Nvidia investit dans plusieurs start-up françaises d'intelli |
| YES | Le pape Léon XIV subit une opération d'un cancer du poumon à | Le Vatican annonce que le pape Léon XIV a été opéré d'un can |
| YES | L'Assemblée nationale adopte à l'unanimité la loi contre les | L'Assemblée nationale adopte la proposition de loi contre le |
| YES | Un adolescent ouvre le feu dans un collège à Aubagne | Un adolescent ouvre le feu dans un collège à Aubagne et bles |
| YES | L'Ukraine dénonce la restriction nocturne du réseau Starlink | L'Ukraine dénonce des restrictions sur le réseau Starlink |
| NO | L'Assemblée nationale rejette la motion de censure sur le bu | L'Assemblée nationale valide la contribution française au bu |
| YES | L'Ukraine dénonce la restriction nocturne du réseau Starlink | Elon Musk et l'administration américaine répondent aux criti |
| NO | La mobilisation lycéenne entraîne des heurts et des dégradat | Les chauffeurs de taxi manifestent à Paris contre les VTC |
| YES | La mobilisation lycéenne entraîne des heurts et des dégradat | Les lycéens poursuivent leur mobilisation et rencontrent le  |
| NO | Un enseignant est abattu par balle dans une école au Mexique | Vingt-huit personnes tuées dans l'effondrement du toit d'une |
| YES | Le PSG affronte Manchester City en Ligue des champions | Le PSG s'impose face à Manchester City en Ligue des champion |
| YES | La mobilisation lycéenne entraîne des heurts et des dégradat | Des étudiants d'HEC bloquent l'école et rejoignent la mobili |
| YES | Un adolescent ouvre le feu dans un collège à Aubagne | Un nouvel adolescent interpellé après la fusillade dans un c |
| YES | L'Assemblée nationale rejette la motion de censure sur le bu | Les députés rejettent le plafonnement de l'abattement fiscal |
| YES | La mobilisation lycéenne entraîne des heurts et des dégradat | La préfecture de police de Paris interdit un trajet de manif |
| NO | Le PSG affronte Manchester City en Ligue des champions | L'Olympique lyonnais s'impose face à Crystal Palace en Ligue |
| NO | L'Olympique lyonnais s'impose face à Crystal Palace en Ligue | Le Stade Rennais s'impose face à l'OFI Crète en Ligue Europa |
| NO | Des frappes russes touchent une centrale électrique à Kiev | Donald Trump juge honteuse la reprise des frappes ukrainienn |
| YES | La mobilisation lycéenne entraîne des heurts et des dégradat | Le mouvement lycéen tente une convergence avec les Gilets ja |
| YES | Un tireur fait plusieurs victimes dans une école primaire de | Un adolescent tue quatre personnes dans une école de l'Orego |
| NO | L'Ukraine dénonce la restriction nocturne du réseau Starlink | Elon Musk dévoile le nouveau Tesla Roadster |
| NO | L'Assemblée nationale valide la contribution française au bu | Les députés votent la délivrance de médicaments à l'unité |
| YES | Un bus et un train entrent en collision au tunnel sous la Ma | Un accident entre un minibus et un train de fret fait 19 ble |
| YES | La mobilisation lycéenne entraîne des heurts et des dégradat | Arnaud Rousseau et la FNSEA s'abstiennent pour la mobilisati |
| YES | La mobilisation lycéenne entraîne des heurts et des dégradat | Le site des Républicains piraté avec un appel à manifester l |
| YES | Les chauffeurs de taxi manifestent à Paris contre les VTC | Sébastien Lecornu convoque une cellule de crise pour la mobi |
| YES | Katie Zacharia essuie des critiques pour ses débuts à la Mai | Katie Zacharia admet n'avoir jamais passé l'examen du barrea |
| YES | Donald Trump juge honteuse la reprise des frappes ukrainienn | Volodymyr Zelensky réclame 70 milliards d'euros de plus à l' |
| YES | Un adolescent ouvre le feu dans un collège à Aubagne | Un deuxième adolescent est mis en examen après la fusillade  |
| YES | La mobilisation lycéenne entraîne des heurts et des dégradat | La préfecture de police de Paris interdit de manifester dans |
| YES | Le pape Léon XIV subit une opération d'un cancer du poumon à | Le Vatican publie de premières photos du pape Léon XIV en co |
| YES | L'Assemblée nationale rejette la motion de censure sur le bu | Les députés rejettent en commission le projet de budget de l |
| YES | La mobilisation lycéenne entraîne des heurts et des dégradat | Un sondage révèle qu'une large majorité des Français approuv |
| YES | Le juge Youssef Badr est ciblé par des attaques de presse | Une enquête ouverte à Paris pour cyberharcèlement après des  |
| YES | L'Assemblée nationale rejette la motion de censure sur le bu | L'Assemblée rejette la taxe Zucman sur les ultra-riches lors |
| NO | Donald Trump juge honteuse la reprise des frappes ukrainienn | Le pape Léon XIV demande à Vladimir Poutine une trêve dans l |
| NO | L'Insee annonce que l'inflation a atteint 3,1% sur un an en  | Le Brésil annonce une baisse historique de la déforestation  |
| YES | La mobilisation lycéenne entraîne des heurts et des dégradat | Emmanuel Macron appelle au calme à la veille des manifestati |
| YES | La mobilisation lycéenne entraîne des heurts et des dégradat | Une journée de mobilisation nationale s'organise ce 17 octob |
| YES | Katie Zacharia essuie des critiques pour ses débuts à la Mai | Katie Zacharia quitte son poste de porte-parole après cinq j |
| YES | La mobilisation lycéenne entraîne des heurts et des dégradat | Des manifestations et rassemblements sont prévus en France |
| YES | Des frappes et des interceptions de missiles visent l'Arabie | Des missiles s'abattent près de l'aéroport d'Aden au Yémen |
| YES | Donald Trump juge honteuse la reprise des frappes ukrainienn | Volodymyr Zelensky réclame 70 milliards d'euros à Bruxelles |
| YES | Donald Trump juge honteuse la reprise des frappes ukrainienn | Donald Trump exempte la Russie de nouvelles sanctions du Con |
| YES | Un tireur fait plusieurs victimes dans une école primaire de | Un adolescent auteur d'une fusillade dans une école aux État |
