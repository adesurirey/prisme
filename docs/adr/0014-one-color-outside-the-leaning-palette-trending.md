# One color outside the Leaning palette: trending emerald

The design tokens reserve color for what it means — the three Coverage groups (rouge, or, bleu). The per-visitor "En hausse" badge (issue-less design session) needed to catch the eye, which monochrome ink did not do well enough and a flash green did garishly. We add exactly one color outside the Leaning palette, emerald (`--trending`: #059669 light, #34d399 dark), and give it a single meaning: the Trending Story badge on the Edition index. Emerald carries the badge's own semantic — growth, the "stock-chart rise" — and sits far from all three Leaning hues; violet and sarcelle were the runners-up, flash green and outlined/filled chips were rejected in preview rounds as too loud.

## Consequences

- A fourth color now exists in the chrome. Any future use of `--trending` must stay on-message (it means "this is climbing", nothing else); if a second meaning ever wants the slot, that's a new ADR, not a reuse.
- The badge is the only consumer: Coverage bars, Leaning dots and Blindspot badges keep their three-hue discipline.
- The color adapts per theme like the Leaning tokens do (darker on the light canvas, vivid on the dark one).
