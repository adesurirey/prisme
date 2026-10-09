import { describe, expect, it } from 'vitest';
import { parseGroupingResponse } from '../gemini.ts';
import { firstJsonObject } from './grouping-models.ts';

const acceptsProposal = (s: string) => parseGroupingResponse(s) != null;

describe('firstJsonObject (junk-wrapped responses, issue #41)', () => {
  it('a bare {} junk prefix does not swallow the payload', () => {
    const t = `{} {"newStories":[{"key":"a","title":"T"}],"assignments":[],"titleUpdates":[]}`;
    expect(JSON.parse(firstJsonObject(t, acceptsProposal)!)).toMatchObject({
      newStories: [{ key: 'a' }],
    });
  });

  it('lands on the give-up empty proposal after reasoning prose', () => {
    const t = `300+; impossible token. no time. {"newStories":[],"assignments":[],"titleUpdates":[]}`;
    expect(firstJsonObject(t, acceptsProposal)).not.toBeNull();
  });

  it('skips prose containing stray braces', () => {
    const t = `use { and } tokens {"newStories":[],"assignments":[],"titleUpdates":[]}`;
    expect(firstJsonObject(t, acceptsProposal)).not.toBeNull();
  });

  it('braces inside strings do not break the balance scan', () => {
    const t = `{"newStories":[{"key":"a{b","title":"}"}],"assignments":[],"titleUpdates":[]}`;
    expect(firstJsonObject(t, acceptsProposal)).not.toBeNull();
  });

  it('returns null when no object is acceptable', () => {
    expect(
      firstJsonObject('{"newStories":[{broken', acceptsProposal),
    ).toBeNull();
  });

  it('the default validator accepts any parseable JSON', () => {
    expect(firstJsonObject('noise {"a":1} tail')).toBe('{"a":1}');
  });
});
