# Decision-model benchmark (issue #4)

Sample: 110 hand-labeled headline+teaser pairs, sampled 2026-10-06T20:37:28.330Z (seed 4), stratified across Outlets with rare kinds oversampled. Labeled blind — no model output touched the answer key; two borderline pairs (#57, #60) adjudicated by hand.

State sent to the models: headline + teaser only, one request carrying two `choice` questions (kind, section) — the same input and shape the pipeline will use in production.

Winner rule: `not_news` precision first (a false not_news silently drops a real Article), then kind accuracy, then section accuracy; cost and latency only as tie-breaks.

## Results

| Model | Kind acc | not_news P | not_news R | Section acc | Invalid | Avg latency | p95 latency | Input tokens | Cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Jev | 80.0% | 71.4% | 29.4% | 87.1% | 0.0% | 412 ms | 581 ms | 85816 | $0.0036 |
| Clef-flash | 76.4% | 100.0% | 17.6% | 78.5% | 0.0% | 477 ms | 767 ms | 69755 | $0.0063 |

## Jev — kind confusion matrix

Rows = hand label, columns = model prediction.

| | news | opinion | live | not_news |
| --- | --- | --- | --- | --- |
| **news** | 74 | 4 | 0 | 1 |
| **opinion** | 4 | 6 | 0 | 1 |
| **live** | 0 | 0 | 3 | 0 |
| **not_news** | 11 | 0 | 1 | 5 |

## Clef-flash — kind confusion matrix

Rows = hand label, columns = model prediction.

| | news | opinion | live | not_news |
| --- | --- | --- | --- | --- |
| **news** | 71 | 7 | 1 | 0 |
| **opinion** | 3 | 8 | 0 | 0 |
| **live** | 1 | 0 | 2 | 0 |
| **not_news** | 12 | 1 | 1 | 3 |

## Decision

Winner: **Clef-flash** — not_news precision 100.0%, kind accuracy 76.4%, section accuracy 78.5%.

## Reproduce

```sh
pnpm benchmark:export   # refresh the sample (seeded)
pnpm benchmark:grade    # needs OPENROUTER_API_KEY in env (or direct JEV_API_KEY / CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)
```

Keys live in the local env or GitHub Actions secrets only — never in the repo.
