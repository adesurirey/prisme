import { wordKey } from './grouping.ts';

/**
 * A Topic's short display label (ADR-0024): two or three words that name the
 * thread without being an article title — Le Monde's « Mobilisation
 * lycéenne », not a headline. Deterministic, model-free, computed once at
 * Topic confirmation: the most distinctive repeated word pair of the
 * thread's own headlines, where distinctiveness is frequency in the thread
 * times rarity across the archive (document frequency of every Story's
 * title and headlines, one document per Story). The pair keeps its source
 * order — « Mobilisation lycéenne », never « Lycéenne mobilisation » — and
 * its accents from the most common surface form; a word is capitalized like
 * a proper noun only when the pool always capitalizes it. A too-generic
 * token (frequent everywhere in the archive) scores near zero, so labels
 * like « Annonce » cannot win. When no pair exists, the single best token
 * stands in.
 */

/** Words of a text as (key, surface) pairs in order: the key matches
 * tokens()' normalization, the surface keeps the original casing and
 * accents for display. */
function words(text: string): { key: string; surface: string }[] {
  const out: { key: string; surface: string }[] = [];
  for (const surface of text.split(/[^\p{L}\p{N}]+/u)) {
    const key = wordKey(surface);
    if (key != null) out.push({ key, surface });
  }
  return out;
}

const startsUpper = (surface: string): boolean =>
  surface[0] !== surface[0].toLowerCase();

/** Capitalize the first word; keep a later word capitalized only when the
 * pool always writes it capitalized (a proper noun). */
function display(surfaces: string[], alwaysUpper: boolean[]): string {
  return surfaces
    .map((surface, i) =>
      i === 0 || alwaysUpper[i]
        ? surface[0].toUpperCase() + surface.slice(1)
        : surface,
    )
    .join(' ');
}

export function topicLabel(pool: string[], corpus: string[]): string {
  const poolWords = pool.map((text) => words(text));

  // Document frequency across the archive: one Story is one document.
  const df = new Map<string, number>();
  for (const doc of corpus) {
    for (const key of new Set(words(doc).map((w) => w.key)))
      df.set(key, (df.get(key) ?? 0) + 1);
  }
  const docs = Math.max(corpus.length, 1);

  // Frequency and surface votes in the pool.
  const tf = new Map<string, number>();
  const surfaces = new Map<string, Map<string, number>>();
  for (const doc of poolWords) {
    for (const { key, surface } of doc) {
      tf.set(key, (tf.get(key) ?? 0) + 1);
      const votes = surfaces.get(key) ?? new Map<string, number>();
      votes.set(surface, (votes.get(surface) ?? 0) + 1);
      surfaces.set(key, votes);
    }
  }

  /** tf × rarity: a repeated-in-thread token that the archive rarely uses. */
  const score = (key: string): number =>
    (tf.get(key) ?? 0) * Math.log((docs + 1) / ((df.get(key) ?? 0) + 1));

  const bestSingle = (): string | undefined => {
    let best:
      | { key: string; score: number; tf: number; order: number }
      | undefined;
    let order = 0;
    for (const doc of poolWords) {
      for (const { key } of doc) {
        const candidate = {
          key,
          score: score(key),
          tf: tf.get(key) ?? 0,
          order: order++,
        };
        if (
          best == null ||
          candidate.score > best.score ||
          (candidate.score === best.score &&
            (candidate.tf > best.tf ||
              (candidate.tf === best.tf && candidate.order < best.order)))
        )
          best = candidate;
      }
    }
    return best?.key;
  };

  // The most distinctive adjacent pair, keeping source order: adjacent kept
  // words of one pool text. Sum of scores; ties by pair frequency, then by
  // first appearance — deterministic from the input alone.
  const pairCounts = new Map<
    string,
    { keys: [string, string]; tf: number; order: number }
  >();
  let pairOrder = 0;
  for (const doc of poolWords) {
    for (let i = 0; i + 1 < doc.length; i++) {
      const keys: [string, string] = [doc[i]!.key, doc[i + 1]!.key];
      const id = keys.join('\u0000');
      const counted = pairCounts.get(id);
      if (counted) counted.tf += 1;
      else pairCounts.set(id, { keys, tf: 1, order: pairOrder++ });
    }
  }
  let bestPair:
    | { keys: [string, string]; score: number; tf: number; order: number }
    | undefined;
  for (const counted of pairCounts.values()) {
    // Sum of the two tokens' scores, weighted by how often the thread
    // repeats the pair — a label names what the thread keeps saying.
    const pairScore =
      (score(counted.keys[0]) + score(counted.keys[1])) * counted.tf;
    if (
      bestPair == null ||
      pairScore > bestPair.score ||
      (pairScore === bestPair.score &&
        (counted.tf > bestPair.tf ||
          (counted.tf === bestPair.tf && counted.order < bestPair.order)))
    )
      bestPair = { ...counted, score: pairScore };
  }

  const labelOf = (keys: string[]): string => {
    const surfacesOf: string[] = [];
    const alwaysUpper: boolean[] = [];
    for (const key of keys) {
      const votes = surfaces.get(key);
      // Display surface: the pool's most common spelling of the token.
      surfacesOf.push(
        votes == null
          ? key
          : [...votes.entries()].sort((a, b) => b[1] - a[1])[0]![0],
      );
      // A proper noun: the pool always writes the token capitalized.
      alwaysUpper.push(votes != null && [...votes.keys()].every(startsUpper));
    }
    return display(surfacesOf, alwaysUpper);
  };

  if (bestPair == null) {
    const key = bestSingle();
    return key == null ? '' : labelOf([key]);
  }
  return labelOf([...bestPair.keys]);
}
