/**
 * Grouping-benchmark metrics (issue #41): computable without human labels,
 * from one model proposal against a fixture's pseudo-ground-truth.
 *
 * - coverage: every fresh Article assigned exactly once, to a target that
 *   resolves (a live Story id or a proposed new-Story key).
 * - dup-seed rate: proposed new Story whose seed (the Articles assigned to
 *   it) overlaps >50% content tokens with a live Story — the Maricarmen
 *   detector from the #38 measurements. The score matches the seed guard's:
 *   best Jaccard overlap with the live Story's title or any of its Article
 *   headlines.
 * - split rate: same-event Articles (same original Story in the snapshot)
 *   proposed into different final clusters.
 * - over-merge: pairs of Articles from different original Stories proposed
 *   into the same cluster — the mirror failure.
 * - stability (across two runs on the same fixture): Jaccard of the
 *   co-clustering pair sets.
 */

import type { GroupingProposal } from '../gemini.ts';
import {
  overlap as headlineOverlap,
  tokens as headlineTokens,
} from '../grouping.ts';
import type { FixtureStory, GroupingFixture } from './grouping-fixtures.ts';

/** The issue's dup-seed threshold: >50% content-token overlap. */
export const DUP_SEED_THRESHOLD = 0.5;

export interface DupSeedHit {
  newStoryKey: string;
  liveStoryId: string;
  liveStoryTitle: string;
  overlap: number;
  seedHeadline: string;
}

export interface CoverageMetrics {
  total: number;
  /** Articles with exactly one valid assignment. */
  covered: number;
  missing: string[];
  duplicated: string[];
  /** Assigned to a storyId not in the fixture or a newStoryKey not proposed. */
  unknownTarget: string[];
}

export interface ClusterMetrics {
  /** Ground-truth groups (≥2 fresh Articles) split across final clusters. */
  splitGroups: number;
  groundTruthGroups: number;
  /** Fresh-Article pairs co-clustered now but apart in the snapshot. */
  overMergedPairs: number;
  /** Fresh-Article pairs together in the snapshot and still together. */
  keptPairs: number;
  /** Fresh-Article pairs together in the snapshot, now apart. */
  splitPairs: number;
}

export interface Evaluation {
  coverage: CoverageMetrics;
  /** Empty for from-empty (no live Stories to duplicate). */
  dupSeeds: DupSeedHit[];
  clusters: ClusterMetrics;
  /** id → final cluster key ('story:<id>', 'new:<key>' or 'bad:…'). */
  finalCluster: Map<string, string>;
}

/**
 * Final cluster per fresh Article. Uncovered Articles get no entry; an
 * unresolvable target still gets one ("bad:" prefix — the model did cluster
 * them together) but shows up in coverage.unknownTarget.
 */
function finalClusters(
  fixture: GroupingFixture,
  proposal: GroupingProposal,
): { finalCluster: Map<string, string>; coverage: CoverageMetrics } {
  const liveIds = new Set(fixture.liveStories.map((s) => s.id));
  const newKeys = new Set(proposal.newStories.map((s) => s.key));
  const target = new Map<string, string>();
  const duplicated: string[] = [];
  const unknownTarget: string[] = [];
  for (const a of proposal.assignments) {
    // Resolution order: a live Story id wins; a newStoryKey next; a storyId
    // naming one of the model's own proposed new Stories is a recoverable
    // field slip (resolved to that new Story); anything else is a bad
    // target — flagged, but still clustered under its raw key.
    let key: string | null = null;
    let bad = false;
    if (a.storyId != null && liveIds.has(a.storyId)) {
      key = `story:${a.storyId}`;
    } else if (a.newStoryKey != null && newKeys.has(a.newStoryKey)) {
      key = `new:${a.newStoryKey}`;
    } else if (a.storyId != null && newKeys.has(a.storyId)) {
      key = `new:${a.storyId}`;
    } else if (a.storyId != null) {
      key = `bad:story:${a.storyId}`;
      bad = true;
    } else if (a.newStoryKey != null) {
      key = `bad:new:${a.newStoryKey}`;
      bad = true;
    }
    if (key == null) continue;
    if (bad) unknownTarget.push(a.articleId);
    if (target.has(a.articleId)) duplicated.push(a.articleId);
    else target.set(a.articleId, key);
  }
  const missing: string[] = [];
  for (const a of fixture.freshArticles) {
    if (!target.has(a.id)) missing.push(a.id);
  }
  const covered =
    fixture.freshArticles.length - missing.length - unknownTarget.length;
  return {
    finalCluster: target,
    coverage: {
      total: fixture.freshArticles.length,
      covered,
      missing,
      duplicated,
      unknownTarget,
    },
  };
}

/** Best seed-overlap of a proposed new Story against any live Story. */
function bestLiveOverlap(
  seedHeadlines: string[],
  live: FixtureStory[],
): { story: FixtureStory; overlap: number; seedHeadline: string } | null {
  let best: {
    story: FixtureStory;
    overlap: number;
    seedHeadline: string;
  } | null = null;
  const seedTokens = seedHeadlines.map((h) => headlineTokens(h));
  for (const story of live) {
    const targets = [
      headlineTokens(story.title),
      ...story.headlines.map((h) => headlineTokens(h)),
    ].filter((t) => t.size > 0);
    for (let i = 0; i < seedTokens.length; i++) {
      for (const t of targets) {
        const o = headlineOverlap(seedTokens[i], t);
        if (o > (best?.overlap ?? 0)) {
          best = {
            story,
            overlap: o,
            seedHeadline: seedHeadlines[i],
          };
        }
      }
    }
  }
  return best;
}

export function evaluateProposal(
  fixture: GroupingFixture,
  proposal: GroupingProposal,
): Evaluation {
  const { finalCluster, coverage } = finalClusters(fixture, proposal);

  // dup-seed: per proposed new Story, the best overlap of any assigned
  // Article against any live Story (title or Article headlines).
  const byNewKey = new Map<string, string[]>();
  for (const [id, key] of finalCluster) {
    if (key.startsWith('new:')) {
      const list = byNewKey.get(key.slice(4)) ?? [];
      list.push(id);
      byNewKey.set(key.slice(4), list);
    }
  }
  const headlineById = new Map(
    fixture.freshArticles.map((a) => [a.id, a.headline]),
  );
  const dupSeeds: DupSeedHit[] = [];
  for (const [key, ids] of byNewKey) {
    const best = bestLiveOverlap(
      ids.map((id) => headlineById.get(id) ?? ''),
      fixture.liveStories,
    );
    if (best && best.overlap > DUP_SEED_THRESHOLD) {
      dupSeeds.push({
        newStoryKey: key,
        liveStoryId: best.story.id,
        liveStoryTitle: best.story.title,
        overlap: best.overlap,
        seedHeadline: best.seedHeadline,
      });
    }
  }

  // clusters: ground-truth groups among the fresh batch.
  const byOriginal = new Map<string, string[]>();
  for (const a of fixture.freshArticles) {
    const origin = fixture.groundTruth[a.id];
    if (origin == null) continue;
    const list = byOriginal.get(origin) ?? [];
    list.push(a.id);
    byOriginal.set(origin, list);
  }
  let splitGroups = 0;
  let groundTruthGroups = 0;
  let keptPairs = 0;
  let splitPairs = 0;
  for (const ids of byOriginal.values()) {
    if (ids.length < 2) continue;
    groundTruthGroups++;
    const clusters = ids.map((id) => finalCluster.get(id));
    const distinct = new Set(clusters);
    if (distinct.size > 1) splitGroups++;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (clusters[i] === clusters[j] && clusters[i] != null) keptPairs++;
        else splitPairs++;
      }
    }
  }
  // over-merge: pairs from different original Stories now co-clustered.
  const clusterMembers = new Map<string, string[]>();
  for (const [id, key] of finalCluster) {
    const list = clusterMembers.get(key) ?? [];
    list.push(id);
    clusterMembers.set(key, list);
  }
  let overMergedPairs = 0;
  for (const ids of clusterMembers.values()) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const oi = fixture.groundTruth[ids[i]];
        const oj = fixture.groundTruth[ids[j]];
        if (oi != null && oj != null && oi !== oj) overMergedPairs++;
      }
    }
  }

  return {
    coverage,
    dupSeeds,
    clusters: {
      splitGroups,
      groundTruthGroups,
      overMergedPairs,
      keptPairs,
      splitPairs,
    },
    finalCluster,
  };
}

/**
 * Stability between two proposals on the same fixture: Jaccard of the
 * co-clustering pair sets (pairs together in run A vs run B).
 */
export function stability(a: Evaluation, b: Evaluation): number | null {
  const pairs = (e: Evaluation): Set<string> => {
    const members = new Map<string, string[]>();
    for (const [id, key] of e.finalCluster) {
      const list = members.get(key) ?? [];
      list.push(id);
      members.set(key, list);
    }
    const out = new Set<string>();
    for (const ids of members.values()) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          out.add(
            ids[i] < ids[j] ? `${ids[i]}|${ids[j]}` : `${ids[j]}|${ids[i]}`,
          );
        }
      }
    }
    return out;
  };
  const pa = pairs(a);
  const pb = pairs(b);
  if (pa.size === 0 && pb.size === 0) return null;
  let shared = 0;
  for (const p of pa) if (pb.has(p)) shared++;
  return shared / (pa.size + pb.size - shared);
}
