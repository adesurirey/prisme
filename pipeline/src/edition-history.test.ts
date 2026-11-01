import type { Story } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import { slugsToDelete } from './cleanup.ts';
import { updateEditionHistory } from './edition-history.ts';
import { assembleEdition } from './ranking.ts';

const NOW = new Date('2026-10-06T11:00:00Z');

/**
 * The Edition history (issue #75): `everInEdition` is a sticky Story-level
 * flag — true the moment a Story ranks into a capped Edition sort
 * (Brûlant or Top — never Nouveau, spec #158), never unset, so the flag
 * survives the Story's freezing and the never-entered deletion rule
 * (cleanup.ts) keeps working. A frozen Story that ranks into a capped
 * sort is stamped too (ADR-0027: windows span frozen Stories); a frozen
 * non-member is passed through untouched — its content is never edited
 * (ADR-0005).
 */

function story(id: string, slug = id, hoursAgo = 1): Story {
  return {
    id,
    slug,
    title: 'Sujet',
    createdAt: '2026-10-06T10:00:00Z',
    storyDay: '2026-10-06',
    articles: [
      {
        id,
        outletId: 'lemonde',
        headline: `Titre ${id}`,
        url: `https://lemonde.fr/a/${id}`,
        publishedAt: new Date(
          NOW.getTime() - hoursAgo * 60 * 60 * 1000,
        ).toISOString(),
        frontPage: false,
      },
    ],
  };
}

describe('updateEditionHistory', () => {
  it('sets the flag on Edition members', () => {
    const s = story('s1');
    const result = updateEditionHistory([s], new Set(['s1']), NOW);
    expect(result.stories[0].everInEdition).toBe(true);
    expect(result.changed).toEqual(new Set(['s1']));
  });

  it('keeps the flag on members not in this Edition', () => {
    const s = story('s1');
    s.everInEdition = true;
    const result = updateEditionHistory([s], new Set(), NOW);
    expect(result.stories[0].everInEdition).toBe(true);
    expect(result.changed.size).toBe(0);
  });

  it('leaves unflagged non-members untouched (absent flag equals false)', () => {
    const s = story('s1');
    const result = updateEditionHistory([s], new Set(), NOW);
    expect(result.stories[0].everInEdition).toBeUndefined();
    expect(result.changed.size).toBe(0);
  });

  it('never touches a frozen Story that is not a window member', () => {
    const s = story('s1', 's1', 30);
    const result = updateEditionHistory([s], new Set(), NOW);
    expect(result.stories[0].everInEdition).toBeUndefined();
    expect(result.changed.size).toBe(0);
  });

  it('stamps a frozen Story that ranks into a window, so cleanup keeps its file (spec #121 review)', () => {
    // A > 24h pipeline outage can birth-and-freeze a Story no build ever
    // saw live; its newest Article (3 days old) still ranks it into a
    // window — the Story is linked on an Edition page this build.
    const s = story('s1', 's1', 72);
    const result = updateEditionHistory([s], new Set(['s1']), NOW);
    expect(result.stories[0].everInEdition).toBe(true);
    expect(result.changed).toEqual(new Set(['s1']));
    expect(slugsToDelete(result.stories, NOW).size).toBe(0);
  });

  it('leaves a frozen never-ranked Story outside both windows unstamped — cleanup still deletes it', () => {
    const s = story('s1', 's1', 8 * 24);
    const result = updateEditionHistory([s], new Set(), NOW);
    expect(result.stories[0].everInEdition).toBeUndefined();
    expect(slugsToDelete(result.stories, NOW)).toEqual(new Set(['s1']));
  });

  it('does not mutate the input Stories', () => {
    const s = story('s1');
    const original = structuredClone(s);
    updateEditionHistory([s], new Set(['s1']), NOW);
    expect(s).toEqual(original);
  });
});

/**
 * The narrowed stamp set (spec #158): exactly the capped Brûlant ∪ Top
 * members — never Nouveau, never the uncapped pool tail. These tests
 * compose the two pure functions as run.ts does (assembleEdition, then
 * the stamp set, then updateEditionHistory) — the decisions, not the
 * wiring.
 */
describe('updateEditionHistory — the capped stamp set (spec #158)', () => {
  /** Thirty one-Outlet Stories founded three hours ago: pool members and
   * Nouveau members, tied on every key term, ordered by id asc — the cap
   * keeps the last five out of both ranked sorts. */
  const thirtyFresh = (): Story[] =>
    Array.from({ length: 30 }, (_, i) => {
      const id = `s${String(i).padStart(2, '0')}`;
      const publishedAt = new Date(
        NOW.getTime() - 3 * 60 * 60 * 1000,
      ).toISOString();
      const base = story(id);
      return {
        ...base,
        createdAt: publishedAt,
        articles: [{ ...base.articles[0], publishedAt }],
      };
    });

  it('never stamps the Story ranked 26th — the cap, not pool membership, stamps', () => {
    const stories = thirtyFresh();
    // The stamp set exactly as run.ts derives it: the capped sorts' union.
    const ranked = assembleEdition(stories, NOW);
    const stampSet = new Set([...ranked.hot, ...ranked.top].map((s) => s.id));
    expect(stampSet.size).toBe(25);
    const result = updateEditionHistory(stories, stampSet, NOW);
    expect(result.changed.size).toBe(25); // exactly the capped members
    const unstamped = result.stories.filter((s) => !stampSet.has(s.id));
    expect(unstamped).toHaveLength(5);
    // Pool members — reported inside the window — but below both caps:
    // unstamped, like every Story the capped pages never showed.
    for (const s of unstamped) expect(s.everInEdition).toBeUndefined();
  });

  it('never stamps a Nouveau-only Story: membership of Nouveau is not ranking', () => {
    const stories = thirtyFresh();
    const ranked = assembleEdition(stories, NOW);
    const stampSet = new Set([...ranked.hot, ...ranked.top].map((s) => s.id));
    const nouveauIds = new Set(ranked.new.map((s) => s.id));
    expect(nouveauIds.size).toBe(30);
    const result = updateEditionHistory(stories, stampSet, NOW);
    // Every Story ranked 26th-or-below is a Nouveau member (all thirty
    // were founded three hours ago) — and stays unstamped: only the
    // capped Brûlant ∪ Top members stamp, never Nouveau.
    for (const s of result.stories) {
      if (!stampSet.has(s.id)) {
        expect(nouveauIds.has(s.id)).toBe(true);
        expect(s.everInEdition).toBeUndefined();
      }
    }
  });

  it('deletes a frozen never-stamped Story: the 26th frozen below the cap goes', () => {
    // Thirty Stories frozen below the cap — founded 25 h ago, last report
    // 13 h ago (Ingestion window closed an hour before NOW) yet still pool
    // members (that report is inside the 24 h window): unstamped by the
    // narrowed set, deleted by the cleanup. The 25 capped members survive.
    const founding = new Date(NOW.getTime() - 25 * 60 * 60 * 1000);
    const newest = new Date(NOW.getTime() - 13 * 60 * 60 * 1000);
    const stories = thirtyFresh().map((s) => ({
      ...s,
      createdAt: founding.toISOString(),
      articles: [
        { ...s.articles[0], publishedAt: founding.toISOString() },
        {
          ...s.articles[0],
          id: `${s.id}-new`,
          outletId: 'lemonde2',
          publishedAt: newest.toISOString(),
        },
      ],
    }));
    const ranked = assembleEdition(stories, NOW);
    const stampSet = new Set([...ranked.hot, ...ranked.top].map((s) => s.id));
    expect(stampSet.size).toBe(25);
    const result = updateEditionHistory(stories, stampSet, NOW);
    const below = result.stories.filter((s) => !stampSet.has(s.id));
    expect(below).toHaveLength(5);
    expect(slugsToDelete(result.stories, NOW)).toEqual(
      new Set(below.map((s) => s.slug)),
    );
  });
});
