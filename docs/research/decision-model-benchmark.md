# Decision-model benchmark (issue #4)

Sample: 110 hand-labeled headline+teaser pairs, sampled 2026-10-06T20:37:28.330Z (seed 4), stratified across Outlets with rare kinds oversampled. Labeled blind — no model output touched the answer key; two borderline pairs (#57, #60) adjudicated by hand.

State sent to the models: headline + teaser only, one request carrying two `choice` questions (kind, section) — the same input and shape the pipeline will use in production.

Prompt v2: criteria and instructions in French, with explicit French triggers for not_news (horoscope, jeux/quiz, météo, recette, programme TV, bons plans, sommaires d'émissions…). Round 1 used terse English criteria; its numbers are recorded at the end.

Winner rule: `not_news` precision first (a false not_news silently drops a real Article), then kind accuracy, then section accuracy; cost and latency only as tie-breaks.

## Results

| Model | Kind acc | not_news P | not_news R | Section acc | Invalid | Avg latency | p95 latency | Input tokens | Cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Jev | 82.7% | 72.7% | 47.1% | 84.9% | 0.0% | 439 ms | 515 ms | 100006 | $0.0042 |
| Clef-flash | 84.5% | 80.0% | 70.6% | 81.7% | 0.0% | 462 ms | 752 ms | 79435 | $0.0071 |

## Jev — kind confusion matrix

Rows = hand label, columns = model prediction.

| | news | opinion | live | not_news |
| --- | --- | --- | --- | --- |
| **news** | 74 | 3 | 0 | 2 |
| **opinion** | 4 | 6 | 0 | 1 |
| **live** | 0 | 0 | 3 | 0 |
| **not_news** | 8 | 0 | 1 | 8 |

## Clef-flash — kind confusion matrix

Rows = hand label, columns = model prediction.

| | news | opinion | live | not_news |
| --- | --- | --- | --- | --- |
| **news** | 71 | 6 | 0 | 2 |
| **opinion** | 3 | 7 | 0 | 1 |
| **live** | 0 | 0 | 3 | 0 |
| **not_news** | 3 | 1 | 1 | 12 |

## Decision

Winner: **Clef-flash** — not_news precision 80.0%, kind accuracy 84.5%, section accuracy 81.7%.

## Reproduce

```sh
pnpm benchmark:export   # refresh the sample (seeded)
pnpm benchmark:grade    # needs OPENROUTER_API_KEY in env (or direct JEV_API_KEY / CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)
```

Keys live in the local env or GitHub Actions secrets only — never in the repo.
## Round 1 (English criteria) — history

Same sample and grading, prompt v1 (terse English criteria, English instructions):

| Model | Kind acc | not_news P | not_news R | Section acc | Avg latency | Cost |
| --- | --- | --- | --- | --- | --- | --- |
| Jev | 80.0% | 71.4% | 29.4% | 87.1% | 412 ms | $0.0036 |
| Clef-flash | 76.4% | 100.0% | 17.6% | 78.5% | 477 ms | $0.0063 |

The French v2 criteria lifted not_news recall from 17.6%→70.6% (Clef-flash) and
29.4%→47.1% (Jev), and kind accuracy for both, at a small precision cost for
Clef-flash (100%→80%).
