import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isTotalFailure,
  missingMembershipChecker,
  resolveModels,
} from './policy.ts';

const ENV = { GEMINI_API_KEY: 'g', OPENROUTER_API_KEY: 'o' };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveModels', () => {
  it('fails the build up front when GEMINI_API_KEY is missing (ADR-0005, as amended)', () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('OPENROUTER_API_KEY', 'o');
    expect(() => resolveModels()).toThrow(/GEMINI_API_KEY is not set/);
  });

  it('with both keys, every consumer gets a live model', () => {
    vi.stubEnv('GEMINI_API_KEY', 'g');
    vi.stubEnv('OPENROUTER_API_KEY', 'o');
    const models = resolveModels();
    expect(models.grouping).toBeTruthy();
    expect(models.membership).toBeTruthy();
    expect(models.decision.model).toBeTruthy();
    expect(models.decision.note).toBeUndefined();
    expect(models.summaries).toBeTruthy();
    expect(models.maxChecks).toBeUndefined();
  });

  it('without OPENROUTER_API_KEY the Decision model degrades and the Membership check is the declared fail-when-pending adapter', () => {
    vi.stubEnv('GEMINI_API_KEY', 'g');
    vi.stubEnv('OPENROUTER_API_KEY', '');
    const models = resolveModels();
    expect(models.decision.model).toBeNull();
    expect(models.decision.note).toMatch(/OPENROUTER_API_KEY not set/);
    expect(models.membership.label).toBe(missingMembershipChecker().label);
    expect(models.grouping).toBeTruthy();
    expect(models.summaries).toBeTruthy();
  });

  it('PRISME_MAX_CHECKS=all lifts the budget; a number overrides the default; junk is ignored', () => {
    vi.stubEnv('GEMINI_API_KEY', 'g');
    vi.stubEnv('OPENROUTER_API_KEY', 'o');
    vi.stubEnv('PRISME_MAX_CHECKS', 'all');
    expect(resolveModels().maxChecks).toBe(Infinity);
    vi.stubEnv('PRISME_MAX_CHECKS', '5');
    expect(resolveModels().maxChecks).toBe(5);
    vi.stubEnv('PRISME_MAX_CHECKS', 'bogus');
    expect(resolveModels().maxChecks).toBeUndefined();
  });
});

describe('missingMembershipChecker', () => {
  it('every attempt fails, so the gate total-failure rule fires only when checks were pending', async () => {
    const checker = missingMembershipChecker();
    await expect(
      checker.belongs({ title: 'S' }, { headline: 'H', teaser: '' }),
    ).rejects.toThrow('Membership checker unavailable');
  });
});

describe('isTotalFailure', () => {
  it('is true only when checks were attempted and not a single one answered', () => {
    expect(isTotalFailure(0, 0)).toBe(false);
    expect(isTotalFailure(3, 3)).toBe(true);
    expect(isTotalFailure(3, 2)).toBe(false);
    expect(isTotalFailure(0, 3)).toBe(false);
  });
});
