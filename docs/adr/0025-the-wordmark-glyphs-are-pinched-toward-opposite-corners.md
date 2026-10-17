# The wordmark glyphs are pinched toward opposite corners

The Fraunces wordmark (ADR-less recipe in `docs/research/logo/recette-finale.md`) read as a well-set serif with a too-subtle fan — the brand had no ownable gesture. We add a per-glyph cubic "pinch" warp to every letter of the wordmark and to the P mark: each glyph is stretched toward its top-left and bottom-right corners while its centre stays put, as if the wordmark were grabbed by those two corners and pulled apart. The displacement is horizontal only, a function of the glyph's anti-diagonal coordinate `t = u + v − 1` (−1 at the glyph's top-left, +1 at its bottom-right): `dx = cap · (t · (1 − sharp) + sharp · t³)`, applied after the existing affine transform of each glyph in `web/scripts/generate-brand-svg.py` (`cap = 400`; `sharp = 2.0`, softened to `1.0` for the nav wordmark — see Consequences). The effect was chosen over five prototype families for having more personality than any affine transform (which merely reads as italics) while staying legible at every size the UI uses.

## Considered options

- **Affine diagonal shear / stretch** (global): corners move linearly — renders as a mechanical italic slant, no "grabbed" feel. Rejected.
- **Global cubic pinch across the whole wordmark**: strong effect, but the word's centre goes slack and, with any vertical component, the baseline tilts. Rejected for nav-sized rendering; kept as prototype only.
- **Per-letter linear pinch**: organic but too subtle at brand-carrying sizes. Rejected.
- **Per-letter cubic pinch (chosen)**: corners stretch, centre holds, baseline stays flat; the repetition per letter reads as texture rather than accident.

## Consequences

- The warped outlines look like a rendering bug to an untrained eye. They are deliberate: never "fix" a pinched glyph, never hand-edit a generated SVG — the single source is `web/scripts/generate-brand-svg.py` (regenerate, don't patch).
- Glyph bounds must be measured **after** the warp: measuring before it clips the pulled corners out of the viewBox (this shipped as a bug and was fixed in the same branch).
- At navbar size (16px) a strong cubic (`sharp = 2.0`) bends the vertical stems into an S that reads as a scaling artefact; the nav wordmark therefore uses `sharp = 1.0` — straight stems, preserved corner stretch. Display and the P mark keep `2.0`.
- The pinched P is wider than the straight one, and a favicon fits its square: the favicon padding in `favicon.ts` was reduced from 0.18 to 0.10 to keep the glyph's apparent size.
- The pre-existing 8° per-letter fan is unchanged and composes with the pinch; both live in the one generator script.