# Mobile app v1 — implementation spec

Decided 2026-11-10. Compiled from wayfinder map #168 (issues #169–#175);
every decision's detail lives in its ticket — this file sequences the build.
ADR-0043 (the static site is the app's API) governs the data contract.

## Foundation (settled — do not re-litigate)

- **Stack**: React Native + Expo, managed workflow, one codebase for iOS and
  Android; expo-router; EAS Build (`--local` as overflow). Expo-default
  platform floors, phone-first, French-only UI, dark mode follows the system.
- **Identity**: `mobile/` in this monorepo, package `@prisme/mobile`, bundle
  id `info.leprisme.app`, display name « Prisme ».
- **Sharing**: `@prisme/domain` and pure logic utils shared as-is; design
  tokens from one source (`@prisme/tokens`, #172); UI components re-implemented
  natively as **1:1 replicas of the web UI** — the web is the original
  prototype; one experience, not two (#173).
- **Complete list of accepted deviations from web parity** (#173, #175):
  1. sort navigation = bottom tabs + swipe between adjacent sorts;
  2. Différences always visible on the Story page (web tabs it away);
  3. the header (wordmark + mode toggle) scrolls, it is not sticky.
- **Data**: the app reads `https://leprisme.info/edition.json` and
  `/outlets.json` as published by the web build (ADR-0043); fetch on open +
  pull-to-refresh, ETag revalidation, disk-cache last good artifact; no
  analytics or crash reporting in v1.
- **Distribution target**: closed testing only (TestFlight + Play internal
  testing). Enrollment is deliberately deferred (#170) — nothing before
  distribution needs a paid account.
- **ADR-0028 amendment** (this spec is its record): the sort remains a
  setting of one page named « À la une »; on the app, that setting's control
  is the tab bar + swipe. The h1 « À la une » block stays on every sort
  screen, exactly as web's EditionHeader.

## Slices — sequenced, one ready-for-agent issue each

### 1. Publish the mobile artifact from the web build

In `edition.yml`, after `pnpm --filter @prisme/web build` and before the
`Upload site` step (path `web/dist`): copy `data/edition.json` and
`data/outlets.json` into `web/dist/`. The deployed HTML and the JSON the app
fetches then always come from the same commit. Extend the web build-output
tests (fixture build via `PRISME_DATA_DIR`) to assert both files land in the
output. Never publish `classifications.json`, `topics.json`,
`redirects.json`, or `data/stories/` (ADR-0043).

**Done when**: a CI run serves `leprisme.info/edition.json` and
`/outlets.json`, and the fixture test is green.

### 2. Scaffold `mobile/` (`@prisme/mobile`)

`create-expo-app` (default TypeScript template) into `mobile/`, stripped to
an empty expo-router shell: `app.json` with name « Prisme », bundle id
`info.leprisme.app`, `userInterfaceStyle: automatic`. Add `mobile` to
`pnpm-workspace.yaml` members so root `pnpm test`/`typecheck`/`lint` cover
it (biome already reaches it — proven on the prototype branch). Tests:
jest-expo + @testing-library/react-native, colocated (vitest cannot run RN).
`eas.json` with development/preview profiles; no store accounts needed at
this stage.

**Done when**: `pnpm typecheck` and `pnpm test` pass at the root with the
new package, and the shell boots in Expo Go.

### 3. `@prisme/tokens` — one source for Tailwind and RN (#172)

New tiny `packages/tokens`: a generator parses the two token blocks in
`web/src/styles/global.css` (`:root` + dark override) and emits the checked-in
`tokens.ts` — `light` and `dark` palette objects, plain color strings. A
vitest regenerates from the CSS and asserts the checked-in file matches, so
editing either side without regenerating goes red. The web keeps reading its
CSS untouched (byte-identical output — web does not consume the package in
v1). The app selects palettes with `useColorScheme()`.

**Done when**: the sync test fails on an induced drift and passes otherwise;
palettes match `global.css` values exactly.

### 4. Data layer — the Edition client (#171, ADR-0043)

One module in the app: fetch both URLs on open; if a disk-cached artifact
exists render it instantly, then revalidate with `If-None-Match` in the
background — `304` keeps, `200` replaces and re-renders. Pull-to-refresh
forces the fetch; on failure keep the last good artifact and surface its
`builtAt` as the « mis à jour » stamp. Outlets ride along with the edition
fetch (same cadence). Typed with `@prisme/domain` unchanged. No contract
versioning — app and site change in lockstep from this repo.

**Done when**: unit tests cover cache/revalidate/keep-on-failure semantics
against fixtures, and the app renders the fixture offline.

### 5. Chrome + navigation (#173, #175)

expo-router bottom tabs: **Nouveau · Brûlant · Top · Plus**, with horizontal
swipe between the three sort tabs (implementation approach free, behavior
fixed). Every screen carries the scrolling (non-sticky) header: wordmark
left (tap → Brûlant), **Couverture/Exposition toggle** right — global,
persisted in AsyncStorage, default Couverture, flipping every coverage bar
(lists and Story page). Each sort screen opens with the web's EditionHeader
block: h1 « À la une », temporal anchor, story count.

**Done when**: tab jumps and adjacent swipes work; the toggle flips bars on
every screen and survives a restart.

### 6. Sort screens — 1:1 web parity (#173)

Replicate the web's three sort pages in native components, measuring the
web: StoryCard (title, section label, coverage meta line, leaning dots),
hairline dividers, load-more batching as web ships it, and the Trending
badge exactly as web renders it (ADR-0029/0031 — per-reader state in
AsyncStorage). The web components are the reference; do not redesign.

**Done when**: side-by-side with the web on the same data, the screens read
as the same product (typography, density, badges), with only the three
recorded deviations.

### 7. Story page — one scroll (#173)

Pushed from a list row, back link « ‹ À la une ». One scroll, in order: hero
image when an article carries `imageUrl` (hotlinked, fallback the Prisme
mark), title + section, coverage bar + counts (obeys the mode toggle),
chronologie de couverture replicated from web (ADR-0032), Résumés as a
Gauche/Centre/Droite segmented control (web's PrismTabs), **Différences
always visible**, articles grouped per Coverage group with leaning/paywall
badges as web, rows opening the outlet article in the in-app browser
(expo-web-browser).

**Done when**: every story in the fixture edition renders completely and
outlet articles open in the in-app browser.

### 8. « Plus » tab — the static pages (#175)

A short list: **Classement politique des médias** first (port the page: the
Outlet config via `@prisme/domain`, its charts), then **Méthode** (static
content port), then **Mentions légales** — ported and adapted where it
describes *le site*: add the app context (distribution via Apple/Google, no
new data collection), keep the editor/host/contact facts.

**Done when**: all three pages render; the classement matches the web's
data and chart shapes.

### 9. EAS + closed-testing readiness (blocked on enrollment #170)

EAS credentials flow, dev and preview builds exercised (`eas build`,
`--local` fallback), and the written steps to distribute via TestFlight and
Play internal testing once the accounts exist. **Not** labelled
ready-for-agent until #170 resolves.

## Sequencing

1, 2, 3 are parallel roots. 4 needs 2. 5 needs 2 + 3. 6 and 7 need 4 + 5.
8 needs 3 + 5. 9 needs 2 (+ #170 externally). Wired as native issue
dependencies on the ready-for-agent issues.

## Conventions

Conventional Commits; one branch and one PR per issue, closing it; `pnpm
test` + `pnpm typecheck` green before every PR; UI French, code and data
keys English; EAS free tier only — no paid service without explicit consent;
ADR-0003 applies everywhere (nothing teaser-like enters any artifact).
