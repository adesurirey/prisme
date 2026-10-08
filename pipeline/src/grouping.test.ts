import type { Article, Story } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import { groupStories } from './grouping.ts';

/** Deterministic 12-hex ids, so slug suffixes are predictable. */
function counter(): () => string {
  let n = 0;
  return () => String(++n).padStart(12, '0');
}

function article(id: string, overrides: Partial<Article> = {}): Article {
  return {
    id,
    outletId: 'lemonde',
    headline: `Titre ${id}`,
    url: `https://lemonde.fr/a/${id}`,
    publishedAt: '2026-10-06T10:00:00Z',
    frontPage: true,
    ...overrides,
  };
}

function story(overrides: Partial<Story> = {}): Story {
  return {
    id: 's1',
    slug: 'story-un',
    title: 'Story un',
    createdAt: '2026-10-06T09:00:00Z',
    articles: [],
    ...overrides,
  };
}

const NOW = new Date('2026-10-06T12:00:00Z');
const NO_CLIENTS = { grouping: null, membership: null };

function fakeGrouping(
  proposal: import('./gemini.ts').GroupingProposal | null,
  calls: {
    input?: Parameters<import('./gemini.ts').GroupingModel['group']>[0];
  }[] = [],
): import('./gemini.ts').GroupingModel {
  return {
    label: 'Fake',
    model: 'fake',
    async group(input) {
      calls.push({ input });
      return proposal;
    },
  };
}

function fakeMembership(
  answer: boolean | null,
  calls: { story?: string; article?: string }[] = [],
): import('./decision-model.ts').MembershipChecker {
  return {
    label: 'FakeJev',
    async belongs(story, article) {
      calls.push({ story: story.title, article: article.headline });
      return answer;
    },
  };
}

function input(overrides: {
  articles?: Article[];
  existing?: Story[];
  teasers?: Map<string, string>;
  clients?: {
    grouping: import('./gemini.ts').GroupingModel | null;
    membership: import('./decision-model.ts').MembershipChecker | null;
  };
  makeId?: () => string;
}) {
  return {
    articles: overrides.articles ?? [],
    teasers: overrides.teasers ?? new Map<string, string>(),
    existing: overrides.existing ?? [],
    now: NOW,
    makeId: overrides.makeId ?? counter(),
    clients: overrides.clients ?? NO_CLIENTS,
  };
}

describe('groupStories', () => {
  it('an Article no Story claims, with no Grouping model, becomes its own Story', async () => {
    const outcome = await groupStories(input({ articles: [article('a1')] }));
    expect(outcome.stories).toHaveLength(1);
    const s = outcome.stories[0]!;
    expect(s.id).toBe('000000000001');
    expect(s.title).toBe('Titre a1');
    expect(s.slug).toBe('titre-a1');
    expect(s.createdAt).toBe(NOW.toISOString());
    expect(s.articles.map((a) => a.id)).toEqual(['a1']);
    expect(outcome.changed.has('titre-a1')).toBe(true);
    expect(outcome.live.map((s) => s.id)).toEqual(['000000000001']);
  });

  it('an assignment merges the Article into the live Story when the Membership check says yes', async () => {
    const existing = [
      story({
        articles: [article('a0', { publishedAt: '2026-10-06T11:00:00Z' })],
      }),
    ];
    const outcome = await groupStories(
      input({
        articles: [
          article('a0', { publishedAt: '2026-10-06T11:00:00Z' }),
          article('a1'),
        ],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [{ articleId: 'a1', storyId: 's1', confidence: 0.9 }],
            titleUpdates: [],
          }),
          membership: fakeMembership(true),
        },
      }),
    );
    const s = outcome.stories.find((s) => s.id === 's1')!;
    expect(s.articles.map((a) => a.id)).toEqual(['a0', 'a1']); // a0 is newer: newest first
    expect(outcome.changed.has('story-un')).toBe(true);
    expect(outcome.live.map((s) => s.id)).toEqual(['s1']);
  });

  it('a low-confidence match merges only when the Membership check says yes', async () => {
    const existing = [story({ articles: [article('a0')] })];
    const checkCalls: { story?: string; article?: string }[] = [];
    const outcome = await groupStories(
      input({
        articles: [article('a0'), article('a1')],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [{ articleId: 'a1', storyId: 's1', confidence: 0.5 }],
            titleUpdates: [],
          }),
          membership: fakeMembership(true, checkCalls),
        },
      }),
    );
    expect(
      outcome.stories.find((s) => s.id === 's1')!.articles.map((a) => a.id),
    ).toEqual(['a0', 'a1']);
    expect(checkCalls).toEqual([{ story: 'Story un', article: 'Titre a1' }]);
  });

  it('a low-confidence match splits when the Membership check says no', async () => {
    const existing = [story({ articles: [article('a0')] })];
    const outcome = await groupStories(
      input({
        articles: [article('a0'), article('a1')],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [{ articleId: 'a1', storyId: 's1', confidence: 0.5 }],
            titleUpdates: [],
          }),
          membership: fakeMembership(false),
        },
      }),
    );
    expect(
      outcome.stories.find((s) => s.id === 's1')!.articles.map((a) => a.id),
    ).toEqual(['a0']);
    const solo = outcome.stories.find((s) => s.id !== 's1')!;
    expect(solo.articles.map((a) => a.id)).toEqual(['a1']);
    // Equal publication times tie-break by Story id.
    expect(outcome.live.map((s) => s.id)).toEqual([solo.id, 's1']);
  });

  it('a low-confidence match splits when the check fails or is missing', async () => {
    const existing = [story({ articles: [article('a0')] })];
    for (const membership of [fakeMembership(null), null]) {
      const outcome = await groupStories(
        input({
          articles: [article('a0'), article('a1')],
          existing,
          clients: {
            grouping: fakeGrouping({
              newStories: [],
              assignments: [
                { articleId: 'a1', storyId: 's1', confidence: 0.5 },
              ],
              titleUpdates: [],
            }),
            membership,
          },
        }),
      );
      expect(
        outcome.stories.find((s) => s.id === 's1')!.articles.map((a) => a.id),
      ).toEqual(['a0']);
      expect(
        outcome.stories.find((s) => s.id !== 's1')!.articles.map((a) => a.id),
      ).toEqual(['a1']);
    }
  });

  it('even a confident match goes through the Membership check', async () => {
    const existing = [story({ articles: [article('a0')] })];
    const checkCalls: { story?: string; article?: string }[] = [];
    await groupStories(
      input({
        articles: [article('a0'), article('a1')],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [{ articleId: 'a1', storyId: 's1', confidence: 0.9 }],
            titleUpdates: [],
          }),
          membership: fakeMembership(true, checkCalls),
        },
      }),
    );
    expect(checkCalls).toEqual([{ story: 'Story un', article: 'Titre a1' }]);
  });

  it('caps Membership checks at 20 per build; the rest split', async () => {
    const existing = [story({ articles: [article('a0')] })];
    const fresh = Array.from({ length: 25 }, (_, i) => article(`a${i + 1}`));
    const checkCalls: { story?: string; article?: string }[] = [];
    const outcome = await groupStories(
      input({
        articles: [article('a0'), ...fresh],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: fresh.map((a) => ({
              articleId: a.id,
              storyId: 's1',
              confidence: 0.5,
            })),
            titleUpdates: [],
          }),
          membership: fakeMembership(true, checkCalls),
        },
      }),
    );
    expect(checkCalls).toHaveLength(20);
    const s1 = outcome.stories.find((s) => s.id === 's1')!;
    expect(s1.articles).toHaveLength(21); // a0 + 20 checked merges
    expect(outcome.stories).toHaveLength(1 + 5); // s1 + 5 splits
  });

  it('a failed Grouping call degrades to one-Article Stories', async () => {
    const outcome = await groupStories(
      input({
        articles: [article('a1'), article('a2')],
        clients: { grouping: fakeGrouping(null), membership: null },
      }),
    );
    expect(outcome.stories.map((s) => s.title).sort()).toEqual([
      'Titre a1',
      'Titre a2',
    ]);
  });

  it('a Grouping model that throws degrades instead of failing the build', async () => {
    const outcome = await groupStories(
      input({
        articles: [article('a1')],
        clients: {
          grouping: {
            label: 'Fake',
            model: 'fake',
            group: async () => {
              throw new Error('Fake HTTP 400: config error');
            },
          },
          membership: null,
        },
      }),
    );
    expect(outcome.stories).toHaveLength(1);
    expect(outcome.stories[0]!.articles.map((a) => a.id)).toEqual(['a1']);
  });

  it('a Membership check that throws refuses the merge instead of failing the build', async () => {
    const existing = [story({ articles: [article('a0')] })];
    const outcome = await groupStories(
      input({
        articles: [article('a0'), article('a1')],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [{ articleId: 'a1', storyId: 's1', confidence: 0.5 }],
            titleUpdates: [],
          }),
          membership: {
            label: 'FakeJev',
            belongs: async () => {
              throw new Error('FakeJev HTTP 401: bad key');
            },
          },
        },
      }),
    );
    expect(
      outcome.stories.find((s) => s.id === 's1')!.articles.map((a) => a.id),
    ).toEqual(['a0']);
    expect(
      outcome.stories.find((s) => s.id !== 's1')!.articles.map((a) => a.id),
    ).toEqual(['a1']);
  });

  it('an Article assigned to an unknown Story splits', async () => {
    const outcome = await groupStories(
      input({
        articles: [article('a1')],
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [
              { articleId: 'a1', storyId: 'nope', confidence: 0.9 },
            ],
            titleUpdates: [],
          }),
          membership: null,
        },
      }),
    );
    expect(outcome.stories).toHaveLength(1);
    expect(outcome.stories[0]!.articles.map((a) => a.id)).toEqual(['a1']);
  });

  it('an Article with no assignment splits', async () => {
    const outcome = await groupStories(
      input({
        articles: [article('a1')],
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [],
            titleUpdates: [],
          }),
          membership: null,
        },
      }),
    );
    expect(outcome.stories).toHaveLength(1);
    expect(outcome.stories[0]!.articles.map((a) => a.id)).toEqual(['a1']);
  });

  it('a new Story from the model carries the neutral title and a fresh id', async () => {
    const outcome = await groupStories(
      input({
        articles: [article('a1')],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1', title: 'Le Sénat adopte le budget' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
            ],
            titleUpdates: [],
          }),
          membership: null,
        },
      }),
    );
    const s = outcome.stories[0]!;
    expect(s.id).toBe('000000000001');
    expect(s.title).toBe('Le Sénat adopte le budget');
    expect(s.slug).toBe('le-senat-adopte-le-budget');
    expect(s.articles.map((a) => a.id)).toEqual(['a1']);
  });

  it('a new Story carries its seed unconditionally; every further member is checked against the seed', async () => {
    const membershipCalls: { story?: string; article?: string }[] = [];
    const outcome = await groupStories(
      input({
        articles: [article('a1'), article('a2'), article('a3')],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1', title: 'Le Sénat adopte le budget' }],
            assignments: [
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a3', newStoryKey: 'k1', confidence: 0.9 },
            ],
            titleUpdates: [],
          }),
          membership: fakeMembership(true, membershipCalls),
        },
      }),
    );
    // a1 is the seed (fresh order): joins without a check. a2 and a3 are
    // checked — against the seed headline, not the proposed title.
    expect(outcome.stories).toHaveLength(1);
    expect(outcome.stories[0]!.articles.map((a) => a.id)).toEqual([
      'a1',
      'a2',
      'a3',
    ]);
    expect(membershipCalls).toEqual([
      { story: 'Titre a1', article: 'Titre a2' },
      { story: 'Titre a1', article: 'Titre a3' },
    ]);
  });

  it('a member that fails the seed check splits out of the new Story', async () => {
    const membershipCalls: { story?: string; article?: string }[] = [];
    const outcome = await groupStories(
      input({
        articles: [article('a1'), article('a2')],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1', title: 'Le Sénat adopte le budget' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
            ],
            titleUpdates: [],
          }),
          membership: fakeMembership(false, membershipCalls),
        },
      }),
    );
    expect(outcome.stories.map((s) => s.title)).toEqual([
      'Le Sénat adopte le budget',
      'Titre a2',
    ]);
    const kept = outcome.stories[0]!;
    expect(kept.articles.map((a) => a.id)).toEqual(['a1']);
  });

  it('a member of a new Story splits when the checker is missing or fails', async () => {
    for (const membership of [null, fakeMembership(null)]) {
      const outcome = await groupStories(
        input({
          articles: [article('a1'), article('a2')],
          clients: {
            grouping: fakeGrouping({
              newStories: [{ key: 'k1', title: 'Le Sénat adopte le budget' }],
              assignments: [
                { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
                { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
              ],
              titleUpdates: [],
            }),
            membership,
          },
        }),
      );
      expect(outcome.stories.map((s) => s.title)).toEqual([
        'Le Sénat adopte le budget',
        'Titre a2',
      ]);
    }
  });

  it('a key Story no Article claimed never publishes', async () => {
    const outcome = await groupStories(
      input({
        articles: [article('a1')],
        clients: {
          grouping: fakeGrouping({
            newStories: [
              { key: 'k1', title: 'Vide' },
              { key: 'k2', title: 'Pleine' },
            ],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k2', confidence: 0.3 },
            ],
            titleUpdates: [],
          }),
          membership: null,
        },
      }),
    );
    expect(outcome.stories.map((s) => s.title)).toEqual(['Pleine']);
    expect(outcome.changed.has('vide')).toBe(false);
  });

  it('an existing file keeps its slug; a colliding new Story gets a Story-id suffix', async () => {
    const existing = [story({ slug: 'collision' })];
    const outcome = await groupStories(
      input({
        articles: [article('a1')],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1', title: 'Collision' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
            ],
            titleUpdates: [],
          }),
          membership: null,
        },
      }),
    );
    const created = outcome.stories.find((s) => s.id !== 's1')!;
    expect(created.slug).toBe('collision-000000'); // 6-hex slice of the Story id
  });

  it('two new Stories claiming one slug: the smallest Story id keeps the bare slug', async () => {
    const outcome = await groupStories(
      input({
        articles: [article('a1'), article('a2')],
        clients: {
          grouping: fakeGrouping({
            newStories: [
              { key: 'k2', title: 'Même sujet' }, // created first → id 000000000001
              { key: 'k1', title: 'Même sujet' },
            ],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k2', confidence: 0.3 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.3 },
            ],
            titleUpdates: [],
          }),
          membership: null,
        },
      }),
    );
    const slugs = outcome.stories.map((s) => s.slug).sort();
    expect(slugs).toEqual(['meme-sujet', 'meme-sujet-000000']);
    // k2 was created first and holds the bare slug; it also has the smaller id.
    const bare = outcome.stories.find((s) => s.slug === 'meme-sujet')!;
    expect(bare.id).toBe('000000000001');
  });

  it('the bare slug follows the smallest Story id, whatever the creation order', async () => {
    // First-created Story gets the bigger id: proposal order must not decide.
    const ids = ['ffffffffffff', '000000000001'];
    let n = 0;
    const outcome = await groupStories(
      input({
        articles: [article('a1'), article('a2')],
        makeId: () => ids[n++],
        clients: {
          grouping: fakeGrouping({
            newStories: [
              { key: 'k1', title: 'Même sujet' }, // created first → id ffffffffffff
              { key: 'k2', title: 'Même sujet' }, // created second → id 000000000001
            ],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
              { articleId: 'a2', newStoryKey: 'k2', confidence: 0.3 },
            ],
            titleUpdates: [],
          }),
          membership: null,
        },
      }),
    );
    expect(outcome.stories.find((s) => s.id === '000000000001')!.slug).toBe(
      'meme-sujet',
    );
    expect(outcome.stories.find((s) => s.id === 'ffffffffffff')!.slug).toBe(
      'meme-sujet-ffffff',
    );
  });

  it('extends the id slice when even the 6-hex suffix is taken', async () => {
    const existing = [
      story({ slug: 'collision' }),
      story({ id: 's2', slug: 'collision-000000' }),
    ];
    const outcome = await groupStories(
      input({
        articles: [article('a1')],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1', title: 'Collision' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
            ],
            titleUpdates: [],
          }),
          membership: null,
        },
      }),
    );
    const created = outcome.stories.find((s) => s.id === '000000000001')!;
    expect(created.slug).toBe('collision-00000000'); // 8-hex slice
  });

  it('re-proposes the title of a Story that gained Articles; the slug never changes', async () => {
    const existing = [story({ articles: [article('a0')] })];
    const outcome = await groupStories(
      input({
        articles: [article('a0'), article('a1')],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [{ articleId: 'a1', storyId: 's1', confidence: 0.9 }],
            titleUpdates: [{ storyId: 's1', title: 'Meilleur titre' }],
          }),
          membership: fakeMembership(true),
        },
      }),
    );
    const s1 = outcome.stories.find((s) => s.id === 's1')!;
    expect(s1.title).toBe('Meilleur titre');
    expect(s1.slug).toBe('story-un');
  });

  it('never re-titles a Story that gained no Articles', async () => {
    const existing = [
      story({ articles: [article('a0')] }),
      story({ id: 's2', slug: 'story-deux', title: 'Story deux' }),
    ];
    const outcome = await groupStories(
      input({
        articles: [article('a0'), article('a1')],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [{ articleId: 'a1', storyId: 's1', confidence: 0.9 }],
            titleUpdates: [{ storyId: 's2', title: 'Titre changé' }],
          }),
          membership: null,
        },
      }),
    );
    expect(outcome.stories.find((s) => s.id === 's2')!.title).toBe(
      'Story deux',
    );
    expect(outcome.changed.has('story-deux')).toBe(false);
  });

  it('the model only sees live Stories and gets teasers and Sections', async () => {
    const existing = [
      story({ articles: [article('a0')] }),
      story({
        id: 'sf',
        slug: 'frozen',
        title: 'Frozen',
        createdAt: '2026-10-05T00:00:00Z',
        articles: [article('a-old', { publishedAt: '2026-10-05T00:00:00Z' })],
      }),
    ];
    const calls: {
      input?: Parameters<import('./gemini.ts').GroupingModel['group']>[0];
    }[] = [];
    await groupStories(
      input({
        articles: [article('a0'), article('a1')],
        teasers: new Map([['a1', 'Chapô de a1']]),
        existing,
        clients: {
          grouping: fakeGrouping(
            {
              newStories: [],
              assignments: [
                { articleId: 'a1', storyId: 's1', confidence: 0.9 },
              ],
              titleUpdates: [],
            },
            calls,
          ),
          membership: null,
        },
      }),
    );
    const modelInput = calls[0]!.input!;
    expect(modelInput.stories.map((s) => s.id)).toEqual(['s1']); // the frozen Story is invisible
    expect(modelInput.articles).toEqual([
      {
        id: 'a1',
        headline: 'Titre a1',
        teaser: 'Chapô de a1',
        section: undefined,
      },
    ]);
  });

  it('re-running with no new Articles changes nothing', async () => {
    const existing = [story({ articles: [article('a0')] })];
    const outcome = await groupStories(
      input({
        articles: [article('a0')],
        existing,
        clients: { grouping: fakeGrouping(null), membership: null },
      }),
    );
    expect(outcome.changed.size).toBe(0);
    expect(outcome.stories).toHaveLength(1);
    expect(outcome.stories[0]!.articles).toHaveLength(1);
    expect(outcome.live.map((s) => s.id)).toEqual(['s1']);
  });

  it('Articles older than 24h are never grouped, even when no Story claims them', async () => {
    const outcome = await groupStories(
      input({
        articles: [article('a-old', { publishedAt: '2026-10-05T00:00:00Z' })],
      }),
    );
    expect(outcome.stories).toHaveLength(0);
    expect(outcome.changed.size).toBe(0);
    expect(outcome.live).toHaveLength(0);
  });

  it('recomputes the Story Section after merges, from the Articles', async () => {
    const existing = [
      story({
        articles: [
          article('a0', { section: 'politics' }),
          article('a1', { section: 'politics' }),
        ],
        section: 'politics',
      }),
    ];
    const outcome = await groupStories(
      input({
        articles: [
          article('a0', { section: 'politics' }),
          article('a1', { section: 'politics' }),
          article('a2', { section: 'world' }),
        ],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [{ articleId: 'a2', storyId: 's1', confidence: 0.9 }],
            titleUpdates: [],
          }),
          membership: null,
        },
      }),
    );
    const s1 = outcome.stories.find((s) => s.id === 's1')!;
    expect(s1.section).toBe('politics'); // 2 politics vs 1 world: majority holds
    // Tie-break check: merging two world articles would flip the majority.
  });

  it('a Story with no live Articles freezes: passed through, invisible to the Edition', async () => {
    const frozen = story({
      id: 'sf',
      slug: 'frozen',
      title: 'Frozen',
      createdAt: '2026-10-05T00:00:00Z',
      articles: [article('a-old', { publishedAt: '2026-10-05T00:00:00Z' })],
    });
    const outcome = await groupStories(
      input({
        articles: [article('a1')],
        existing: [frozen],
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [{ articleId: 'a1', storyId: 'sf', confidence: 0.9 }], // model must not see it
            titleUpdates: [],
          }),
          membership: null,
        },
      }),
    );
    const sf = outcome.stories.find((s) => s.id === 'sf')!;
    expect(sf.articles).toHaveLength(1); // untouched, full history kept
    expect(outcome.live.map((s) => s.id)).not.toContain('sf');
    expect(outcome.changed.has('frozen')).toBe(false);
    const solo = outcome.stories.find((s) => s.id !== 'sf')!;
    expect(solo.articles.map((a) => a.id)).toEqual(['a1']); // split, not merged into the frozen Story
  });

  describe('seed guard (issue #36)', () => {
    const nobel = {
      a1: 'Le prix Nobel de littérature 2026 décerné à Anne Carson',
      a2: "Le prix Nobel de littérature décerné à l'écrivaine Anne Carson",
      a3: 'Anne Carson, écrivaine canadienne, reçoit le prix Nobel',
    };

    function nobelArticles(): Article[] {
      return [
        article('a1', { headline: nobel.a1 }),
        article('a2', { headline: nobel.a2 }),
        article('a3', { headline: nobel.a3 }),
      ];
    }

    function nobelProposal() {
      return {
        newStories: [
          { key: 'k1', title: nobel.a1 },
          { key: 'k2', title: nobel.a2 },
          { key: 'k3', title: nobel.a3 },
        ],
        assignments: [
          { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
          { articleId: 'a2', newStoryKey: 'k2', confidence: 0.3 },
          { articleId: 'a3', newStoryKey: 'k3', confidence: 0.3 },
        ],
        titleUpdates: [],
      };
    }

    it('three same-build twin seeds collapse into one Story; only the twin checks run', async () => {
      const checkCalls: { story?: string; article?: string }[] = [];
      const outcome = await groupStories(
        input({
          articles: nobelArticles(),
          clients: {
            grouping: fakeGrouping(nobelProposal()),
            membership: fakeMembership(true, checkCalls),
          },
        }),
      );
      expect(outcome.stories).toHaveLength(1);
      expect(outcome.stories[0]!.title).toBe(nobel.a1);
      expect(outcome.stories[0]!.articles.map((a) => a.id)).toEqual([
        'a1',
        'a2',
        'a3',
      ]);
      // k2's and k3's seeds were checked against the surviving k1 seed
      // headline — no existing Story, so no cross-build candidate ran.
      expect(checkCalls).toEqual([
        { story: nobel.a1, article: nobel.a2 },
        { story: nobel.a1, article: nobel.a3 },
      ]);
    });

    it('unrelated proposed seeds never spend guard checks on each other', async () => {
      const checkCalls: { story?: string; article?: string }[] = [];
      const outcome = await groupStories(
        input({
          articles: [
            article('a1', { headline: 'Le Sénat adopte le budget 2027' }),
            article('a2', {
              headline: 'Victoire du Stade Toulousain en rugby',
            }),
          ],
          clients: {
            grouping: fakeGrouping({
              newStories: [
                { key: 'k1', title: 'Le Sénat adopte le budget 2027' },
                { key: 'k2', title: 'Victoire du Stade Toulousain en rugby' },
              ],
              assignments: [
                { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
                { articleId: 'a2', newStoryKey: 'k2', confidence: 0.3 },
              ],
              titleUpdates: [],
            }),
            membership: fakeMembership(true, checkCalls),
          },
        }),
      );
      // Zero token overlap between the two seeds: no guard check runs, and
      // the full check budget stays available for merges next build.
      expect(checkCalls).toEqual([]);
      expect(outcome.stories).toHaveLength(2);
      expect(outcome.live).toHaveLength(2);
    });

    it('twin seeds the guard refuses keep their separate Stories', async () => {
      const outcome = await groupStories(
        input({
          articles: nobelArticles(),
          clients: {
            grouping: fakeGrouping(nobelProposal()),
            membership: fakeMembership(false),
          },
        }),
      );
      expect(outcome.stories.map((s) => s.title)).toEqual([
        nobel.a1,
        nobel.a2,
        nobel.a3,
      ]);
      expect(outcome.live).toHaveLength(3);
    });

    it('a proposed singleton duplicating a live Story merges into it; the proposed Story is dropped', async () => {
      const checkCalls: { story?: string; article?: string }[] = [];
      const existing = [
        story({
          title: 'Mouvement de contestation lycéen',
          articles: [
            article('a0', { headline: 'EN DIRECT – Colère des lycéens' }),
          ],
        }),
      ];
      const outcome = await groupStories(
        input({
          articles: [
            article('a0', { headline: 'EN DIRECT – Colère des lycéens' }),
            article('a1', {
              headline: 'EN DIRECT – Mobilisation des lycéens',
            }),
          ],
          existing,
          clients: {
            grouping: fakeGrouping({
              newStories: [
                { key: 'k1', title: 'EN DIRECT – Mobilisation des lycéens' },
              ],
              assignments: [
                { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
              ],
              titleUpdates: [],
            }),
            membership: fakeMembership(true, checkCalls),
          },
        }),
      );
      const s1 = outcome.stories.find((s) => s.id === 's1')!;
      expect(outcome.stories).toHaveLength(1);
      expect(s1.articles.map((a) => a.id)).toEqual(['a0', 'a1']);
      expect(outcome.changed.has('story-un')).toBe(true);
      // One cross-build check against the live Story's title; no further
      // checks — the proposed Story got no seed and never published.
      expect(checkCalls).toEqual([
        {
          story: 'Mouvement de contestation lycéen',
          article: 'EN DIRECT – Mobilisation des lycéens',
        },
      ]);
    });

    it('a proposed singleton the guard refuses stays its own Story', async () => {
      const existing = [
        story({
          title: 'Mouvement de contestation lycéen',
          articles: [
            article('a0', { headline: 'EN DIRECT – Colère des lycéens' }),
          ],
        }),
      ];
      const outcome = await groupStories(
        input({
          articles: [
            article('a0', { headline: 'EN DIRECT – Colère des lycéens' }),
            article('a1', {
              headline: 'EN DIRECT – Mobilisation des lycéens',
            }),
          ],
          existing,
          clients: {
            grouping: fakeGrouping({
              newStories: [
                { key: 'k1', title: 'EN DIRECT – Mobilisation des lycéens' },
              ],
              assignments: [
                { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
              ],
              titleUpdates: [],
            }),
            membership: fakeMembership(false),
          },
        }),
      );
      expect(outcome.stories).toHaveLength(2);
      expect(
        outcome.stories.find((s) => s.id !== 's1')!.articles.map((a) => a.id),
      ).toEqual(['a1']);
    });

    it('an absorbed key keeps the absorber: its seed and members re-target', async () => {
      const checkCalls: { story?: string; article?: string }[] = [];
      const outcome = await groupStories(
        input({
          articles: nobelArticles(),
          clients: {
            grouping: fakeGrouping({
              newStories: [
                { key: 'k1', title: nobel.a1 },
                { key: 'k2', title: nobel.a2 },
              ],
              assignments: [
                { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
                { articleId: 'a2', newStoryKey: 'k2', confidence: 0.3 },
                { articleId: 'a3', newStoryKey: 'k2', confidence: 0.3 },
              ],
              titleUpdates: [],
            }),
            membership: fakeMembership(true, checkCalls),
          },
        }),
      );
      expect(outcome.stories).toHaveLength(1);
      expect(outcome.stories[0]!.articles.map((a) => a.id)).toEqual([
        'a1',
        'a2',
        'a3',
      ]);
      // k2's seed checked against k1's seed; k2's member a3 then checked
      // against the absorber's seed too — not against k2's own seed.
      expect(checkCalls).toEqual([
        { story: nobel.a1, article: nobel.a2 },
        { story: nobel.a1, article: nobel.a3 },
      ]);
    });

    it('an absorbed key folds into an existing Story: its members re-target to it', async () => {
      const checkCalls: { story?: string; article?: string }[] = [];
      const existing = [
        story({
          title: 'Mouvement de contestation lycéen',
          articles: [
            article('a0', { headline: 'EN DIRECT – Colère des lycéens' }),
          ],
        }),
      ];
      const outcome = await groupStories(
        input({
          articles: [
            article('a0', { headline: 'EN DIRECT – Colère des lycéens' }),
            article('a1', {
              headline: 'EN DIRECT – Mobilisation des lycéens',
            }),
            article('a2', {
              headline: 'Blocus des lycées : ce qui bloque la rentrée',
            }),
          ],
          existing,
          clients: {
            grouping: fakeGrouping({
              newStories: [
                { key: 'k1', title: 'EN DIRECT – Mobilisation des lycéens' },
              ],
              assignments: [
                { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
                { articleId: 'a2', newStoryKey: 'k1', confidence: 0.3 },
              ],
              titleUpdates: [],
            }),
            membership: fakeMembership(true, checkCalls),
          },
        }),
      );
      expect(outcome.stories).toHaveLength(1);
      expect(
        outcome.stories.find((s) => s.id === 's1')!.articles.map((a) => a.id),
      ).toEqual(['a0', 'a1', 'a2']);
      // The seed was checked against the live Story's title; the member
      // a2 was checked against that same Story, not against the dropped seed.
      expect(checkCalls).toEqual([
        {
          story: 'Mouvement de contestation lycéen',
          article: 'EN DIRECT – Mobilisation des lycéens',
        },
        {
          story: 'Mouvement de contestation lycéen',
          article: 'Blocus des lycées : ce qui bloque la rentrée',
        },
      ]);
    });

    it('seed guard checks spend the shared 20-check budget first; merges get the rest', async () => {
      const checkCalls: { story?: string; article?: string }[] = [];
      const existing = [
        story({
          articles: [article('a0', { headline: 'Colère des lycéens' })],
        }),
      ];
      const fresh = Array.from({ length: 21 }, (_, i) => article(`a${i + 1}`));
      fresh.push(
        article('a22', { headline: 'EN DIRECT – Mobilisation des lycéens' }),
      );
      const outcome = await groupStories(
        input({
          articles: [
            article('a0', { headline: 'Colère des lycéens' }),
            ...fresh,
          ],
          existing,
          clients: {
            grouping: fakeGrouping({
              newStories: [
                { key: 'k1', title: 'EN DIRECT – Mobilisation des lycéens' },
              ],
              assignments: [
                ...fresh.slice(0, 21).map((a) => ({
                  articleId: a.id,
                  storyId: 's1',
                  confidence: 0.9,
                })),
                { articleId: 'a22', newStoryKey: 'k1', confidence: 0.3 },
              ],
              titleUpdates: [],
            }),
            membership: fakeMembership(true, checkCalls),
          },
        }),
      );
      // 1 seed-guard check + 19 of the 21 merge checks = the 20-check cap.
      expect(checkCalls).toHaveLength(20);
      const s1 = outcome.stories.find((s) => s.id === 's1')!;
      expect(s1.articles).toHaveLength(21); // a0 + 19 checked merges + the absorbed seed
      expect(outcome.stories).toHaveLength(3); // s1 + 2 splits; the proposed Story was absorbed
    });
  });
});
