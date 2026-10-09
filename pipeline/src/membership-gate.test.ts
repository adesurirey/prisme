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
  it('returns the checker verdict and spends budget', async () => {
    const calls: { story: string; article: string }[] = [];
    const gate = new MembershipGate({
      checker: checker(['yes', 'no'], calls),
      budget: 5,
    });
    expect(
      await gate.ask({ target: 's1', story, article, teaser: '', label: 'x' }),
    ).toBe('yes');
    expect(
      await gate.ask({ target: 's2', story, article, teaser: '', label: 'x' }),
    ).toBe('no');
    expect(calls).toHaveLength(2);
    expect(gate.budgetLeft).toBe(3);
    expect(gate.checksUsed).toBe(2);
  });

  it('deduplicates a (article, target) pair: one check, cached verdict', async () => {
    const calls: { story: string; article: string }[] = [];
    const gate = new MembershipGate({
      checker: checker(['yes'], calls),
      budget: 5,
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

  it('throws when asked with no budget left', async () => {
    const gate = new MembershipGate({ checker: checker(['yes']), budget: 1 });
    await gate.ask({ target: 's1', story, article, teaser: '', label: 'x' });
    expect(gate.budgetLeft).toBe(0);
    await expect(
      gate.ask({ target: 's2', story, article, teaser: '', label: 'x' }),
    ).rejects.toThrow('budget');
  });

  it('a thrown check is a failed verdict and a failure — but still spends budget', async () => {
    const gate = new MembershipGate({
      checker: checker(new Error('HTTP 503: down')),
      budget: 5,
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
    expect(gate.budgetLeft).toBe(4);
    expect(gate.allAttemptsFailed).toBe(true);
  });

  it('a failed verdict from the checker is a failure, not a no', async () => {
    const gate = new MembershipGate({
      checker: checker(['failed']),
      budget: 5,
    });
    expect(
      await gate.ask({ target: 's1', story, article, teaser: '', label: 'x' }),
    ).toBe('failed');
    expect(gate.allAttemptsFailed).toBe(true);
  });

  it('allAttemptsFailed is false when some checks answered', async () => {
    const gate = new MembershipGate({
      checker: checker(['yes', 'failed']),
      budget: 5,
    });
    await gate.ask({ target: 's1', story, article, teaser: '', label: 'x' });
    await gate.ask({ target: 's2', story, article, teaser: '', label: 'x' });
    expect(gate.allAttemptsFailed).toBe(false);
  });

  it('allAttemptsFailed is false before any check was attempted', () => {
    const gate = new MembershipGate({ checker: checker([]), budget: 5 });
    expect(gate.allAttemptsFailed).toBe(false);
  });

  it('verdict() reads a recorded verdict back without asking', async () => {
    const calls: { story: string; article: string }[] = [];
    const gate = new MembershipGate({
      checker: checker(['yes'], calls),
      budget: 5,
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
      budget: 5,
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

  it('an infinite budget never exhausts', async () => {
    const gate = new MembershipGate({
      checker: checker(['yes', 'yes', 'yes']),
      budget: Infinity,
    });
    for (let i = 0; i < 3; i++)
      expect(
        await gate.ask({
          target: `s${i}`,
          story,
          article,
          teaser: '',
          label: 'x',
        }),
      ).toBe('yes');
    expect(gate.budgetLeft).toBe(Infinity);
  });
});
