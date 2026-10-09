import { describe, expect, it, vi } from 'vitest';
import type { MembershipChecker } from './decision-model.ts';
import { MembershipGate } from './membership-gate.ts';

function checker(
  answers: string[] | Error,
  calls: { story: string; article: string }[] = [],
): MembershipChecker {
  let i = 0;
  return {
    label: 'FakeJev',
    async belongs(story, article) {
      calls.push({ story: story.title, article: article.headline });
      if (answers instanceof Error) throw answers;
      const answer = answers[i++];
      if (answer === undefined)
        throw new Error('FakeJev: more checks than scripted answers');
      return answer as 'yes' | 'no' | 'failed';
    },
  };
}

const story = { title: 'Story', section: undefined };
const article = { id: 'a1', headline: 'Headline' };

describe('MembershipGate', () => {
  it('returns the checker verdict and counts the check', async () => {
    const calls: { story: string; article: string }[] = [];
    const gate = new MembershipGate({
      checker: checker(['yes', 'no'], calls),
    });
    expect(
      await gate.ask({ target: 's1', story, article, teaser: '', label: 'x' }),
    ).toBe('yes');
    expect(
      await gate.ask({ target: 's2', story, article, teaser: '', label: 'x' }),
    ).toBe('no');
    expect(calls).toHaveLength(2);
    expect(gate.checksUsed).toBe(2);
  });

  it('deduplicates a (article, target) pair: one check, cached verdict', async () => {
    const calls: { story: string; article: string }[] = [];
    const gate = new MembershipGate({
      checker: checker(['yes'], calls),
    });
    const first = await gate.ask({
      target: 's1',
      story,
      article,
      teaser: '',
      label: 'x',
    });
    const second = await gate.ask({
      target: 's1',
      story,
      article,
      teaser: '',
      label: 'x',
    });
    expect(first).toBe('yes');
    expect(second).toBe('yes');
    expect(calls).toHaveLength(1);
    expect(gate.checksUsed).toBe(1);
  });

  it('a thrown check is a failed verdict and a failure — but still counts', async () => {
    const gate = new MembershipGate({
      checker: checker(new Error('HTTP 503: down')),
    });
    const verdict = await gate.ask({
      target: 's1',
      story,
      article,
      teaser: '',
      label: 'x',
    });
    expect(verdict).toBe('failed');
    expect(gate.checksUsed).toBe(1);
    expect(gate.allAttemptsFailed).toBe(true);
  });

  it('a failed verdict from the checker is a failure, not a no', async () => {
    const gate = new MembershipGate({
      checker: checker(['failed']),
    });
    expect(
      await gate.ask({ target: 's1', story, article, teaser: '', label: 'x' }),
    ).toBe('failed');
    expect(gate.allAttemptsFailed).toBe(true);
  });

  it('allAttemptsFailed is false when some checks answered', async () => {
    const gate = new MembershipGate({
      checker: checker(['yes', 'failed']),
    });
    await gate.ask({ target: 's1', story, article, teaser: '', label: 'x' });
    await gate.ask({ target: 's2', story, article, teaser: '', label: 'x' });
    expect(gate.allAttemptsFailed).toBe(false);
  });

  it('allAttemptsFailed is false before any check was attempted', () => {
    const gate = new MembershipGate({ checker: checker([]) });
    expect(gate.allAttemptsFailed).toBe(false);
  });

  it('verdict() reads a recorded verdict back without asking', async () => {
    const calls: { story: string; article: string }[] = [];
    const gate = new MembershipGate({
      checker: checker(['yes'], calls),
    });
    await gate.ask({ target: 's1', story, article, teaser: '', label: 'x' });
    expect(gate.verdict('a1', 's1')).toBe('yes');
    expect(gate.verdict('a1', 's9')).toBeUndefined();
    expect(calls).toHaveLength(1);
  });

  it('warns through the console on a thrown check', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const gate = new MembershipGate({
      checker: checker(new Error('HTTP 503: down')),
    });
    await gate.ask({
      target: 's1',
      story,
      article,
      teaser: '',
      label: 'Seed check failed: a1 → s1',
    });
    expect(warn).toHaveBeenCalledWith(
      'Seed check failed: a1 → s1: HTTP 503: down',
    );
    warn.mockRestore();
  });

  it('any number of distinct pairs is checked — no per-build budget (ADR-0012)', async () => {
    const gate = new MembershipGate({
      checker: checker(Array.from({ length: 50 }, () => 'yes')),
    });
    for (let i = 0; i < 50; i++)
      expect(
        await gate.ask({
          target: `s${i}`,
          story,
          article,
          teaser: '',
          label: 'x',
        }),
      ).toBe('yes');
    expect(gate.checksUsed).toBe(50);
  });
});
