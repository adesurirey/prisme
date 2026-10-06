import { describe, expect, it } from 'vitest';
import { parseMembershipAnswer } from './decision-model.ts';

describe('parseMembershipAnswer', () => {
  it('answers yes when the Article belongs to the Story', () => {
    expect(
      parseMembershipAnswer({ belongs: { type: 'choice', choice: 'yes' } }),
    ).toBe(true);
  });

  it('answers no when it does not', () => {
    expect(
      parseMembershipAnswer({ belongs: { type: 'choice', choice: 'no' } }),
    ).toBe(false);
  });

  it('returns null for a missing or out-of-list answer', () => {
    expect(parseMembershipAnswer({})).toBeNull();
    expect(parseMembershipAnswer({ belongs: { choice: 'maybe' } })).toBeNull();
    expect(parseMembershipAnswer(null)).toBeNull();
    expect(parseMembershipAnswer('nonsense')).toBeNull();
  });
});