import { describe, expect, it } from 'vitest';
import { parseGroupingResponse } from './gemini.ts';

describe('parseGroupingResponse', () => {
  it('parses a well-formed proposal', () => {
    const proposal = parseGroupingResponse(
      JSON.stringify({
        newStories: [{ key: 'budget', title: 'Le Sénat adopte le budget' }],
        assignments: [
          { articleId: 'a1', storyId: 's1', confidence: 0.9 },
          { articleId: 'a2', newStoryKey: 'budget', confidence: 0.4 },
        ],
        titleUpdates: [{ storyId: 's1', title: 'Nouveau titre' }],
      }),
    );
    expect(proposal).not.toBeNull();
    expect(proposal!.newStories).toEqual([{ key: 'budget', title: 'Le Sénat adopte le budget' }]);
    expect(proposal!.assignments).toHaveLength(2);
    expect(proposal!.titleUpdates).toEqual([{ storyId: 's1', title: 'Nouveau titre' }]);
  });

  it('returns null for non-JSON text', () => {
    expect(parseGroupingResponse('not json at all')).toBeNull();
  });

  it('returns null when assignments is missing', () => {
    expect(parseGroupingResponse(JSON.stringify({ newStories: [] }))).toBeNull();
  });

  it('treats a wrong-typed confidence like an absent one (0)', () => {
    const proposal = parseGroupingResponse(
      JSON.stringify({
        newStories: [],
        assignments: [
          { articleId: 'a1', confidence: 0.8 },
          { storyId: 's1', confidence: 0.8 },
          { articleId: 'a2', confidence: 'high' },
          { articleId: 'a3', confidence: 0.7 },
        ],
      }),
    );
    expect(proposal!.assignments.map((a) => a.articleId)).toEqual(['a1', 'a2', 'a3']);
    expect(proposal!.assignments[1]!.confidence).toBe(0);
  });

  it('clamps confidence into [0, 1]', () => {
    const proposal = parseGroupingResponse(
      JSON.stringify({
        newStories: [],
        assignments: [
          { articleId: 'a1', confidence: 5 },
          { articleId: 'a2', confidence: -2 },
        ],
      }),
    );
    expect(proposal!.assignments[0]!.confidence).toBe(1);
    expect(proposal!.assignments[1]!.confidence).toBe(0);
  });

  it('treats confidence as 0 when absent', () => {
    const proposal = parseGroupingResponse(
      JSON.stringify({ newStories: [], assignments: [{ articleId: 'a1', storyId: 's1' }] }),
    );
    expect(proposal!.assignments[0]!.confidence).toBe(0);
  });

  it('drops new stories without a key or a non-empty title', () => {
    const proposal = parseGroupingResponse(
      JSON.stringify({
        newStories: [
          { key: 'k1', title: 'Titre' },
          { key: 'k2' },
          { key: '', title: 'Titre vide' },
          { title: 'Sans clé' },
        ],
        assignments: [],
      }),
    );
    expect(proposal!.newStories).toEqual([{ key: 'k1', title: 'Titre' }]);
  });

  it('drops malformed title updates', () => {
    const proposal = parseGroupingResponse(
      JSON.stringify({
        newStories: [],
        assignments: [],
        titleUpdates: [
          { storyId: 's1', title: 'Bon titre' },
          { storyId: 's2' },
          { title: 'Sans story' },
        ],
      }),
    );
    expect(proposal!.titleUpdates).toEqual([{ storyId: 's1', title: 'Bon titre' }]);
  });
});