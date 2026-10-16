# AI subscriptions to unlock the pipeline quota

Research requested 2026-11-05: replace the two free-tier APIs the pipeline depends on
with **one monthly subscription (~€20 target)** that includes official API access, works
headless in GitHub Actions from France, and unlocks better models with more quota.
Tiebreakers only: access to the Jev model in the same subscription, and an agentic
mobile app for personal use.

Method: five parallel web researchers (Google, OpenAI, Anthropic, landscape sweep,
Jev/OpenRouter), each grounded in official pricing/docs pages, followed by an evidence
audit of the decision-critical claims. Quotes below marked **verified** were re-checked
against the official page by the auditor.

## The current bottleneck

- **Grouping + Summaries** run on the **Gemini API free tier**
  (`gemini-3.5-flash-lite`, `generativelanguage.googleapis.com`). Free-tier per-minute
  and per-day caps are what limit how many stories get summarized (the 45 s 429 wait in
  `pipeline/src/gemini.ts` exists because of this).
- **Decision + Membership** run on **Jev** (`typesafe/jev-1.13`) through OpenRouter's
  System One/Decisions gateway on an `OPENROUTER_API_KEY` free account that hits its
  quota.
- Volume shape: many small calls (classification + membership per new article), one
  grouping call per build, one summary per covered Leaning per changed Story
  (~20–40 per build). Token totals are not archived (ADR-0003), so volume was
  measured 2026-11-05 by running the real prompt builders against the archive:
  ~320 new articles/day (1,118 over 3.5 days), grouping prompt 15–19k chars/call
  (≈ 4.5–5k tokens), summary prompt 2.7–3.2k chars/call (≈ 0.8k tokens), ~220–320
  summary calls/day, 24 grouping calls/day → ≈ 9–13M input and 2.8–4.2M output
  tokens per month for Gemini, ≈ 6–9M input tokens/month for Jev.

## The three picks

### 1. Poe Premium — $19.99/mo (≈ €18.5; $199.99/yr ≈ $16.67/mo)

The only plan found that literally is *one subscription = API + chat app*.

- 660,000 compute points/month (tiers $4.99 → $249.99). Paid models draw on
  subscription points. **Verified** on the official API doc: "All Poe subscribers can
  use their existing subscription points with the API."
- Official **OpenAI-compatible API** at `api.poe.com/v1`, keys at `poe.com/api/keys`,
  explicitly documented for **external applications**, 500 req/min/user — a drop-in
  fit for direct HTTPS calls from CI.
- 200+ models behind one key: GPT-5.5, Claude Opus 4.7, Gemini 3.5 Flash, etc. — a
  strictly better model menu than today's free flash-lite + Jev split.
- Bonus: mobile app with the same bots for personal use; subscriptions available in
  France.
- **Risks**: quota is points-denominated — per-model point prices vary, so cost per
  build must be checked per model; allowances can be cut without notice (Premium was
  cut from 1M to 660k points in July 2026 at unchanged price); a third-party gateway
  is a dependency for model availability.
- Sources: [poe.com/subscription_plans](https://poe.com/subscription_plans),
  [external-application guide](https://creator.poe.com/docs/external-applications/external-application-guide),
  [OpenAI-compatible API](https://creator.poe.com/docs/external-applications/openai-compatible-api),
  [Poe subscriptions FAQ (FR)](https://help.poe.com/hc/en-us/articles/19945140063636-Poe-Subscriptions-FAQs).

### 2. Google AI Pro — €21.99/mo (France)

The smallest code change and the best personal-use bundle, but a hybrid: the
subscription does **not** raise API rate limits.

- **Verified**: Google's official doc says plan dev benefits are "AI Studio UI only" —
  "Direct use of the Gemini API (such as using API keys or external applications) is
  billed and managed separately." Subscriptions do not change API usage tiers.
- **Verified**: since January 2026, AI Pro includes **$10/month of Google Cloud
  credits usable "towards Gemini API"** (and Vertex AI) on your own GCP project
  ([blog.google, Jan 2026](https://blog.google/innovation-and-ai/technology/developers-tools/gdp-premium-ai-pro-ultra/)).
  AI Ultra includes $100/mo (one variant shows $40) — over budget.
- Linking billing also moves the project to Gemini API **Tier 1**: higher production
  rate limits, no minimum spend, and content not used for training. Pinned
  `gemini-3.5-flash-lite` paid price: $0.30/M input, $2.50/M output → at the measured
  volume the Gemini bill is **≈ $10–15/month** (output-dominated), so the $10/mo
  credit covers ~70–90% of a typical month and the net cash overage is small.
- **Pipeline fit**: the pipeline already speaks this exact API. Switching the
  free-tier key for a billing-attached project key upgrades Grouping + Summaries with
  zero client-code changes; the free-tier 429 path becomes mostly dead weight.
- **Bonus**: AI Pro in France includes **Veo** video generation and the Gemini mobile
  app with agentic features (Deep Research, Tasks) — the strongest personal-use bundle
  of the three.
- **Caveats**: USD-denominated credit; whether it applies cleanly to a France/EUR
  billing account was not verified; activating credits needs a GCP project with Cloud
  Billing (prepay balance > $0). Free-tier numbers are dashboard-only now (Google no
  longer publishes per-model RPM/RPD tables; third-party snapshots put flash-lite
  around 15–30 RPM / ~1,000 RPD — medium confidence).
- Sources: [ai.google.dev google-ai-plans](https://ai.google.dev/gemini-api/docs/google-ai-plans),
  [pricing](https://ai.google.dev/gemini-api/docs/pricing),
  [rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits),
  [gemini.google FR subscriptions](https://gemini.google/fr/subscriptions/?hl=fr).

### 3. Mistral Le Chat Pro (Vibe Pro) — $14.99/mo (≈ €14, EUR selector)

Cheapest of the three, French vendor, includes API credits.

- Le Chat Pro includes **~$25.5–30/mo of API credits** (captures disagree between
  $30 and $25.5 — re-verify at checkout) on La Plateforme API keys: Mistral Medium
  3.5, Large 3, Small 4, Ministral 3, Codestral, Devstral 2, hosted Z.ai GLM 5.3.
  Headless-friendly HTTP API.
- Bonus: Le Chat mobile app; French company, EUR pricing, EU data residency.
- **Caveats**: the free "Experiment" API tier trains on your data by default — a
  non-starter for press content (headline/teaser inputs); use the paid credits.
  Smaller model menu; before pointing the Decision model at a Mistral model, re-run
  the decision-model benchmark — Jev won prompt v3 and no substitute is proven.
- Sources: [mistral.ai/pricing](https://mistral.ai/pricing/),
  [usage limits](https://docs.mistral.ai/admin/billing-usage/usage-limits).

## Examined and excluded

| Plan | Price | Why excluded |
| --- | --- | --- |
| OpenAI ChatGPT Go / Plus | €8 / €22 | **Verified**: API usage is "billed separately from your ChatGPT subscription" — two bills, no included credits; CI is the API-key path. |
| Anthropic Claude Pro | $20 | No API credits. CI *is* officially supported via `claude setup-token` (OAuth, one-year token, runs billed to the subscription) but the quota is Claude-Code-agent-shaped — wrong for tens of tiny structured calls per hour. |
| Anthropic Claude Max 5x | $100 | **Verified** $100/mo API credits included — 5× over budget. |
| xAI X Subscription Premium | $30 | **Audit flag**: official docs say the weekly pool covers "eligible first-party usage… across supported Grok and Cursor surfaces" — API access in the pool appears only in third-party (Warp) docs. Not a verified fit. |
| Perplexity Pro | $20 | "No complimentary API credits"; API is prepaid PAYG. |
| GitHub Copilot Pro/Pro+ | $10/$39 | Credits consumed by Copilot features, not a general API; GitHub Models (free inference API) retired 2026-07-30. |
| Cursor Pro | ~$20 | No general API; AUP restricts automated access. |
| Z.ai GLM coding plan | from $18 | "Strictly limited to officially supported tools" — a custom pipeline is out of scope. |
| Cerebras Code Pro | $50 | Coding-shaped (24M tokens/day), poor fit for classification/summaries. |
| Krater Ultra | $49 | EU aggregator with shared app+API credits, but over budget and a ×2 multiplier burns credits fast. |
| Google AI Plus / Ultra | €4.99 / €99+ | Plus carries no dev credits; Ultra over budget. |

## The JEV verdict

**No subscription anywhere bundles Jev** (checked across all five briefs; absence
verified against official sources, medium confidence). Jev is TypeSafe's "System One"
decision model — API-only, no chat product, no mobile app. Its own plans are one-time
credit packs ($9.9 / 100k credits, no expiry; $99 / 1M; $999 / 11M), and OpenRouter
has no subscription at all — Standard is prepaid credits with a 5.5% purchase fee.

But Jev barely needs money: at $0.042 per 1M input tokens (output free) and the
measured volume (~6–9M input tokens/month), the Decision + Membership bill is
**≈ $0.25–0.40/month** — a one-time **$10 OpenRouter top-up** covers well over a
year, and buying ≥ $10 lifetime lifts the free tier from 50 to **1,000
requests/day** permanently, which is what actually fixes the quota exhaustion.
So the Decision/Membership
quota problem is solved by a $10 one-off, not a subscription; any of the three picks
above can coexist with it.

## Monthly cost at measured volume (2026-11-05)

Volume measured by running the real prompt builders against the archive
(~320 articles/day; see "The current bottleneck"). Prices: pinned
`gemini-3.5-flash-lite` $0.30/M in, $2.50/M out; Jev $0.042/M in, output free.
Assumptions: French prose ≈ 3.75 chars/token, teaser ≈ 200 chars when present,
summary calls/day ≈ article joins with some same-build coalescing, live stories
per build 20–40.

| Bill | Monthly cost |
| --- | --- |
| Gemini — Grouping + Summaries, **cap=20 today** (only Edition Stories summarized) | ≈ $9–13 (grouping ≈ 185–215k tok/day at a 40–50-story live pool; summary calls ≈ 150–220/day plus re-entry catch-ups) |
| Gemini — **cap removed** (every changed live Story summarized each build) | ≈ $12–16 (summary calls ≈ 280–360/day; grouping ≈ 200–275k tok/day at 45–60 live Stories) |
| Same volume at 3.1-flash-lite pricing ($0.25/$1.50) | ≈ $7–11 — requires re-pinning the model, benchmark-first |
| Jev — Decision + Membership via OpenRouter | ≈ $0.25–0.40 (+ one-time $10 top-up) |
| **Prepaid-only path** (Tier 1, no subscription) | **≈ $11–18/month** |
| **Google AI Pro path** | €21.99 + ≈ $0–6 Gemini overage + ≈ $0.4 OpenRouter ≈ **€26–32/month**, incl. Veo + mobile app + $10/mo credits drawn first |

Removing `EDITION_SIZE = 20` (ranking.ts, ADR-0009) adds ≈ **$2–4/month**: the bill
is article-driven, not edition-size-driven — with the cap, articles are summarized
deferred (catch-up batches on re-entry, same tokens); without it, immediately. The
real additions are summaries for the ~14% of Stories that never rank in today
(4.8% of article volume) and a slightly larger live pool in the Grouping prompt
(~300 tokens per live Story per build).

The $5 prepay minimum buys ~10–14 days at measured volume — enough to measure, not
a month. Spikes from free-tier exhaustion (giant catch-up builds) disappear on the
paid tier. Latency has no published SLA on standard tiers; provisioned throughput is
Enterprise-only.

## Recommendation

- **Google AI Pro (€21.99)** is the recommended pick: the pipeline already speaks the
  Gemini API, the $10/mo credits plus Tier-1 paid limits attack exactly the binding
  constraint, the client code keeps working unchanged, and the personal bonus (Veo in
  France, agentic Gemini mobile app) is the strongest of the three. Keep Jev on
  OpenRouter behind the one-time $10 top-up.
- **Poe Premium ($19.99)** if "one bill, one endpoint, every model" matters most —
  accept points-denominated unpredictability and verify per-model point costs first.
- **Mistral Le Chat Pro (~€14)** if budget leads and a French vendor appeals — verify
  the credit amount at checkout and benchmark a Mistral model against the decision
  benchmark before any switch.

Before switching anything in the pipeline: confirm the chosen plan's credit terms at
checkout (EUR billing), run one manual build against the paid key to measure real
tokens per build, and re-grade the decision benchmark if a new Decision model is
considered (`pnpm benchmark:grade` needs consent — it is a paid command).

## Prepay trial mechanics (Gemini API billing)

Verified on [ai.google.dev/gemini-api/docs/billing](https://ai.google.dev/gemini-api/docs/billing) (2026-10-15):

- **$5 is the minimum**: upgrading means linking a billing account and prepaying "a
  minimum of $5 (or equivalent in other currencies)"; minimum credit purchase is $5,
  maximum $5,000. Linking billing alone grants **Tier 1** (no spend history needed;
  $250/mo billing-account cap; $10 spend rate per 10 min).
- **Return path is official**: "Can I revert back to Free Tier after I've upgraded to
  higher (paid) tiers? — To downgrade to the Free Tier, you can disable billing on
  each of your projects." Unlinking a project from its billing account returns it to
  the free tier.
- **What paid buys**: higher rate limits for production, advanced models, Batch API
  (50% cost reduction), context caching — and **content not used to improve Google
  products** (the free tier trains on your content — relevant for press inputs). No
  latency SLA on standard paid tiers; provisioned throughput is Enterprise-only.
- **Gotchas**: credits expire after 12 months and are non-refundable; when the Prepay
  balance hits $0, **all keys on that billing account stop with HTTP 402** and the
  projects do *not* auto-fall-back to free tier; failed 4xx/5xx requests are not
  billed for tokens but still count against quota; the $300 Cloud welcome credit
  cannot pay for the Gemini API.
- **Interaction with AI Pro credits**: "Prepay users must first purchase Prepaid
  credits before any eligible Google Cloud credits can be applied to Gemini API
  usage… Google Cloud credits that are eligible for the Gemini API are consumed
  before your Prepay credit balance." So the AI Pro $10/mo credit draws first once
  the account is set up — the $5 prepay is step one of the AI Pro plan, not a detour.
- **Reversible trial setup**: upgrade a *new* project + API key, keep the existing
  free-tier key untouched — AI Studio explicitly supports switching between paid and
  free projects via their respective keys, so rollback is an env-var flip.

## Evidence-audit notes

- Verified verbatim against official pages: Poe points-via-API; Google $10/mo credits
  naming the Gemini API; Google "AI Studio UI only" wording; OpenAI "two separate
  bills"; Anthropic Max credit table ($100/$200 on 5x/20x, none on Pro).
- Unclear: xAI Premium pool covering API access (official pages name only Grok/Cursor
  surfaces).
- Self-flagged by researchers, re-verify before relying on them: Mistral credit
  amount ($25.5 vs $30 across captures); Poe allowance cut (1M → 660k points,
  July 2026); exact free-tier Gemini RPM/RPD (dashboard-only).

## Consolidated sources

- Poe: poe.com/subscription_plans · creator.poe.com/docs/external-applications/* · help.poe.com (FR FAQ) · usagepricing.com/blueprint/poe
- Google: ai.google.dev/gemini-api/docs/{google-ai-plans,pricing,rate-limits,billing} · blog.google (Jan 2026 GDP credits) · developers.google.com/program/plans-and-pricing · gemini.google/fr/subscriptions · 01net.com (Veo in France)
- OpenAI: help.openai.com/en/articles/{6950777,9039756} · learn.chatgpt.com/docs/pricing · openai.com/policies/row-terms-of-use · Numerama/01net (FR prices)
- Anthropic: claude.com/pricing · support.claude.com/en/articles/11647753 · code.claude.com/docs/en/{authentication,github-actions} · anthropic.com/legal/consumer-terms
- Sweep: docs.x.ai/x-subscription/pricing · x.ai/news/x-subscription · docs.warp.dev (Grok subscription) · mistral.ai/pricing · docs.mistral.ai · perplexity.ai help center · docs.github.com (Copilot billing, GitHub Models retirement) · cursor.com AUP · docs.z.ai/devpack · support.cerebras.net · krater.ai
- Jev/OpenRouter: jevmodel.net · jevmodel.org · openrouter.ai/{pricing,docs/faq,typesafe} · openrouter.ai/docs/guides/community/typesafe-sdk
