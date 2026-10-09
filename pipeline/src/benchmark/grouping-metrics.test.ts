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
    titleUpdates: [],
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
        newStories: [{ key: 'k1', title: 'Réactions syndicales' }],
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
        newStories: [{ key: 'k1', title: 'Maricarmen à Paris' }],
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
        newStories: [{ key: 'k1', title: 'Annulation surprise' }],
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
        newStories: [{ key: 'k1', title: 'Retraites : la loi promulguée' }],
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
        newStories: [{ key: 'k1', title: 'Maricarmen à Paris' }],
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
        newStories: [{ key: 'k1', title: 'Réactions syndicales' }],
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
        newStories: [{ key: 'k1', title: 'Fourre-tout' }],
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
