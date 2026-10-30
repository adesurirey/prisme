import { describe, expect, it } from 'vitest';
import { LATEST_WINDOW_LABEL, latestEmptyLine } from './latest';

/**
 * The « En direct » edition's shared copy (issue #137, ADR-0029): the
 * temporal anchor and the empty-state line, pinned as strings so the page
 * cannot drift from the spec. The build-output tests assert the rendered
 * page against the fixture dataset; this pins the words themselves.
 */

describe('latestEmptyLine', () => {
  it('names the window and the last collection time (Paris clock)', () => {
    // 18:45 UTC is 20:45 in Paris — the footer-clock format, thin no-break
    // spaces around the h (docs/brand.md).
    expect(latestEmptyLine(new Date('2026-10-15T18:45:00Z'))).toBe(
      'Rien de fondé dans les 12 dernières heures — dernière collecte à 20\u202Fh\u202F45',
    );
  });

  it('embeds the same anchor the header ships', () => {
    const line = latestEmptyLine(new Date('2026-10-15T18:45:00Z'));
    expect(line).toContain(LATEST_WINDOW_LABEL);
  });
});
