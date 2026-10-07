import { describe, expect, it } from 'vitest';
import {
  type BenchmarkCandidate,
  isSuspect,
  sampleForBenchmark,
} from './sample.ts';

function candidate(overrides: Partial<BenchmarkCandidate>): BenchmarkCandidate {
  return {
    id: 'x1',
    outletId: 'lemonde',
    feed: 'une',
    url: 'https://lemonde.fr/a/1',
    headline: "Une loi votée à l'Assemblée",
    teaser: 'Le texte a été adopté hier.',
    ...overrides,
  };
}

describe('isSuspect', () => {
  it('flags horoscope, live and tribune patterns in url, headline or teaser', () => {
    expect(isSuspect(candidate({ url: 'https://lemonde.fr/horoscope/' }))).toBe(
      true,
    );
    expect(
      isSuspect(candidate({ headline: 'Suivez notre direct sur le vote' })),
    ).toBe(true);
    expect(isSuspect(candidate({ teaser: 'Notre tribune hebdomadaire' }))).toBe(
      true,
    );
  });

  it('does not flag ordinary news', () => {
    expect(isSuspect(candidate({}))).toBe(false);
  });
});

describe('sampleForBenchmark', () => {
  const many = (
    outletId: string,
    n: number,
    prefix: string,
  ): BenchmarkCandidate[] =>
    Array.from({ length: n }, (_, i) =>
      candidate({
        id: `${prefix}${i}`,
        outletId,
        url: `https://${outletId}.fr/${prefix}/${i}`,
      }),
    );

  it('returns the same sample for the same seed', () => {
    const candidates = [...many('a', 30, 'a'), ...many('b', 30, 'b')];
    const options = { seed: 42, generalCount: 10, suspectCount: 0 };
    expect(sampleForBenchmark(candidates, options)).toEqual(
      sampleForBenchmark(candidates, options),
    );
  });

  it('stratifies the general pool round-robin across Outlets', () => {
    const candidates = [
      ...many('a', 30, 'a'),
      ...many('b', 30, 'b'),
      ...many('c', 30, 'c'),
    ];
    const sample = sampleForBenchmark(candidates, {
      seed: 7,
      generalCount: 9,
      suspectCount: 0,
    });
    const perOutlet = new Map<string, number>();
    for (const item of sample)
      perOutlet.set(item.outletId, (perOutlet.get(item.outletId) ?? 0) + 1);
    expect([...perOutlet.values()]).toEqual([3, 3, 3]);
  });

  it('oversamples suspects from otherwise plain-news feeds', () => {
    const candidates = [...many('a', 30, 'a')];
    candidates.push(candidate({ id: 'h1', url: 'https://a.fr/horoscope/' }));
    candidates.push(candidate({ id: 'h2', url: 'https://a.fr/jeux/quiz' }));
    const sample = sampleForBenchmark(candidates, {
      seed: 7,
      generalCount: 5,
      suspectCount: 2,
    });
    expect(
      sample
        .filter((s) => s.suspect)
        .map((s) => s.id)
        .sort(),
    ).toEqual(['h1', 'h2']);
  });

  it('keeps suspects out of the general pool', () => {
    const candidates = [...many('a', 6, 'a')];
    candidates.push(candidate({ id: 'h1', url: 'https://a.fr/direct/' }));
    const sample = sampleForBenchmark(candidates, {
      seed: 7,
      generalCount: 6,
      suspectCount: 1,
    });
    const general = sample.filter((s) => !s.suspect);
    expect(general).toHaveLength(6);
    expect(general.every((s) => s.id !== 'h1')).toBe(true);
  });

  it('dedupes by id before sampling', () => {
    const candidates = [...many('a', 3, 'a')];
    candidates.push({ ...candidates[0] });
    const sample = sampleForBenchmark(candidates, {
      seed: 7,
      generalCount: 10,
      suspectCount: 0,
    });
    expect(sample).toHaveLength(3);
  });

  it('returns what exists when pools are too small', () => {
    const sample = sampleForBenchmark(many('a', 2, 'a'), {
      seed: 7,
      generalCount: 10,
      suspectCount: 0,
    });
    expect(sample).toHaveLength(2);
  });
});
