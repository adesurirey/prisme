import { describe, expect, it } from 'vitest';
import type { ActivityBin } from './activity.ts';
import { coverageOrder } from './coverage.ts';

/**
 * The coverage-chronology bin shape (ADR-0032), the one the pipeline
 * embeds on each Story (issue #186, ADR-0043): epoch-ms edges, one count
 * per Coverage group, and the total on the same basis as
 * `countedArticles()`. The type is the artifact's contract — the web page
 * and the app render these values, never re-derive them.
 */
describe('ActivityBin', () => {
  it('counts every Coverage group — exhaustive over coverageOrder, no extras', () => {
    // The literal is compile-checked against Record<CoverageGroup, number>:
    // a missing or foreign group fails typecheck. The runtime side pins
    // the shipped shape — the three groups, in display order.
    const counts = {
      gauche: 1,
      centre: 2,
      droite: 3,
    } satisfies ActivityBin['counts'];
    const bin: ActivityBin = {
      start: 1_793_000_000_000,
      end: 1_793_003_600_000,
      counts,
      total: 6,
    };
    expect(Object.keys(bin.counts)).toEqual(coverageOrder);
  });
});
