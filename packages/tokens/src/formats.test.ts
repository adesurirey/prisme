import { describe, expect, it } from 'vitest';
import { renderTokensCss, renderTokensModule } from './formats.ts';

/**
 * The two artifacts @prisme/tokens emits from the DTCG dictionary
 * (issue #178): the TS palettes module for React Native and the CSS token
 * blocks for web. Expected strings are hand-written from the fixture,
 * independent of the implementation. The dictionary's descriptions render
 * as comments — usage guidance for anyone (human or agent) styling web or
 * mobile against these tokens.
 */

const FILE_DESCRIPTION =
  'Prisme color tokens — monochrome chrome, color reserved for the three Leanings.';

const light = [
  { name: 'canvas', value: '#fcfcfc', description: 'Page background canvas.' },
  { name: 'lineStrong', value: 'rgba(17, 17, 20, 0.18)' },
];
const dark = [
  { name: 'canvas', value: '#0e0e10', description: 'Page background canvas.' },
  { name: 'lineStrong', value: 'rgba(255, 255, 255, 0.22)' },
];

describe('renderTokensModule', () => {
  it('emits the Palette type and both palettes, light key order', () => {
    expect(renderTokensModule(light, dark, FILE_DESCRIPTION)).toBe(`/*
 * GENERATED FILE — do not edit by hand. The source of truth is the DTCG
 * dictionary in packages/tokens/src/dictionary/color.json; regenerate
 * with:
 *
 *   pnpm --filter @prisme/tokens generate
 *
 * src/sync.test.ts goes red whenever this file and the dictionary drift
 * apart (issue #178): edit the dictionary, then regenerate.
 */

/*
 * ${FILE_DESCRIPTION}
 */

/** Every Prisme color token as a plain color string (hex or rgba()). */
export type Palette = {
  readonly canvas: string;
  readonly lineStrong: string;
};

/** Light theme — the light group of the dictionary. */
export const light: Palette = {
  /** Page background canvas. */
  canvas: '#fcfcfc',
  lineStrong: 'rgba(17, 17, 20, 0.18)',
};

/** Dark theme — the dark group of the dictionary. */
export const dark: Palette = {
  /** Page background canvas. */
  canvas: '#0e0e10',
  lineStrong: 'rgba(255, 255, 255, 0.22)',
};
`);
  });

  it('throws when the two themes define different token sets', () => {
    expect(() =>
      renderTokensModule(light, [{ name: 'canvas', value: '#0e0e10' }], ''),
    ).toThrow(/lineStrong/);
  });
});

describe('renderTokensCss', () => {
  it('emits the :root block and the dark media override, kebab-case vars', () => {
    expect(renderTokensCss(light, dark, FILE_DESCRIPTION)).toBe(`/*
 * GENERATED FILE — do not edit by hand. The source of truth is the DTCG
 * dictionary in packages/tokens/src/dictionary/color.json; regenerate
 * with:
 *
 *   pnpm --filter @prisme/tokens generate
 *
 * packages/tokens/src/sync.test.ts goes red whenever this file and the
 * dictionary drift apart (issue #178): edit the dictionary, then
 * regenerate.
 */

/*
 * ${FILE_DESCRIPTION}
 */

:root {
  /* Page background canvas. */
  --canvas: #fcfcfc;
  --line-strong: rgba(17, 17, 20, 0.18);
}

@media (prefers-color-scheme: dark) {
  :root {
    /* Page background canvas. */
    --canvas: #0e0e10;
    --line-strong: rgba(255, 255, 255, 0.22);
  }
}
`);
  });

  it('throws when the two themes define different token sets', () => {
    expect(() =>
      renderTokensCss(
        light,
        [
          { name: 'canvas', value: '#0e0e10' },
          { name: 'nightOnly', value: '#000000' },
        ],
        '',
      ),
    ).toThrow(/nightOnly/);
  });
});
