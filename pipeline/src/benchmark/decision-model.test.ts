import { describe, expect, it } from 'vitest';
import { parseAnswers, QUESTIONS } from '../decision-model.ts';

describe('parseAnswers', () => {
  it('extracts valid kind and section with probabilities', () => {
    const parsed = parseAnswers({
      kind: { type: 'choice', choice: 'news', probabilities: { news: 0.9 }, confidence: 0.9 },
      section: { type: 'choice', choice: 'politics', probabilities: { politics: 0.8 } },
    });
    expect(parsed).toEqual({
      kind: 'news',
      section: 'politics',
      kindProbabilities: { news: 0.9 },
      sectionProbabilities: { politics: 0.8 },
    });
  });

  it('returns null for out-of-list answers', () => {
    expect(parseAnswers({ kind: { choice: 'article' }, section: { choice: 'politics' } })).toBeNull();
    expect(parseAnswers({ kind: { choice: 'news' }, section: { choice: 'economie' } })).toBeNull();
  });

  it('ignores an invalid section answer for not_news', () => {
    const parsed = parseAnswers({ kind: { choice: 'not_news' }, section: { choice: 'economie' } });
    expect(parsed).toMatchObject({ kind: 'not_news', section: null });
    expect(parseAnswers({ kind: { choice: 'not_news' } })).toMatchObject({ kind: 'not_news', section: null });
  });

  it('returns null when an answer is missing or malformed', () => {
    expect(parseAnswers({ kind: { choice: 'news' } })).toBeNull();
    expect(parseAnswers({})).toBeNull();
    expect(parseAnswers(null)).toBeNull();
    expect(parseAnswers('oops')).toBeNull();
  });

  it('sends one request with both questions', () => {
    expect(Object.keys(QUESTIONS).sort()).toEqual(['kind', 'section']);
    expect(Object.keys(QUESTIONS.kind.criteria).sort()).toEqual([
      'live',
      'news',
      'not_news',
      'opinion',
    ]);
    expect(Object.keys(QUESTIONS.section.criteria)).toHaveLength(9);
  });
});