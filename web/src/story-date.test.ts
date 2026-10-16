import { describe, expect, it } from 'vitest';
import { dayStamp, parisDayKey, parisTime } from './story-date';

describe('parisTime', () => {
  it('formats the clock as "18h45" on the Paris clock', () => {
    expect(parisTime(new Date('2026-10-07T16:45:00Z'))).toBe('18h45');
  });
});

describe('dayStamp', () => {
  it('says "aujourd’hui à" for today (Paris time)', () => {
    const now = new Date();
    expect(dayStamp(now)).toBe(`aujourd’hui à ${parisTime(now)}`);
  });

  it('says "hier à" for yesterday', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(dayStamp(yesterday)).toBe(`hier à ${parisTime(yesterday)}`);
  });

  it('gives the absolute date for an older day', () => {
    const d = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(dayStamp(d)).toBe(`le ${parisDayKey(d)} à ${parisTime(d)}`);
  });
});
