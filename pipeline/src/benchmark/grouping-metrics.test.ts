import { describe, expect, it } from 'vitest';
import type { GroupingProposal } from '../gemini.ts';
import type { FixtureStory, GroupingFixture } from './grouping-fixtures.ts';
import {
  DUP_SEED_THRESHOLD,
  evaluateProposal,
  stability,
} from './grouping-metrics.ts';

const liveStories: FixtureStory[] = [
  {
    id: 'aaaa00000001',
    title: 'Maricarmen en concert à Paris',
    headlines: ['Maricarmen annonce deux dates à Paris'],
  },
  {
    id: 'aaaa00000002',
    title: 'Réforme des retraites : ce qui change',
    headlines: [],
  },
];

function fixture(overrides?: Partial<GroupingFixture>): GroupingFixture {
  return {
    name: 'long-context',
    groundTruth: {},
    liveStories,
    freshArticles: [
      {
        id: 'a1',
        headline: 'Maricarmen annonce deux dates à Paris',
        teaser: '',
      },
      { id: 'a2', headline: 'Retraites : la loi promulguée', teaser: '' },
      {
        id: 'a3',
        headline: 'Retraites : les syndicats réagissent',
        teaser: '',
      },
    ],
    ...overrides,
  };
}

function proposal(overrides?: Partial<GroupingProposal>): GroupingProposal {
  return {
    newStories: [],
    assignments: [
      { articleId: 'a1', storyId: 'aaaa00000001', confidence: 0.9 },
      { articleId: 'a2', storyId: 'aaaa00000002', confidence: 0.9 },
      { articleId: 'a3', storyId: 'aaaa00000002', confidence: 0.9 },
    ],
    ...overrides,
  };
}

describe('evaluateProposal — coverage', () => {
  it('counts a full valid assignment as covered', () => {
    const e = evaluateProposal(fixture(), proposal());
    expect(e.coverage).toEqual({
      total: 3,
      covered: 3,
      missing: [],
      duplicated: [],
      unknownTarget: [],
    });
  });

  it('flags missing and duplicated assignments', () => {
    const e = evaluateProposal(
      fixture(),
      proposal({
        assignments: [
          { articleId: 'a1', storyId: 'aaaa00000001', confidence: 0.9 },
          { articleId: 'a1', storyId: 'aaaa00000002', confidence: 0.9 },
        ],
      }),
    );
    expect(e.coverage.covered).toBe(1);
    expect(e.coverage.duplicated).toEqual(['a1']);
    expect(e.coverage.missing).toEqual(['a2', 'a3']);
  });

  it('flags assignments to unknown Story ids and unknown new keys', () => {
    const e = evaluateProposal(
      fixture(),
      proposal({
        assignments: [
          { articleId: 'a1', storyId: 'ffff00000001', confidence: 0.9 },
          { articleId: 'a2', newStoryKey: 'ghost', confidence: 0.9 },
        ],
      }),
    );
    expect(e.coverage.unknownTarget).toEqual(['a1', 'a2']);
    expect(e.coverage.covered).toBe(0);
  });

  it('resolves a storyId that names a proposed new Story (field slip)', () => {
    const e = evaluateProposal(
      fixture(),
      proposal({
        newStories: [{ key: 'k1' }],
        assignments: [
          { articleId: 'a1', storyId: 'aaaa00000001', confidence: 0.9 },
          { articleId: 'a2', storyId: 'k1', confidence: 0.9 },
          { articleId: 'a3', storyId: 'k1', confidence: 0.9 },
        ],
      }),
    );
    expect(e.coverage.unknownTarget).toEqual([]);
    expect(e.coverage.covered).toBe(3);
  });
});

describe('evaluateProposal — dup seeds', () => {
  it('flags a proposed Story whose seed duplicates a live Story', () => {
    const e = evaluateProposal(
      fixture(),
      proposal({
        newStories: [{ key: 'k1' }],
        assignments: [
          {
            articleId: 'a1',
            newStoryKey: 'k1',
            confidence: 0.5,
          },
          { articleId: 'a2', storyId: 'aaaa00000002', confidence: 0.9 },
          { articleId: 'a3', storyId: 'aaaa00000002', confidence: 0.9 },
        ],
      }),
    );
    expect(e.dupSeeds).toHaveLength(1);
    expect(e.dupSeeds[0].liveStoryId).toBe('aaaa00000001');
    expect(e.dupSeeds[0].overlap).toBeGreaterThan(DUP_SEED_THRESHOLD);
  });

  it('scores against Article headlines of the live Story, not just its title', () => {
    const e = evaluateProposal(
      fixture({
        liveStories: [
          {
            id: 'aaaa00000001',
            title: 'Musique : l’actualité des concerts',
            headlines: ['Maricarmen annonce deux dates à Paris'],
          },
          liveStories[1],
        ],
      }),
      proposal({
        newStories: [{ key: 'k1' }],
        assignments: [
          {
            articleId: 'a1',
            newStoryKey: 'k1',
            confidence: 0.5,
          },
          { articleId: 'a2', storyId: 'aaaa00000002', confidence: 0.9 },
          { articleId: 'a3', storyId: 'aaaa00000002', confidence: 0.9 },
        ],
      }),
    );
    expect(e.dupSeeds).toHaveLength(1);
  });

  it('does not flag an unrelated seed', () => {
    const e = evaluateProposal(
      fixture(),
      proposal({
        newStories: [{ key: 'k1' }],
        assignments: [
          { articleId: 'a1', storyId: 'aaaa00000001', confidence: 0.9 },
          { articleId: 'a2', newStoryKey: 'k1', confidence: 0.5 },
          { articleId: 'a3', storyId: 'aaaa00000002', confidence: 0.9 },
        ],
      }),
    );
    expect(e.dupSeeds).toEqual([]);
  });

  it('finds no dup seed on from-empty (no live Stories)', () => {
    const e = evaluateProposal(
      fixture({ liveStories: [] }),
      proposal({
        newStories: [{ key: 'k1' }],
        assignments: [
          { articleId: 'a1', newStoryKey: 'k1', confidence: 0.5 },
          { articleId: 'a2', newStoryKey: 'k1', confidence: 0.5 },
          { articleId: 'a3', newStoryKey: 'k1', confidence: 0.5 },
        ],
      }),
    );
    expect(e.dupSeeds).toEqual([]);
  });
});

describe('evaluateProposal — splits and over-merges', () => {
  it('counts a ground-truth group split across clusters', () => {
    const e = evaluateProposal(
      fixture({
        groundTruth: { a2: 'orig2', a3: 'orig2' },
      }),
      proposal({
        newStories: [{ key: 'k1' }],
        assignments: [
          { articleId: 'a1', storyId: 'aaaa00000001', confidence: 0.9 },
          { articleId: 'a2', storyId: 'aaaa00000002', confidence: 0.9 },
          { articleId: 'a3', newStoryKey: 'k1', confidence: 0.9 },
        ],
      }),
    );
    expect(e.clusters.groundTruthGroups).toBe(1);
    expect(e.clusters.splitGroups).toBe(1);
    expect(e.clusters.splitPairs).toBe(1);
    expect(e.clusters.keptPairs).toBe(0);
  });

  it('counts pairs from different original Stories co-clustered as over-merged', () => {
    const e = evaluateProposal(
      fixture({ groundTruth: { a1: 'orig1', a2: 'orig2' } }),
      proposal({
        newStories: [{ key: 'k1' }],
        assignments: [
          { articleId: 'a1', newStoryKey: 'k1', confidence: 0.5 },
          { articleId: 'a2', newStoryKey: 'k1', confidence: 0.5 },
          { articleId: 'a3', storyId: 'aaaa00000002', confidence: 0.9 },
        ],
      }),
    );
    expect(e.clusters.overMergedPairs).toBe(1);
  });
});

describe('stability', () => {
  it('is 1 when both runs cluster identically', () => {
    const a = evaluateProposal(fixture(), proposal());
    const b = evaluateProposal(fixture(), proposal());
    expect(stability(a, b)).toBe(1);
  });

  it('drops when one run merges what the other split', () => {
    const a = evaluateProposal(fixture(), proposal());
    const b = evaluateProposal(
      fixture(),
      proposal({
        assignments: [
          { articleId: 'a1', storyId: 'aaaa00000001', confidence: 0.9 },
          { articleId: 'a2', storyId: 'aaaa00000002', confidence: 0.9 },
          { articleId: 'a3', storyId: 'aaaa00000001', confidence: 0.9 },
        ],
      }),
    );
    expect(stability(a, b)).toBeLessThan(1);
  });

  it('is null when both runs propose only singletons', () => {
    const a = evaluateProposal(
      fixture(),
      proposal({
        assignments: [{ articleId: 'a1', newStoryKey: 'x', confidence: 0 }],
      }),
    );
    expect(stability(a, a)).toBeNull();
  });
});

/**
 * The deadlock fixture’s own metrics (issue #149): the graded « before » is
 * the loop shape (fresh march Articles re-assigned to the magnet Story),
 * the graded « after » the birth (a new Story claiming them — issue #150).
 */
describe('evaluateProposal — deadlock metrics (issue #149)', () => {
  const MAGNET = '3bca5d1e9243';

  function deadlockFixture(): GroupingFixture {
    return {
      name: 'deadlock',
      deadlock: { magnetStoryId: MAGNET },
      groundTruth: { a1: 'march', a2: 'march', a3: 'march', a4: 'march' },
      liveStories: [
        {
          id: MAGNET,
          title: 'Le tribunal administratif rejette le recours',
          headlines: ['Le tribunal rejette le recours'],
        },
        ...liveStories,
      ],
      freshArticles: ['a1', 'a2', 'a3', 'a4'].map((id) => ({
        id,
        headline: `Manifestation du 24 octobre, article ${id}`,
        teaser: '',
      })),
    };
  }

  it('counts the loop shape: fresh Articles re-assigned to the magnet Story', () => {
    const e = evaluateProposal(
      deadlockFixture(),
      proposal({
        assignments: [
          { articleId: 'a1', storyId: MAGNET, confidence: 0.9 },
          { articleId: 'a2', storyId: MAGNET, confidence: 0.9 },
          { articleId: 'a3', storyId: MAGNET, confidence: 0.9 },
          // Unassigned — the refusal’s aftermath, not a birth.
        ],
      }),
    );
    expect(e.deadlock).toEqual({ toMagnet: 3, born: 0, birthClusters: 0 });
  });

  it('counts the birth shape: fresh Articles proposed into one new Story', () => {
    const e = evaluateProposal(
      deadlockFixture(),
      proposal({
        newStories: [{ key: 'k1' }],
        assignments: [
          { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
          { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
          { articleId: 'a3', newStoryKey: 'k1', confidence: 0.9 },
          { articleId: 'a4', storyId: MAGNET, confidence: 0.9 },
        ],
      }),
    );
    expect(e.deadlock).toEqual({ toMagnet: 1, born: 3, birthClusters: 1 });
  });

  it('does not count a singleton new-Story key as a birth (ADR-0015)', () => {
    const e = evaluateProposal(
      deadlockFixture(),
      proposal({
        newStories: [{ key: 'k1' }],
        assignments: [
          { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
          { articleId: 'a2', storyId: MAGNET, confidence: 0.9 },
          { articleId: 'a3', storyId: 'aaaa00000002', confidence: 0.9 },
        ],
      }),
    );
    // a3 lands on another live Story: not the magnet, not a birth — the
    // standard metrics and splits carry it.
    expect(e.deadlock).toEqual({ toMagnet: 1, born: 0, birthClusters: 0 });
  });

  it('ignores assignments to ids outside the fresh pool', () => {
    const e = evaluateProposal(
      deadlockFixture(),
      proposal({
        assignments: [{ articleId: 'ghost', storyId: MAGNET, confidence: 0.9 }],
      }),
    );
    expect(e.deadlock).toEqual({ toMagnet: 0, born: 0, birthClusters: 0 });
  });

  it('computes no deadlock metrics on the standard fixtures', () => {
    const e = evaluateProposal(fixture(), proposal());
    expect(e.deadlock).toBeUndefined();
  });
});
