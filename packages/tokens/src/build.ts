import { readFile } from 'node:fs/promises';
import path from 'node:path';
import StyleDictionary from 'style-dictionary';
import type { TokenEntry } from './formats.ts';
import { renderTokensCss, renderTokensModule } from './formats.ts';

/**
 * The @prisme/tokens build (issue #178): Style Dictionary resolves the
 * DTCG dictionary (src/dictionary/color.json) and the two registered
 * formats below emit the package's artifacts — src/tokens.ts (React
 * Native palettes) and src/tokens.css (the two token blocks web's
 * global.css imports). The CLI (scripts/generate-tokens.ts) writes the
 * checked-in files; src/sync.test.ts rebuilds into a temp dir and
 * byte-compares, so editing the dictionary without regenerating — or
 * either artifact by hand — goes red.
 */

const DICTIONARY = path.resolve(import.meta.dirname, './dictionary/color.json');

/** Split the resolved tokens into the two theme palettes, keeping
 * dictionary order (the light group's order is the canonical key order).
 * The per-token $description rides along — it renders as the usage
 * comment in both artifacts. */
function themePalettes(dictionary: {
  allTokens: { path: string[]; $value?: unknown; $description?: string }[];
}): { light: TokenEntry[]; dark: TokenEntry[] } {
  const light: TokenEntry[] = [];
  const dark: TokenEntry[] = [];
  for (const token of dictionary.allTokens) {
    const [theme, name] = token.path;
    const entry = {
      name: String(name),
      value: String(token.$value),
      description: token.$description,
    };
    if (theme === 'light') light.push(entry);
    else if (theme === 'dark') dark.push(entry);
    else
      throw new Error(
        `Token ${token.path.join('.')} sits outside the light/dark groups`,
      );
  }
  return { light, dark };
}

/**
 * Build both artifacts. Output dirs are parameters so the sync test can
 * rebuild into a temp dir and compare; the CLI passes the checked-in
 * locations. Token-collision warnings are disabled: light and dark
 * intentionally define the same token names. Style Dictionary drops the
 * dictionary's root $description, so it is read from the file directly.
 */
export async function buildTokens(out: { tsDir: string; cssDir: string }) {
  const dictionary = JSON.parse(await readFile(DICTIONARY, 'utf8')) as {
    $description: string;
  };
  const sd = new StyleDictionary({
    include: [DICTIONARY],
    log: { warnings: 'disabled' },
    hooks: {
      formats: {
        'prisme/ts': ({ dictionary: d }) => {
          const { light, dark } = themePalettes(d);
          return renderTokensModule(light, dark, dictionary.$description);
        },
        'prisme/css': ({ dictionary: d }) => {
          const { light, dark } = themePalettes(d);
          return renderTokensCss(light, dark, dictionary.$description);
        },
      },
    },
    platforms: {
      ts: {
        buildPath: out.tsDir,
        files: [{ destination: 'tokens.ts', format: 'prisme/ts' }],
      },
      css: {
        buildPath: out.cssDir,
        files: [{ destination: 'tokens.css', format: 'prisme/css' }],
      },
    },
  });
  await sd.buildAllPlatforms();
}
