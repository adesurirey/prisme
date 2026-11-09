# PROTOTYPE — throwaway, never merged (issue #173)

Three IA variants for « À la une », switchable via the floating pill at
the bottom of the screen:

- **A · Sélecteur** — one screen, segmented control switching
  Nouveau / Brûlant / Top (web parity, ADR-0028).
- **B · Onglets** — bottom tabs, one per sort.
- **C · Pager** — full-screen swipeable pages with synced tab labels.

Plus the Story page (shared by all variants): hero image, coverage bar,
chronologie (esquisse), Résumés per Coverage group, Différences, article
list grouped per group, articles opening in the in-app browser.

Data: a static snapshot of `data/edition.json` + `data/outlets.json`
(the artifact ADR-0043 will publish). Pull-to-refresh is simulated.
Tokens: hardcoded mirror of the decided `@prisme/tokens` mechanics.

## Run (one command, from the repo root)

```
pnpm proto:ia
```

then open the printed URL (or scan the QR) with **Expo Go** on your
phone. `--tunnel` is already on, so any network works.

The question this answers: which IA — and does the Story page read as
one scroll? The verdict lands in issue #173; the prototype stays on
this branch as the primary source.
