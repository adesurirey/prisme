# Exposition is a second, Reach-weighted reading of the coverage bar

Date: 2026-10-12 · Spec: issue #86 · Tickets: #87, #88, #89

## Context

The coverage bar answers *"how many médias report this Story, from which camp?"* — distinct Outlets per Coverage group. But two groups at numerical parity can represent very different realities of influence: a national daily with tens of millions of monthly visits weighs differently than an opinion site with a few hundred thousand. The bar as built cannot say that difference.

The research docs already hold the raw material: sourced reach figures per Outlet (`docs/research/outlet-leanings.md` for the ACPM-certified rows, `docs/research/reach-figures-issue85.md` for five Semrush/Hypestat estimates). The Glossary already defines **Reach** and **Exposition**.

A prototype (`prototype/exposure-lens`, d78db46) validated the visual direction — a pill toggle in the navbar flipping the widths of the existing tri-color bar, ~300 ms ease-out. Its code was never merged; this ADR records the decision the production implementation (issues #87/#88/#89) encodes.

## Decision

Exposition is a **second reading of the same coverage bar**, chosen by the reader — never a replacement, never a separate indicator element. Concretely:

- **One element, two width scales.** The bar keeps its tri-color segments; only `flex-grow` changes. Couverture (default): distinct Outlets per group. Exposition: each distinct reporting Outlet weighs the square root of its Reach (`EXPOSURE_COMPRESSION_EXPONENT = 0.5` in the domain), and a group's Exposition is its sum over the Story's total. Both scales ship in the markup (custom properties `--cov`/`--exp` per segment); a site-wide mode on `<html data-mode>` lets pure CSS pick the scale — the toggle writes one attribute and every bar on the site switches at once.
- **The sqrt compression is the first cut, not the verdict.** It bounds the gap a single mega-Outlet (LdP: 95.5 M) can open against a small one (Causeur: 315 k → √ ratio ≈ 17 instead of 300). Raw and log remain candidates; the exponent is a named constant so the comparison — to be graded against real Stories — changes one line and the ADR.
- **Certified-vs-estimate heterogeneity is accepted, and honest about it.** Every Reach figure is monthly web visits (GLOSSARY Reach): ACPM-certified where the Outlet is certified, a Semrush/Hypestat estimate (flagged `estimated: true`) otherwise. Where an Outlet's best-known signal was print circulation or podcast downloads, the config records the web-visits estimate instead — never the other metric (Causeur's self-declared unique-visitor count stays out of the series). Mixing certified and estimated figures in one weighting scheme is imprecise; the alternative is excluding those Outlets from Exposition entirely, which would understate exactly the camps whose media lack certification. The compression bounds the error a single off figure can introduce. Every figure carries `source`, `asOf` and `estimated` in the config; this ADR is where the imprecision is acknowledged.
- **The public Outlet shape carries the Reach.** `data/outlets.json` (identity + feeds until now) gains `reach` so the site build computes the shares itself; no pipeline, archive or Story-file change — Exposition is computed from data the build already has.
- **The meta line loses the « x % » and all tooltips.** The percentage was a share-of-config that invited confusion with the new shares; the tooltips never worked on mobile. The line keeps « x articles » — a count, never silently re-weighted. The bar's static aria-label keeps describing Couverture, the default meaning.
- **The toggle is a radio group** (`role="radiogroup"` + `aria-checked`, arrow-key navigation, ≥ 28 px touch targets, copied from shadcn.io's "Navbar Segmented Control" block — a solid muted track (`--toggle-track`) at rounded-md with a white card that slides under the checked label (surface fill, soft shadow, no border); the checked label turns primary, the unchecked one muted; the Leaning colors stay reserved for the Coverage groups), placed at the right of the sticky navbar on every page. Clicking anywhere on it — track or label, checked or not — flips the reading, the rapid back-and-forth gesture when comparing Stories; the keyboard keeps the radio steps. The choice persists in `localStorage` (`prisme:mode`, absent = Couverture) and is applied before first paint. An `aria-live` region announces the switch — and, on Story pages (exactly one bar), that Story's Exposition shares. Under `prefers-reduced-motion` the width animation is off.

## Considered Options

- **A separate Exposition bar next to the Coverage bar** (the prototype's first iteration): rejected — two bars double the visual noise on every card and imply both readings are always active; the toggle keeps one element with one visible meaning at a time.
- **Exposure replaces Coverage as the default**: rejected — Reach figures mix units and estimates; Coverage counts are exact. The weighted reading is a lens, not the ground truth.
- **Normalising Reach to a single unit** (converting circulation to estimated visits): rejected — invented conversions would manufacture precision the sources don't have.
- **Raw or log compression now**: deferred — sqrt first; the comparison runs on real Stories once this ships (out of scope for #86's initial build).

## Consequences

- Every configured Outlet must carry a `reach` figure (enforced by domain tests): no missing-weight code path exists, per the POC rule.
- The Exposition reading is only as good as the figures: estimate staleness (Slate, Causeur) and the certified-vs-estimated mix are visible in the config, not smoothed over.
- The bar-width animation is pure CSS driven by `flex-grow`; no hydration, no per-card script, and the Story page header and index cards can never disagree.
- Removing the « x % » changes the meta line's information content on every card; the coverage share of the config remains available in the bar's aria-label.