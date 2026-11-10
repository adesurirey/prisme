/**
 * Writes the package's two checked-in artifacts from the DTCG dictionary
 * (issue #178): src/tokens.ts (React Native palettes) and src/tokens.css
 * (the token blocks web's global.css imports via the package). The
 * dictionary is the source of truth (reversal of the initial #172
 * direction, decided by the owner); this script only re-emits. Run from
 * the repo root or the package:
 *
 *   pnpm --filter @prisme/tokens generate
 */
import path from 'node:path';
import { buildTokens } from '../src/build.ts';

await buildTokens({
  tsDir: path.resolve(import.meta.dirname, '../src'),
  cssDir: path.resolve(import.meta.dirname, '../src'),
});
console.log('@prisme/tokens: src/tokens.ts and src/tokens.css regenerated');
