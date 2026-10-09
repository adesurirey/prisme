# Leaning has five bands; Coverage and Summaries fold them into three groups

Issue #46: with FrIdéo's seven bands folded into three Leanings, 14 of the 24 Outlets landed in Centre — the Coverage view was one dominant centre cluster, and the nuance between a Le Monde and a Le Figaro was invisible. The Leaning is now five bands (Gauche, Centre gauche, Centre, Centre droit, Droite) — still per Outlet, set by hand and cited (ADR-0001), placed mechanically from the FrIdéo band where FrIdéo covers the Outlet. Coverage, Blindspots and Summaries keep working on three groups: centre gauche counts with gauche and centre droit with droite (option B). The fold lives in one exported function, `coverageGroup()` in `packages/domain/src/coverage.ts` — changing how Leanings regroup later means changing that one function and nothing else.

The Summaries model receives each Article's granular band, not the folded group, so it can account for a group's composition (Le Monde inside the "gauche" camp) and note within-group nuance — bucket bullets stay outlet-free (ADR-0006), named contrasts stay in Differences.

## Considered Options

- Five bands everywhere, including Coverage: rejected — three camps is the product's lens ("à gauche / au centre / à droite"), and five thin clusters would make Blindspots noisy.
- Keep three Leanings and add a display-only granular field: rejected — two fields for one hand-set truth invites drift; the granular band is the truth, the group is the derived projection.
- Fold `center-left`/`center-right` into centre (keeping three everywhere): rejected — it reproduces exactly the dominant-centre cluster issue #46 is about.
- Add `extrême-gauche`/`extrême-droite` bands (full FrIdéo fidelity): deferred — it changes nothing for Coverage (they fold into the same groups) and puts a contested "extrême" label on mainstream Outlets; adding two values later is cheap.

## Consequences

- The published repartition goes from 5/14/5 to roughly 9/8/7 once folded; the centre cluster stops dominating.
- "Centre" Coverage means pure-centre Outlets only: a Story covered by centre-gauche Outlets but no pure-centre Outlet can show a centre Blindspot. That sharpness is accepted — "personne du centre n'en parle" is more precise, not less.
- `pickStoryImage`'s Centre preference and the front-page legend are unaffected; every colored element keeps the three group colors — a granular band's dot wears its Coverage group's color, the band lives in the label text only.
- Changing the grouping later (e.g. five display camps, or a different fold) is a one-function change plus labels; the Leaning bands themselves are not expected to change.