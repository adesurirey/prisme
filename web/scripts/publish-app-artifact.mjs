/**
 * The app's API is the static site (ADR-0043, issue #176): after
 * `astro build`, copy the pipeline's edition.json and outlets.json from
 * the data directory into the site output dir, so the JSON the mobile
 * app fetches and the HTML a reader loads always ship from the same
 * build — the same commit, verified by the same hourly run.
 *
 * The publish list is an allowlist on purpose. data/ also holds
 * classifications.json (internal cache), topics.json (no UI reads it,
 * ADR-0024), redirects.json (no deep links in the app's v1) and
 * stories/*.json (superseded by the lists embedded in edition.json) —
 * none of it ships. The build-output tests (build-output.test.ts) run
 * this same script against the fixture build; web/test-data carries
 * decoy classifications.json and topics.json in the real files' shapes
 * so a copy-everything regression fails there.
 *
 * PRISME_DATA_DIR works here as everywhere in web (data.ts): the fixture
 * build points it at web/test-data, every real build leaves it unset and
 * publishes the repo's data/.
 *
 * Usage: node scripts/publish-app-artifact.mjs [<output-dir>]
 * (default: dist/ in this package — Astro's default outDir.)
 */
import { copyFile } from 'node:fs/promises';
import path from 'node:path';

const PUBLISHED = ['edition.json', 'outlets.json'];

const webDir = path.resolve(import.meta.dirname, '..');
const dataDir =
  process.env.PRISME_DATA_DIR != null
    ? path.resolve(process.env.PRISME_DATA_DIR)
    : path.resolve(webDir, '..', 'data');
const outDir = path.resolve(process.argv[2] ?? path.join(webDir, 'dist'));

for (const name of PUBLISHED) {
  await copyFile(path.join(dataDir, name), path.join(outDir, name));
}
console.log(`Published ${PUBLISHED.join(', ')} to ${outDir}`);
