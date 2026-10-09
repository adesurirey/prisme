import { describe, expect, it } from 'vitest';
import type { GroupingInputArticle, GroupingProposal } from '../gemini.ts';
import type { GroupingFixture } from './grouping-fixtures.ts';
import { candidatePairs, stratify } from './grouping-sample.ts';

function fixtureOf(
  pairs: [string, string][], // [articleId, snapshot storyId]
): GroupingFixture {
  const freshArticles: GroupingInputArticle[] = pairs.map(([id]) => ({
    id,
    headline: `headline ${id}`,
    teaser: '',
    section: 'politics' as const,
  }));
  return {
    name: 'from-empty',
    groundTruth: Object.fromEntries(pairs),
    liveStories: [],
    freshArticles,
  };
}

const proposalOf = (clusters: [string, string][]): GroupingProposal => ({
  newStories: [],
  assignments: clusters.map(([articleId, cluster]) => ({
    articleId,
    newStoryKey: cluster,
    confidence: 0.9,
  })),
  titleUpdates: [],
});

describe('candidatePairs (sanity sampler buckets)', () => {
  it('buckets splits, over-merges and controls like the grader', () => {
    const fixture = fixtureOf([
      ['a1', 's1'],
      ['a2', 's1'],
      ['a3', 's2'],
      ['a4', 's3'],
    ]);
    // a1,a2 same key story, candidate splits them; a3,a4 different keys,
    // candidate merges them; every other pair disagrees nowhere — but
    // cross-cluster pairs land in distinct candidate keys, so they are
    // different/different controls.
    const pairs = candidatePairs(
      fixture,
      proposalOf([
        ['a1', 'x'],
        ['a2', 'y'],
        ['a3', 'z'],
        ['a4', 'z'],
      ]),
    );
    const bucket = (a: string, b: string) =>
      pairs.find(
        (p) => (p.aId === a && p.bId === b) || (p.aId === b && p.bId === a),
      )?.bucket;
    expect(bucket('a1', 'a2')).toBe('split');
    expect(bucket('a3', 'a4')).toBe('over-merge');
    expect(bucket('a1', 'a3')).toBe('control-different');
    expect(bucket('a1', 'a4')).toBe('control-different');
    expect(bucket('a2', 'a3')).toBe('control-different');
    expect(bucket('a2', 'a4')).toBe('control-different');
  });

  it('a same/same pair is a control-same', () => {
    const fixture = fixtureOf([
      ['a1', 's1'],
      ['a2', 's1'],
    ]);
    const [pair] = candidatePairs(
      fixture,
      proposalOf([
        ['a1', 'x'],
        ['a2', 'x'],
      ]),
    );
    expect(pair?.bucket).toBe('control-same');
  });
});

describe('stratify (cross-model dedupe, budget discipline)', () => {
  const pair = (a: string, b: string, bucket: 'split' | 'over-merge') => ({
    fixture: 'from-empty' as const,
    aId: a,
    bId: b,
    aHeadline: `h ${a}`,
    bHeadline: `h ${b}`,
    sections: [],
    bucket,
  });

  it('a pair surfaced by both models appears once', () => {
    const rows = stratify(
      {
        luna: [pair('a1', 'a2', 'split'), pair('a3', 'a4', 'split')],
        'flash-lite': [pair('a1', 'a2', 'split'), pair('a5', 'a6', 'split')],
      },
      () => 0.5,
    );
    const ids = rows.map((r) => [r.pair.aId, r.pair.bId].sort().join('-'));
    expect(new Set(ids).size).toBe(ids.length);
    expect(rows.filter((r) => r.pair.aId === 'a1').length).toBeLessThanOrEqual(
      1,
    );
  });
});
