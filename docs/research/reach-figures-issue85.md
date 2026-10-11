# Research: Reach figures for 5 outlets (issue #85, exposure indicator)

Researched: 2026-10-12 (UTC). All figures are **estimated monthly web visits** from Semrush unless noted; none of the 5 outlets has an ACPM certification. Method: direct fetch of the Semrush "website overview" public power pages (verified verbatim from the source pages), hypestat.com as fallback aggregator where Semrush pages 404, ACPM Classement Unifié Sites Web Grand Public (September 2026) checked for certified figures.

## Summary table (ready for `outlets.ts`)

| Outlet | reach | unit | source name + URL | asOf | estimated |
| --- | --- | --- | --- | --- | --- |
| TF1 Info (tf1info.fr) | 11 960 000 | visits/month | Semrush — https://www.semrush.com/website/tf1info.fr/overview/ | 2026-08 | yes |
| Mediapart (mediapart.fr) | 5 500 000 | visits/month | Semrush — https://www.semrush.com/website/mediapart.fr/overview/ | 2026-08 | yes |
| Slate.fr | 6 026 098 | visits/month | Hypestat (mirrors Semrush) — https://hypestat.com/info/slate.fr | ~2026-03 (stale, see note) | yes |
| Atlantico.fr | 374 450 | visits/month | Semrush — https://www.semrush.com/website/atlantico.fr/overview/ | 2026-08 | yes |
| Causeur.fr | 315 089 | visits/month | Hypestat (mirrors Semrush) — https://hypestat.com/info/causeur.fr | ~2025-09 (stale, see note) | yes |

Notes on unit consistency: the five figures are Semrush "Total Visits" for the calendar month — comparable among themselves. Causeur's self-declared figure (below) is **unique visitors/month**, a different metric — do not mix into the same series.

## Per-outlet notes

### 1. TF1 Info (tf1info.fr)
- **Confirmed**: Semrush shows **11.96M visits for August 2026** exactly as expected (3-month series: Jul 12.94M, **Aug 11.96M**, Sep 9.71M; page "Last updated: October 11, 2026"; September marked −18.79% vs August). So the 11.96M figure is **August 2026**, not September.
- **No certified ACPM figure**: `tf1info.fr`, `tf1`, `lci` do not appear anywhere in the ACPM Classement Unifié Sites Web Grand Public September 2026 (235 certified supports; full stored page text searched). No other ACPM certification found via search.
- Caveat: September 2026 dropped to 9.71M (post-summer dip visible across French news sites); if you want the most recent month instead of the comparable month, use 9.71M / 2026-09.
- Recommend `asOf: 2026-08, estimated: true, source: "Semrush"`.

### 2. Mediapart (mediapart.fr)
- **Confirmed**: Semrush shows **5.5M visits for August 2026** as expected (Jul 6.21M, **Aug 5.5M**, Jun 5.75M; page "Last updated: September 17, 2026" — September not yet published on the page). The expected figure was correct including the month.
- **No certified ACPM figure**: absent from the ACPM Sept 2026 Classement Unifié (checked).
- Recommend `asOf: 2026-08, estimated: true, source: "Semrush"`.

### 3. Slate.fr
- No Semrush public page exists (`semrush.com/website/slate.fr/overview/` → HTTP 404, both www and fr locales). Similarweb.com is bot-blocked (AWS WAF challenge) — could not read a live Similarweb figure.
- Best available: **Hypestat** (aggregator displaying Semrush + Similarweb panels): **Monthly Visits (SEMrush) 6,026,098**; Monthly Visits (SimilarWeb) 4,198,722. **Staleness warning**: the Hypestat page states "Last Updated 213 days ago" ≈ mid-March 2026, and its 3-month chart (Dec 3.2M / Jan 2M / Feb 4.3M) confirms the snapshot is ~February–March 2026. Treat as a rough order of magnitude (several million visits/month), materially staler than the other rows.
- Sanity note (researcher inference): the Semrush panel (6.0M) and Similarweb panel (4.2M) on the same page disagree by ~40%, typical for small/mid sites with heavy social/direct traffic; either order supports "Slate ≈ a few million monthly visits".
- Flag `estimated: true` and, ideally, mark the stale asOf in the source string.

### 4. Atlantico.fr
- **Re-confirmed**: Semrush shows **374.45K visits for August 2026** (Jul 380.48K, Jun 290.82K; page "Last updated: September 17, 2026"). Consistent with the previously recorded ~360K — within normal month-to-month variance of the same estimator; no structural change.
- Recommend `asOf: 2026-08, estimated: true, source: "Semrush"`.

### 5. Causeur.fr
- No live Semrush public page (404). Best retrievable Semrush-based figure: **Hypestat: Monthly Visits (SEMrush) 315,089** (Monthly Unique Visitors (SEMrush) 125,348; Monthly Visits (SimilarWeb) 1,111,045). **Staleness warning**: Hypestat states "Last Updated 401 days ago" ≈ September 2025.
- Self-reported (not third-party): Causeur's own Kit média 2026 PDF (https://www.causeur.fr/wp-content/uploads/2026/04/Site_CAUSEUR-Kit-media-2026.pdf, "Source: Google Analytics – résultats moyens – 2025") claims **300K+ unique visitors/month** and ~1.5M pageviews/month (18M+ pageviews in 2025). Different metric (uniques, not visits) and self-declared — context only, not for the `reach` field.
- **Discrepancy with expected ~242K**: could not re-confirm. The only retrievable Semrush-derived number is the cached 315,089 (older snapshot); the live Semrush value may well be ~242K but is unverifiable without a Semrush login. Record either with `estimated: true` and a stale-data caveat, or keep 242K with source "Semrush (previous run)" — I recommend flagging this row as low-confidence.

## Cross-check against the certified ACPM figures already recorded (context only, not re-researched)
The ACPM Classement Unifié Sites Web Grand Public now online is the **September 2026** edition, one month after the recorded August figures, and the overlaps move consistently (e.g. franceinfo.fr 117.7M, bfmtv.com 108.9M, lemonde.fr 102.4M, 20minutes.fr 92.2M, leparisien.fr 52.1M — all vs your recorded Aug values), which is normal month-to-month variation. No action needed on the recorded rows. The relevant takeaway for issue #85: TF1 Info and Mediapart are **not** ACPM-certified in the unified GP ranking, so Semrush estimates are the only available monthly-visit figures for them, and Semrush systematically undercounts vs ACPM-certified measurement — TF1 Info (11.96M estimated) sits far below comparably sized certified sites.

## Contradictions
- Causeur: expected ~242K (Semrush, recent) vs cached Semrush-derived 315,089 (hypestat, ~Sept 2025). Unresolved — live Semrush inaccessible. (Causeur's own 300K+ uniques/month claim sits between the two.)
- Slate: Semrush-derived 6.03M vs Similarweb-derived 4.2M on the same hypestat page (estimator disagreement, not a factual contradiction).

## Missing evidence
- Live (current-month) Semrush/Similarweb figures for slate.fr and causeur.fr — both lack Semrush public pages; Similarweb is WAF-blocked. A Semrush or Similarweb paid account would resolve both, plus a current Causeur figure.
- ACPM certification for tf1info.fr: confirmed absent from the Sept 2026 unified GP ranking; TF1 group might certify other supports (apps, TV) not relevant to tf1info.fr web visits.

## Sources
Kept:
- Semrush overview pages for tf1info.fr, mediapart.fr, atlantico.fr (URLs in table) — primary source of each headline figure, fetched verbatim 2026-10-12.
- ACPM, Classement Unifié Sites Web Grand Public Septembre 2026 (https://www.acpm.fr/classements/united-web-sites-gp) — authoritative negative check (TF1 Info / Mediapart / LCI not certified).
- Hypestat for slate.fr and causeur.fr (URLs in table) — only retrievable Semrush/Similarweb mirror for those domains; staleness disclosed.
- Causeur Kit média 2026 PDF (URL above) — self-reported audience, context only.

Rejected/deprioritized:
- hypestat.com compare pages (causeur vs huffingtonpost etc.) — same underlying numbers, no added date precision.
- Similarweb.com pages — AWS WAF blocked, no readable data.
- view.robothumb.com, verifsites.com, OJIM infographic — no dated visit figures, low quality.
- slate.com (US Slate) Similarweb page — different site, irrelevant.
