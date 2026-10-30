/**
 * Build-output tests (issue #64): they assert on what the build actually
 * ships, not on source — the manifest must be copied to dist/ with the
 * agreed fields, the PNG icons must land in dist/icons/, and the rendered
 * HTML must reference them. `astro build` runs in beforeAll against a
 * committed fixture dataset (web/test-data), never against the repo's
 * data/: the archive shifts under every hourly run, and tests must not
 * (PRISME_DATA_DIR, data.ts — test infrastructure only). The fixture is a
 * faithful Edition artifact: windows consistent with builtAt, the
 * 7-jours floor respected, latestStories a subset of the day list.
 *
 * The suite builds twice: the fixture as committed, and a derived copy
 * with an empty « En direct » window for the empty-state assertions.
 */
import { execSync } from 'node:child_process';
import {
  cp,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Story } from '@prisme/domain';
import { foundingInstant } from '@prisme/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formatStoryDate } from './article-date';
import { loadEdition } from './data';
import { latestEmptyLine } from './latest';
import { formatParisDate } from './paris-date';

const WEB_DIR = path.resolve(import.meta.dirname, '..');
const FIXTURE_DIR = path.join(WEB_DIR, 'test-data');

// The test process reads the same fixture the child build does (loadEdition
// in the assertions below); other test files never read data/.
process.env.PRISME_DATA_DIR = FIXTURE_DIR;

// The two builds, disambiguated: `fixtureDist` (renamed out of the way
// after build 1) is the committed fixture; `emptyDist` is the Astro
// default dist/ left by build 2, the derived empty-window fixture.
let fixtureDist: string;
let emptyDist: string;

beforeAll(async () => {
  // Strip a stray BASE_URL from the environment: some shells (agents, CI
  // wrappers) export one, and the child build would otherwise pick it up
  // instead of the configured / base.
  const env = { ...process.env };
  delete env.BASE_URL;
  env.PRISME_DATA_DIR = FIXTURE_DIR;

  // Build 1: the fixture as committed — renamed out of Astro's default
  // dist/ so build 2 can take that path.
  execSync('node_modules/.bin/astro build', {
    cwd: WEB_DIR,
    stdio: 'pipe',
    env,
  });
  fixtureDist = path.join(WEB_DIR, 'dist-fixture');
  await rename(path.join(WEB_DIR, 'dist'), fixtureDist);

  // Build 2: a derived copy with an empty « En direct » window — the
  // empty state is the one branch the committed fixture cannot show.
  const derived = path.join(
    await mkdtemp(path.join(tmpdir(), 'prisme-fixture-')),
    'test-data',
  );
  await cp(FIXTURE_DIR, derived, { recursive: true });
  const edition = JSON.parse(
    await readFile(path.join(derived, 'edition.json'), 'utf8'),
  );
  edition.latestStories = [];
  await writeFile(
    path.join(derived, 'edition.json'),
    `${JSON.stringify(edition, null, 2)}\n`,
  );
  env.PRISME_DATA_DIR = derived;
  execSync('node_modules/.bin/astro build', {
    cwd: WEB_DIR,
    stdio: 'pipe',
    env,
  });
  // dist (Astro's default) now holds the empty-window build.
  emptyDist = path.join(WEB_DIR, 'dist');
  await rm(derived, { recursive: true, force: true });
  // Two sequential astro builds: the default 10 s hook timeout is not
  // enough on CI runners (12.6 s there, ~7 s locally).
}, 120_000);

afterAll(async () => {
  await rm(fixtureDist, { recursive: true, force: true });
});

const edition = await loadEdition();
const builtAt = new Date(edition.builtAt);

const readDist = (relative: string, root: string = fixtureDist) =>
  readFile(path.join(root, relative), 'utf8');

/** The windowed editions' temporal anchor, as a per-page assertion: the
 * anchor's <p> ships on every screen size (ADR-0029 lifted the
 * small-screen hiding — it only ever existed to make room for the
 * « Nouveau » pill), so its class carries neither `hidden` nor a
 * small-screen display switch. */
function expectAnchorVisible(html: string, label: string): void {
  const klass = new RegExp(`<p class="([^"]*)"[^>]*>${label}</p>`).exec(
    html,
  )?.[1];
  expect(klass, `anchor « ${label} » not found`).toBeDefined();
  expect(klass!.split(' ')).not.toContain('hidden');
  expect(klass!).not.toContain('sm:block');
}

/** The editions select's options, in shipped order (ADR-0028/0029:
 * freshness-first — En direct, Aujourd'hui, 7 jours). */
function optionsOf(html: string): { value: string; selected: boolean }[] {
  return [...html.matchAll(/<option value="([^"]*)"([^>]*)>/g)].map((m) => ({
    value: m[1],
    selected: m[2].includes('selected'),
  }));
}

function expectPickerOrder(html: string): void {
  expect(optionsOf(html).map((o) => o.value)).toEqual([
    '/en-direct/',
    '/',
    '/7-jours/',
  ]);
}

/** The noscript fallback's links, in shipped order — every edition but
 * the page's own (exactly one h1, exactly one self). */
function noscriptHrefs(html: string): string[] {
  const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(html)?.[1] ?? '';
  return [...noscript.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
}

/** Module-script chunk names, hashed: Astro names chunks
 * <route>_<…>.<content-hash>.js, so identical glue code ships under the
 * identical hash whatever the page. */
function chunkHashes(html: string): string[] {
  return [
    ...html.matchAll(
      /<script type="module" src="\/_astro\/[^"]+\.([A-Za-z0-9_-]+)\.js"/g,
    ),
  ].map((m) => m[1]);
}

/** The built chunks a page pulls — its own module scripts plus, one hop
 * deep, what they import (the trending glue is a two-chunk chain). */
async function scriptChunkTexts(html: string): Promise<string[]> {
  const texts: string[] = [];
  for (const m of html.matchAll(
    /<script type="module" src="\/(_astro\/[^"]+)"/g,
  )) {
    const text = await readFile(path.join(fixtureDist, m[1]), 'utf8');
    texts.push(text);
    for (const dep of text.matchAll(/(?:from|import)"\.\/([^"]+)"/g)) {
      texts.push(
        await readFile(path.join(fixtureDist, '_astro', dep[1]), 'utf8'),
      );
    }
  }
  return texts;
}

/** The founding time shipped in a built card (issue #136): pick the first
 * Story past the hero — the lead renders in the hero variant, whose
 * caption line carries its own « mis à jour » stamp — with a founding
 * instant, and assert the card carries the formatted time. */
async function expectCardFoundingTime(html: string, stories: Story[]) {
  let picked: { story: Story; instant: number } | undefined;
  for (const story of stories.slice(1)) {
    const instant = foundingInstant(story);
    if (instant !== undefined) {
      picked = { story, instant };
      break;
    }
  }
  if (!picked)
    throw new Error(
      'no Story with a founding instant beyond the hero — cannot test',
    );
  const founded = formatStoryDate(new Date(picked.instant));
  const at = html.indexOf(`data-story-id="${picked.story.id}"`);
  expect(at).toBeGreaterThan(-1);
  const card = html.slice(at, html.indexOf('</article>', at));
  // One span after the Coverage count — no prefix; desktop-only: hidden
  // under sm:, where the meta row wraps too tight (user decision on the
  // #137 review, superseding #136's every-screen version).
  expect(founded).not.toBe('');
  expect(card).toContain(
    `<span class="hidden whitespace-nowrap text-faint sm:inline">${founded}</span>`,
  );
}

describe('PWA manifest', () => {
  it('is served from the build output and parses', async () => {
    const manifest = JSON.parse(
      await readFile(path.join(fixtureDist, 'manifest.webmanifest'), 'utf8'),
    );
    expect(manifest.name).toBe('Prisme');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.theme_color).toBe('#fcfcfc');
    expect(manifest.background_color).toBe('#fcfcfc');
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: '/icons/icon-192.png' }),
        expect.objectContaining({ src: '/icons/icon-512.png' }),
        expect.objectContaining({
          src: '/icons/maskable-512.png',
          purpose: 'maskable',
        }),
      ]),
    );
  });

  it('references the icon PNGs that are actually built', async () => {
    const manifest = JSON.parse(
      await readFile(path.join(fixtureDist, 'manifest.webmanifest'), 'utf8'),
    );
    for (const icon of manifest.icons) {
      const file = path.join(fixtureDist, icon.src.replace(/^\//, ''));
      const bytes = await readFile(file);
      // PNG magic number.
      expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    }
    for (const name of [
      'icons/apple-touch-icon.png',
      'icons/maskable-192.png',
    ]) {
      expect((await stat(path.join(fixtureDist, name))).isFile()).toBe(true);
    }
  });
});

describe('page head tags', () => {
  it('references the manifest and the apple-touch-icon', async () => {
    const html = await readDist('index.html');
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain(
      'rel="apple-touch-icon" href="/icons/apple-touch-icon.png"',
    );
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain(
      'name="apple-mobile-web-app-title" content="Prisme"',
    );
  });
});

describe('the editions picker (ADR-0028, as amended by ADR-0029)', () => {
  it("reads freshness-first on every edition: En direct, Aujourd'hui, 7 jours", async () => {
    for (const page of [
      'index.html',
      'en-direct/index.html',
      '7-jours/index.html',
    ]) {
      expectPickerOrder(await readDist(page));
    }
  });

  it("arrives preselected on the page's own window, with noscript links to the others", async () => {
    const home = await readDist('index.html');
    const live = await readDist('en-direct/index.html');
    const week = await readDist('7-jours/index.html');
    expect(home).toContain('<option value="/" selected>');
    expect(noscriptHrefs(home)).toEqual(['/en-direct/', '/7-jours/']);
    expect(live).toContain('<option value="/en-direct/" selected>');
    expect(noscriptHrefs(live)).toEqual(['/', '/7-jours/']);
    expect(week).toContain('<option value="/7-jours/" selected>');
    expect(noscriptHrefs(week)).toEqual(['/en-direct/', '/']);
  });

  it('shows the temporal anchors on every screen size (ADR-0029)', async () => {
    const homeAnchor = `${formatParisDate(builtAt, {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    })} ${formatParisDate(builtAt, { year: 'numeric' })}`;
    const weekAnchor = `depuis le ${formatParisDate(
      new Date(builtAt.getTime() - 6 * 86_400_000),
      { day: 'numeric', month: 'short' },
    )}`;
    expectAnchorVisible(await readDist('index.html'), homeAnchor);
    expectAnchorVisible(await readDist('7-jours/index.html'), weekAnchor);
    expectAnchorVisible(
      await readDist('en-direct/index.html'),
      '12 dernières heures',
    );
  });
});

describe('« En direct » edition (issue #137, ADR-0029)', () => {
  it("prerenders latest-first with la Une's anatomy: hero, cards, load-more, count line", async () => {
    const html = await readDist('en-direct/index.html');
    // One h1 naming the surface; the window is the select's setting.
    expect(html).toMatch(/<h1[^>]*>\s*À la une\s*<\/h1>/);
    expect(html).not.toMatch(/<h1[^>]*>\s*En direct\s*<\/h1>/);
    // The stories ship in the artifact's latest-first order — founding
    // instant descending — hero first, cards after.
    const ids = [...html.matchAll(/data-story-id="([^"]*)"/g)].map((m) => m[1]);
    expect(ids).toEqual(edition.latestStories.map((s) => s.id));
    expect(html).toContain('data-load-more');
    expect(html).toContain('2 sujets — dernier point à 20\u202Fh\u202F45');
  });

  it('is noindexed with a canonical, like every windowed edition (ADR-0028)', async () => {
    const html = await readDist('en-direct/index.html');
    expect(html).toContain(
      '<link rel="canonical" href="https://leprisme.info/en-direct/">',
    );
    // Meta noindex with crawl allowed — a robots.txt disallow would hide
    // the page from the very crawler that must read the noindex.
    expect(html).toContain('<meta name="robots" content="noindex"');
  });

  it('stays out of the sitemap with « 7 jours » (ADR-0028)', async () => {
    const sitemap = await readDist('sitemap-0.xml');
    expect(sitemap).not.toContain(
      '<loc>https://leprisme.info/en-direct/</loc>',
    );
    expect(sitemap).not.toContain('<loc>https://leprisme.info/7-jours/</loc>');
    expect(sitemap).toContain('<loc>https://leprisme.info/</loc>');
  });

  it('wires the badge script through the same code path as la Une', async () => {
    const home = await readDist('index.html');
    const live = await readDist('en-direct/index.html');
    // The shared glue: a chunk hash home and « En direct » both ship and
    // « 7 jours » doesn't — identical bundled code, not a copy.
    const homeHashes = new Set(chunkHashes(home));
    const liveHashes = new Set(chunkHashes(live));
    const weekHashes = new Set(
      chunkHashes(await readDist('7-jours/index.html')),
    );
    const shared = [...homeHashes].filter(
      (h) => liveHashes.has(h) && !weekHashes.has(h),
    );
    expect(shared).toHaveLength(1);
    // That glue leads to the trending module — the baseline key and the
    // badge slot are in the page's chunk graph.
    const texts = await scriptChunkTexts(live);
    const joined = texts.join('\n');
    expect(joined).toContain('prisme.seenStories');
    expect(joined).toContain('data-trending-slot');
  });

  it('renders the empty state naming the window and the last collection time', async () => {
    // The derived empty-window build (emptyDist, build 2 of beforeAll).
    const html = await readFile(
      path.join(emptyDist, 'en-direct', 'index.html'),
      'utf8',
    );
    expect(html).toContain(latestEmptyLine(builtAt));
    // The empty branch renders no list at all: no hero, no cards, no
    // load-more, no count line.
    expect(html).not.toContain('data-story-id');
    expect(html).not.toContain('<article');
    expect(html).not.toContain('dernier point à');
  });
});

describe('« 7 jours » edition (issue #128, ADR-0027, ADR-0028)', () => {
  it('prerenders /7-jours/ with a canonical, noindex and the shared header', async () => {
    const html = await readDist('7-jours/index.html');
    expect(html).toContain(
      '<link rel="canonical" href="https://leprisme.info/7-jours/">',
    );
    // The editions header (ADR-0028): « À la une » is the h1 on every
    // edition, the window — « 7 jours » here — is the select's
    // preselected value, and the noscript links carry the other
    // editions to readers without JS (exactly one h1 per page).
    expect(html).toMatch(/<h1[^>]*>\s*À la une\s*<\/h1>/);
    expect(html).not.toMatch(/<h1[^>]*>\s*7 jours\s*<\/h1>/);
    expect(html).toContain('data-edition-switcher');
    expect(html).toContain('<option value="/7-jours/" selected>');
    // No per-reader daily-visit semantics on the weekly page: no
    // trending module in the chunk graph and no badge text (ADR-0029).
    const chunks = (await scriptChunkTexts(html)).join('\n');
    expect(chunks).not.toContain('prisme.seenStories');
    expect(html).not.toContain('Faits nouveaux');
    expect(html).not.toContain('data-new-pill');
  });

  it("opens on « À la une » with the select on « Aujourd'hui » (ADR-0028)", async () => {
    const home = await readDist('index.html');
    // The h1 names the surface on every edition; the window is the
    // select's preselected value.
    expect(home).toMatch(/<h1[^>]*>\s*À la une\s*<\/h1>/);
    expect(home).not.toMatch(/<h1[^>]*>\s*Aujourd'hui\s*<\/h1>/);
    expect(home).toContain('data-edition-switcher');
    // « Nouveau » is gone entirely (ADR-0029): no pill hook anywhere.
    expect(home).not.toContain('data-new-pill');
  });
});

describe('card founding time (issue #136, ADR-0029)', () => {
  it('ships the founding time after the Coverage count on the index cards', async () => {
    const home = await readDist('index.html');
    await expectCardFoundingTime(home, edition.stories);
  });

  it('ships it on the « 7 jours » cards too — every edition', async () => {
    const week = await readDist('7-jours/index.html');
    await expectCardFoundingTime(week, edition.weekStories);
  });

  it('ships it on the « En direct » cards — the timeline edition', async () => {
    const live = await readDist('en-direct/index.html');
    await expectCardFoundingTime(live, edition.latestStories);
  });
});

describe('coverage chronology (ADR-0032)', () => {
  it("ships the Story's life chart on the Story page — and only there", async () => {
    const story = edition.stories[0]!;
    const page = await readDist(`${story.storyDay}/${story.slug}/index.html`);
    // The chart: a stacked SVG with a native <title> per bin and the
    // span aria line — prerendered, no client script.
    expect(page).toContain('<svg');
    expect(page).toContain('Chronologie des publications : ');
    expect(page).toMatch(/\d+ articles? sur \d+ (heures?|jours?)/);
    expect(page).toContain('<title>');
    // The cards keep the per-reader badge (ADR-0029) and carry no chart.
    const home = await readDist('index.html');
    expect(home).not.toContain('Chronologie des publications');
  });
});

describe('SEO head tags (robots, sitemap, canonical, OG/Twitter, JSON-LD)', () => {
  it('ships robots.txt pointing at the sitemap', async () => {
    const robots = await readDist('robots.txt');
    expect(robots).toContain(
      'Sitemap: https://leprisme.info/sitemap-index.xml',
    );
  });

  it('emits sitemap-index.xml with the Edition and Story URLs', async () => {
    const index = await readDist('sitemap-index.xml');
    expect(index).toContain('/sitemap-0.xml');
    const sitemap = await readDist('sitemap-0.xml');
    expect(sitemap).toContain('<loc>https://leprisme.info/</loc>');
    expect(sitemap).toContain(
      '<loc>https://leprisme.info/classement-politique-des-medias/</loc>',
    );
    expect(sitemap).toContain('<loc>https://leprisme.info/methode/</loc>');
    // At least one Story URL under its own day.
    expect(sitemap).toMatch(/<loc>https:\/\/leprisme.info\/20\d\d-\d\d-\d\d\//);
  });

  it('noindexes the windowed editions and leaves the home indexable (ADR-0028)', async () => {
    const home = await readDist('index.html');
    // Meta noindex with crawl allowed — a robots.txt disallow would
    // hide the page from the very crawler that must read the noindex.
    expect(await readDist('7-jours/index.html')).toContain(
      '<meta name="robots" content="noindex"',
    );
    expect(home).not.toContain('name="robots"');
  });

  it('gives every page a canonical, og:url and Twitter card', async () => {
    const home = await readDist('index.html');
    expect(home).toContain(
      '<link rel="canonical" href="https://leprisme.info/">',
    );
    expect(home).toContain(
      '<meta property="og:url" content="https://leprisme.info/">',
    );
    expect(home).toContain('property="og:site_name" content="Prisme"');
    // No ogImage passed → the site-wide fallback brand card.
    expect(home).toContain(
      'property="og:image" content="https://leprisme.info/og-default.png"',
    );
    expect(home).toContain('name="twitter:card" content="summary_large_image"');

    const classement = await readDist(
      'classement-politique-des-medias/index.html',
    );
    expect(classement).toContain(
      '<link rel="canonical" href="https://leprisme.info/classement-politique-des-medias/">',
    );
  });

  it('emits NewsArticle JSON-LD with isBasedOn on a Story page', async () => {
    const storyDir = (await readdir(path.join(fixtureDist, '2026-10-15'))).find(
      (name) => !name.startsWith('.'),
    );
    expect(storyDir).toBeDefined();
    const html = await readDist(`2026-10-15/${storyDir}/index.html`);
    expect(html).toContain('"@type":"NewsArticle"');
    expect(html).toContain('"isBasedOn":');
    expect(html).toContain('property="article:published_time"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    // Site-wide identity JSON-LD is also present.
    expect(html).toContain('"@type":"WebSite"');
  });

  it('ships the branded French 404 page', async () => {
    const html = await readDist('404.html');
    expect(html).toContain("Cette page n'existe pas");
    // The Story-page back link is the way home — no separate CTA style.
    expect(html).toContain('À la une');
  });
});
