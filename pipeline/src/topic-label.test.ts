import { describe, expect, it } from 'vitest';
import { topicLabel } from './topic-label.ts';

describe('topicLabel (ADR-0024)', () => {
  // Mirror of the production call (resolveTopics): the pool is the founding
  // Story (on disk) plus the confirming birth's headlines; the corpus is
  // every Story on disk — the pool's birth documents are NOT in it.
  it('picks the distinctive repeated pair, in source order, with accents', () => {
    const founder = [
      'Un adolescent tue quatre personnes dans une école de l’Oregon',
      'Quatre morts dans une fusillade dans une école de l’Oregon',
    ];
    const pool = [
      ...founder,
      'La mobilisation lycéenne entraîne des heurts',
      'La mobilisation lycéenne se poursuit en France',
      'Nouveaux heurts pendant la mobilisation lycéenne',
    ];
    const corpus = [
      founder.join(' '),
      'Un tireur fait plusieurs victimes dans une école',
      'Le pape subit une opération à Rome',
    ];
    expect(topicLabel(pool, corpus)).toBe('Mobilisation lycéenne');
  });

  it('a token the whole archive uses cannot win the label', () => {
    const pool = [
      'L’Assemblée nationale rejette la motion de censure',
      'La motion de censure contre le gouvernement adoptée',
    ];
    // « nationale » appears in every corpus document: near-zero rarity, and
    // the pair it belongs to loses to the repeated, rare one.
    const corpus = [
      ...pool,
      'L’Assemblée nationale adopte une loi',
      'Le Sénat et l’Assemblée nationale en désaccord',
    ];
    const label = topicLabel(pool, corpus);
    expect(label).not.toBe('Assemblée nationale');
    expect(label).toBe('Motion censure');
  });

  it('a proper noun keeps its capital, a common noun does not', () => {
    const pool = [
      'Un adolescent tue quatre personnes dans une école de l’Oregon',
      'Le tireur de la tuerie de l’Oregon était un ancien élève',
      'L’adolescent soupçonné après la tuerie de l’Oregon',
    ];
    const corpus = [
      [pool[0]].join(' '),
      'Le niveau d’alerte maximal déclenché en Asie',
      'Des brasiers incontrôlés à Sumatra génèrent des émanations',
    ];
    // The pair « tuerie Oregon » repeats and is rare; « Oregon » is always
    // capitalized in the pool, « tuerie » never is.
    expect(topicLabel(pool, corpus)).toBe('Tuerie Oregon');
  });

  it('falls back to the single best token when no pair exists', () => {
    expect(topicLabel(['Inflation'], ['Le budget défendu à l’Assemblée'])).toBe(
      'Inflation',
    );
    expect(topicLabel([], ['Le budget défendu à l’Assemblée'])).toBe('');
  });

  it('is deterministic: same input, same label', () => {
    const pool = [
      'La mobilisation lycéenne entraîne des heurts',
      'Les lycéens poursuivent leur mobilisation',
    ];
    const corpus = pool;
    expect(topicLabel(pool, corpus)).toBe(topicLabel(pool, corpus));
  });
});
