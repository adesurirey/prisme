/**
 * The two @prisme/tokens renderers (issue #178): from the DTCG dictionary
 * (src/dictionary/color.json) they emit the checked-in artifacts — the TS
 * palettes module for React Native (StyleSheet-ready plain color strings)
 * and the CSS token blocks for web (global.css imports the generated
 * tokens.css). The dictionary's per-token descriptions render as comments:
 * usage guidance for anyone — human or agent — styling web or mobile
 * against these tokens, since the artifacts are often the only surface
 * they see. Both outputs must stay stable under biome's formatter: the
 * pre-commit hook rewrites staged files, so any reformat would read as
 * drift. Kept deliberately tiny — typography, spacing or radii tokens
 * would ride the same dictionary, not a bigger parser.
 */

/** One theme palette entry: camelCase name, literal color value, and the
 * dictionary's usage description (optional, rendered as a comment). */
export type TokenEntry = {
  name: string;
  value: string;
  description?: string;
};

const TS_BANNER = `/*
 * GENERATED FILE — do not edit by hand. The source of truth is the DTCG
 * dictionary in packages/tokens/src/dictionary/color.json; regenerate
 * with:
 *
 *   pnpm --filter @prisme/tokens generate
 *
 * src/sync.test.ts goes red whenever this file and the dictionary drift
 * apart (issue #178): edit the dictionary, then regenerate.
 */`;

const CSS_BANNER = `/*
 * GENERATED FILE — do not edit by hand. The source of truth is the DTCG
 * dictionary in packages/tokens/src/dictionary/color.json; regenerate
 * with:
 *
 *   pnpm --filter @prisme/tokens generate
 *
 * packages/tokens/src/sync.test.ts goes red whenever this file and the
 * dictionary drift apart (issue #178): edit the dictionary, then
 * regenerate.
 */`;

/** Both themes must define the same token set — a palette key missing
 * from one theme would break the other's consumers at runtime. */
function assertSameTokenSet(light: TokenEntry[], dark: TokenEntry[]): void {
  const lightNames = new Set(light.map((t) => t.name));
  const stray = dark.filter((t) => !lightNames.has(t.name)).map((t) => t.name);
  const missing = light
    .filter((t) => !dark.some((d) => d.name === t.name))
    .map((t) => t.name);
  const problems = [
    ...stray.map((n) => `${n} (dark only)`),
    ...missing.map((n) => `${n} (light only)`),
  ];
  if (problems.length > 0) {
    throw new Error(
      `Dictionary themes define different token sets: ${problems.join(', ')}`,
    );
  }
}

/** camelCase palette key → --kebab-case custom property. */
function toKebabCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** The dictionary's file-level description, as its own comment block. */
function fileDescriptionComment(description: string): string[] {
  return ['/*', ` * ${description}`, ' */'];
}

/** Render src/tokens.ts — the RN-facing module (Palette, light, dark). */
export function renderTokensModule(
  light: TokenEntry[],
  dark: TokenEntry[],
  fileDescription: string,
): string {
  assertSameTokenSet(light, dark);
  const lines = [
    TS_BANNER,
    '',
    ...fileDescriptionComment(fileDescription),
    '',
    '/** Every Prisme color token as a plain color string (hex or rgba()). */',
    'export type Palette = {',
  ];
  for (const { name } of light) {
    lines.push(`  readonly ${name}: string;`);
  }
  lines.push('};', '');
  for (const [doc, varName, theme] of [
    ['/** Light theme — the light group of the dictionary. */', 'light', light],
    ['/** Dark theme — the dark group of the dictionary. */', 'dark', dark],
  ] as const) {
    lines.push(doc, `export const ${varName}: Palette = {`);
    for (const { name, value, description } of theme) {
      if (description) lines.push(`  /** ${description} */`);
      lines.push(`  ${name}: '${value}',`);
    }
    lines.push('};', '');
  }
  return `${lines.join('\n')}`;
}

/** Render src/tokens.css — the two token blocks global.css imports: the
 * base :root palette and the prefers-color-scheme: dark override. */
export function renderTokensCss(
  light: TokenEntry[],
  dark: TokenEntry[],
  fileDescription: string,
): string {
  assertSameTokenSet(light, dark);
  const block = (theme: TokenEntry[], indent: string) =>
    theme.flatMap(({ name, value, description }) => [
      ...(description ? [`${indent}/* ${description} */`] : []),
      `${indent}--${toKebabCase(name)}: ${value};`,
    ]);
  return [
    CSS_BANNER,
    '',
    ...fileDescriptionComment(fileDescription),
    '',
    ':root {',
    ...block(light, '  '),
    '}',
    '',
    '@media (prefers-color-scheme: dark) {',
    '  :root {',
    ...block(dark, '    '),
    '  }',
    '}',
    '',
  ].join('\n');
}
