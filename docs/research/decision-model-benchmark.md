# Decision-model benchmark (issue #4)

Sample: 110 hand-labeled headline+teaser pairs, sampled 2026-10-06T20:37:28.330Z (seed 4), stratified across Outlets with rare kinds oversampled. Labeled blind — no model output touched the answer key; two borderline pairs (#57, #60) adjudicated by hand.

State sent to the models: headline + teaser only, one request carrying two `choice` questions (kind, section) — the same input and shape the pipeline will use in production.

Prompt v3: criteria and instructions in French, with explicit French triggers for not_news (horoscope, jeux/quiz, météo, recette, programme TV, bons plans, sommaires d'émissions…). Round 1 used terse English criteria; its numbers are recorded at the end.

Winner rule: `not_news` precision first (a false not_news silently drops a real Article), then kind accuracy, then section accuracy; cost and latency only as tie-breaks.

## Results

| Model | Kind acc | not_news P | not_news R | Section acc | Invalid | Avg latency | p95 latency | Input tokens | Cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Jev | 83.6% | 88.9% | 47.1% | 84.9% | 0.0% | 284 ms | 393 ms | 112766 | $0.0047 |
| Clef-flash | 84.5% | 91.7% | 64.7% | 81.7% | 0.0% | 356 ms | 745 ms | 91425 | $0.0082 |

## Jev — kind confusion matrix

Rows = hand label, columns = model prediction.

| | news | opinion | live | not_news |
| --- | --- | --- | --- | --- |
| **news** | 79 | 0 | 0 | 0 |
| **opinion** | 8 | 2 | 0 | 1 |
| **live** | 0 | 0 | 3 | 0 |
| **not_news** | 9 | 0 | 0 | 8 |

## Clef-flash — kind confusion matrix

Rows = hand label, columns = model prediction.

| | news | opinion | live | not_news |
| --- | --- | --- | --- | --- |
| **news** | 71 | 7 | 0 | 1 |
| **opinion** | 3 | 8 | 0 | 0 |
| **live** | 0 | 0 | 3 | 0 |
| **not_news** | 4 | 1 | 1 | 11 |

## Decision

Winner on not_news precision: **Clef-flash** (91.7% vs 88.9%). Production nevertheless switched to **Jev** (issue #17): prompt v3 leaves Clef-flash with 7/85 news misread as opinion — the misclassification that empties a Story's article count and Coverage — while Jev has zero. Kind accuracy and section accuracy are within a point; the not_news precision cost is 3 points.

## Reproduce

```sh
pnpm benchmark:export   # refresh the sample (seeded)
pnpm benchmark:grade    # needs OPENROUTER_API_KEY in env (or direct JEV_API_KEY / CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)
```

Keys live in the local env or GitHub Actions secrets only — never in the repo.
