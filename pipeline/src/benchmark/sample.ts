/**
 * Sampler for the decision-model benchmark (issue #4).
 *
 * Strategy (settled in the #4 grilling): ~100 pairs, stratified across
 * Outlets and feed types, with rare kinds oversampled by a URL/headline
 * heuristic ("suspects": horoscopes, games, live blogs, tribunes…). A naive
 * last-24h sample would be ~95% plain news and tell us little. Labeling is
 * blind: nothing here looks at any model output.
 */

/** One candidate pair from a feed. Teaser stays in memory only (ADR-0003). */
export interface BenchmarkCandidate {
  /** Stable across editions: hash of the canonical URL (see collect.ts). */
  id: string;
  outletId: string;
  feed: string;
  url: string;
  headline: string;
  teaser: string;
}

export interface SampledItem extends BenchmarkCandidate {
  /** True when picked by the rare-kind heuristic rather than the general pool. */
  suspect: boolean;
}

export interface SampleOptions {
  seed: number;
  generalCount: number;
  suspectCount: number;
}

/** URL/headline patterns that hint at non-news or live/Opinion-piece kinds. */
const SUSPECT_PATTERNS =
  /(horoscope|m[eé]t[eé]o|\bjeux?\b|quiz|mots (croisés|fléchés)|sudoku|recette|astro|en direct|\bdirect\b|\blive\b|blog|tribune|[ée]dito|opinion|op-ed|pronostic|bons plans|concours|shopping|programme (tv|t[ée]l[ée])|tests? et |solutions? et indices)/i;

export function isSuspect(candidate: BenchmarkCandidate): boolean {
  return (
    SUSPECT_PATTERNS.test(candidate.url) ||
    SUSPECT_PATTERNS.test(candidate.headline) ||
    SUSPECT_PATTERNS.test(candidate.teaser)
  );
}

/**
 * Deterministic seeded PRNG (mulberry32): same seed, same sample, so the
 * benchmark is reproducible from the labels file alone.
 */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Dedupe by id (an Article can appear in several feeds), then fill two pools:
 * general candidates stratified round-robin across Outlets, and suspects.
 */
export function sampleForBenchmark(
  candidates: BenchmarkCandidate[],
  options: SampleOptions,
): SampledItem[] {
  const byId = new Map<string, BenchmarkCandidate>();
  for (const candidate of candidates) {
    if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
  }

  const rng = prng(options.seed);
  const suspects: SampledItem[] = [];
  const generalByOutlet = new Map<string, BenchmarkCandidate[]>();

  for (const candidate of byId.values()) {
    if (isSuspect(candidate)) {
      suspects.push({ ...candidate, suspect: true });
    } else {
      const pool = generalByOutlet.get(candidate.outletId) ?? [];
      pool.push(candidate);
      generalByOutlet.set(candidate.outletId, pool);
    }
  }

  // Round-robin across Outlets (sorted keys for determinism) so each Outlet
  // contributes to the general pool before any Outlet is drained twice over.
  const general: SampledItem[] = [];
  const pools = [...generalByOutlet.keys()].sort().map((outletId) => ({
    outletId,
    items: shuffle(generalByOutlet.get(outletId)!, rng),
  }));
  while (
    general.length < options.generalCount &&
    pools.some((p) => p.items.length > 0)
  ) {
    for (const pool of pools) {
      const item = pool.items.shift();
      if (item && general.length < options.generalCount)
        general.push({ ...item, suspect: false });
    }
  }

  const pickedSuspects = shuffle(suspects, rng).slice(0, options.suspectCount);
  return [...general, ...pickedSuspects];
}
