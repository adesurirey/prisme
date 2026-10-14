import type { Article, Story } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import { groupStories, memberDigest } from './grouping.ts';
import { missingMembershipChecker } from './policy.ts';

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
    storyDay: '2026-10-06',
    articles: [],
    ...overrides,
  };
}

const NOW = new Date('2026-10-06T12:00:00Z');
// Clients the tested paths never reach. If a test accidentally does, the
// fakes fail loudly instead of silently returning null.
const NO_CLIENTS = {
  grouping: {
    label: 'Fake',
    model: 'fake',
    group: async () => {
      throw new Error('no Grouping model in this test');
    },
  },
  membership: missingMembershipChecker(),
};

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
      // A null cast: only the throw-path tests use it (issue #40 made a
      // failed Grouping call fail the build).
      return proposal as import('./gemini.ts').GroupingProposal;
    },
  };
}

function fakeMembership(
  answer: boolean | null,
  calls: {
    story?: string;
    article?: string;
    headlines?: string[];
  }[] = [],
): import('./decision-model.ts').MembershipChecker {
  return {
    label: 'FakeJev',
    async belongs(story, article) {
      calls.push({
        story: story.title,
        article: article.headline,
        headlines: story.headlines,
      });
      return answer == null ? 'failed' : answer ? 'yes' : 'no';
    },
  };
}

function input(overrides: {
  articles?: Article[];
  existing?: Story[];
  teasers?: Map<string, string>;
  clients?: import('./grouping.ts').GroupingClients;
  makeId?: () => string;
  now?: Date;
}) {
  return {
    articles: overrides.articles ?? [],
    teasers: overrides.teasers ?? new Map<string, string>(),
    existing: overrides.existing ?? [],
    now: overrides.now ?? NOW,
    makeId: overrides.makeId ?? counter(),
    clients: overrides.clients ?? NO_CLIENTS,
  };
}

describe('groupStories', () => {
  it('the Grouping model sees the 3 most recent member headlines of each open Story (ADR-0018)', async () => {
    const calls: {
      input?: Parameters<import('./gemini.ts').GroupingModel['group']>[0];
    }[] = [];
    const existing = [
      story({
        articles: [
          article('old', {
            headline: 'Vieux titre',
            publishedAt: '2026-10-06T08:00:00Z',
          }),
          article('m3', {
            headline: 'Troisième titre',
            publishedAt: '2026-10-06T09:00:00Z',
          }),
          article('m1', {
            headline: 'Premier titre',
            publishedAt: '2026-10-06T11:00:00Z',
          }),
          article('m2', {
            headline: 'Deuxième titre',
            publishedAt: '2026-10-06T10:00:00Z',
          }),
        ],
      }),
    ];
    await groupStories(
      input({
        articles: [article('a1')],
        existing,
        clients: {
          grouping: fakeGrouping(
            { newStories: [], assignments: [], titleUpdates: [] },
            calls,
          ),
          membership: fakeMembership(true),
        },
      }),
    );
    expect(calls[0]?.input?.stories?.[0]?.latestHeadlines).toEqual([
      'Premier titre',
      'Deuxième titre',
      'Troisième titre',
    ]);
  });

  it('a merge check shows the member digest, most similar headlines first (ADR-0018)', async () => {
    const calls: {
      story?: string;
      article?: string;
      headlines?: string[];
    }[] = [];
    const existing = [
      story({
        articles: [
          article('m0', {
            headline: 'Nouvelle journée de mobilisation lycéenne à Paris',
            publishedAt: '2026-10-06T11:00:00Z',
          }),
          article('m1', {
            headline:
              'Le syndicat Alliance conteste la gestion des manifestations',
            publishedAt: '2026-10-06T10:00:00Z',
          }),
          article('m2', {
            headline: 'Le syndicat Alliance dépose plainte contre l\u2019État',
            publishedAt: '2026-10-06T09:00:00Z',
          }),
        ],
      }),
    ];
    await groupStories(
      input({
        articles: [
          article('a1', {
            headline: 'Le syndicat Alliance dépose plainte contre l\u2019État',
          }),
        ],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [{ articleId: 'a1', storyId: 's1', confidence: 0.9 }],
            titleUpdates: [],
          }),
          membership: fakeMembership(true, calls),
        },
      }),
    );
    expect(calls[0]?.headlines).toEqual([
      'Le syndicat Alliance dépose plainte contre l\u2019État',
      'Le syndicat Alliance conteste la gestion des manifestations',
      'Nouvelle journée de mobilisation lycéenne à Paris',
    ]);
  });

  it("a seed guard check shows the candidate Story's member digest (ADR-0018)", async () => {
    const calls: {
      story?: string;
      article?: string;
      headlines?: string[];
    }[] = [];
    const existing = [
      story({
        articles: [
          article('m1', {
            headline: 'Un syndicat de police dépose plainte contre l\u2019État',
            publishedAt: '2026-10-06T09:00:00Z',
          }),
        ],
      }),
    ];
    const outcome = await groupStories(
      input({
        articles: [
          article('a1', {
            headline: 'Le syndicat Alliance dépose plainte contre l\u2019État',
          }),
          article('a2', {
            headline:
              'La plainte du syndicat Alliance détaillée par le parquet',
          }),
        ],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1', title: 'Une story précise' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
            ],
            titleUpdates: [],
          }),
          // The guard must say no (the seed survives), then the second
          // member's merge check must say yes for the Story to hold two
          // Articles — a proposed Story reduced to its seed alone is
          // dropped (ADR-0015).
          membership: {
            label: 'FakeJev',
            async belongs(story, article) {
              calls.push({
                story: story.title,
                article: article.headline,
                headlines: story.headlines,
              });
              return article.headline.startsWith('La plainte du syndicat')
                ? 'yes'
                : 'no';
            },
          },
        },
      }),
    );
    // The guard ran against the existing Story, digest included; a no lets
    // the proposed Story keep its seed.
    expect(calls[0]?.story).toBe('Story un');
    expect(calls[0]?.headlines).toEqual([
      'Un syndicat de police dépose plainte contre l\u2019État',
    ]);
    expect(outcome.stories).toHaveLength(2);
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
    expect(checkCalls).toEqual([
      { story: 'Story un', article: 'Titre a1', headlines: ['Titre a0'] },
    ]);
  });

  it('a refused Article stays unassigned (orphan) instead of splitting (ADR-0015)', async () => {
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
    // No singleton birth: a1 is written to no Story file, so the next
    // build re-presents it as fresh (membership exists only in Story files).
    expect(outcome.stories).toHaveLength(1);
    expect(outcome.changed.has('story-un')).toBe(false);
    expect(outcome.live.map((s) => s.id)).toEqual(['s1']);
  });

  it('a build where every Membership check fails (a null answer, or a missing checker) fails (issue #40)', async () => {
    const existing = [story({ articles: [article('a0')] })];
    for (const membership of [
      fakeMembership(null),
      missingMembershipChecker(),
    ]) {
      await expect(
        groupStories(
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
        ),
      ).rejects.toThrow(/all \d+ checks failed/);
    }
  });

  it('an isolated failed Membership check orphans instead of failing the build', async () => {
    const existing = [story({ articles: [article('a0')] })];
    const outcome = await groupStories(
      input({
        articles: [article('a0'), article('a1'), article('a2')],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [
              { articleId: 'a1', storyId: 's1', confidence: 0.5 },
              { articleId: 'a2', storyId: 's1', confidence: 0.5 },
            ],
            titleUpdates: [],
          }),
          // One check throws, the other answers no: some checks answered,
          // so the build proceeds and both Articles are orphaned.
          membership: {
            label: 'FakeJev',
            belongs: async (_story, art) => {
              if (art.headline.includes('a1'))
                throw new Error('FakeJev HTTP 503: down');
              return 'no';
            },
          },
        },
      }),
    );
    expect(
      outcome.stories.find((s) => s.id === 's1')!.articles.map((a) => a.id),
    ).toEqual(['a0']);
    expect(outcome.stories.filter((s) => s.id !== 's1')).toHaveLength(0);
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
    expect(checkCalls).toEqual([
      { story: 'Story un', article: 'Titre a1', headlines: ['Titre a0'] },
    ]);
  });

  it('every candidate pair is checked exactly once — no per-build budget (ADR-0012)', async () => {
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
    expect(checkCalls).toHaveLength(25);
    expect(new Set(checkCalls.map((c) => c.article)).size).toBe(25);
    const s1 = outcome.stories.find((s) => s.id === 's1')!;
    expect(s1.articles).toHaveLength(26); // a0 + all 25 checked merges
    expect(outcome.stories).toHaveLength(1); // no splits: nothing starved
  });

  it('a failed Grouping call (a null proposal) fails the build; no Story files are written (issue #40)', async () => {
    await expect(
      groupStories(
        input({
          articles: [article('a1'), article('a2')],
          clients: {
            grouping: fakeGrouping(null),
            membership: missingMembershipChecker(),
          },
        }),
      ),
    ).rejects.toThrow(/no proposal/);
  });

  it('a Grouping model that throws fails the build (issue #40)', async () => {
    await expect(
      groupStories(
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
            membership: missingMembershipChecker(),
          },
        }),
      ),
    ).rejects.toThrow('Fake HTTP 400: config error');
  });

  it('a build where the only Membership check throws fails (issue #40)', async () => {
    const existing = [story({ articles: [article('a0')] })];
    await expect(
      groupStories(
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
            membership: {
              label: 'FakeJev',
              belongs: async () => {
                throw new Error('FakeJev HTTP 401: bad key');
              },
            },
          },
        }),
      ),
    ).rejects.toThrow('all 1 checks failed');
  });

  it('an Article assigned to an unknown Story stays unassigned (orphan)', async () => {
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
          membership: missingMembershipChecker(),
        },
      }),
    );
    expect(outcome.stories).toHaveLength(0); // orphan, no singleton birth
  });

  it('survives two invented target Story ids: the pair-score sort ran the comparator', async () => {
    // One unknown target never reaches pairScore (a 1-element sort skips the
    // comparator); two force it — the pre-fix build crashed here when the
    // Grouping model proposed a Story id that is not in the live set.
    const outcome = await groupStories(
      input({
        articles: [article('a1'), article('a2')],
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [
              { articleId: 'a1', storyId: 'nope-1', confidence: 0.9 },
              { articleId: 'a2', storyId: 'nope-2', confidence: 0.9 },
            ],
            titleUpdates: [],
          }),
          membership: fakeMembership(false),
        },
      }),
    );
    expect(outcome.stories).toHaveLength(0); // both orphaned
  });

  it('an Article with no assignment stays unassigned (orphan)', async () => {
    const outcome = await groupStories(
      input({
        articles: [article('a1')],
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [],
            titleUpdates: [],
          }),
          membership: missingMembershipChecker(),
        },
      }),
    );
    expect(outcome.stories).toHaveLength(0); // orphan, no singleton birth
  });

  it('a new Story from the model carries the neutral title and a fresh id', async () => {
    const outcome = await groupStories(
      input({
        articles: [
          article('a1', { publishedAt: '2026-10-06T09:00:00Z' }),
          article('a2', { publishedAt: '2026-10-06T10:00:00Z' }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1', title: 'Le Sénat adopte le budget' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
            ],
            titleUpdates: [],
          }),
          membership: fakeMembership(true),
        },
      }),
    );
    const s = outcome.stories[0]!;
    expect(s.id).toBe('000000000001');
    expect(s.title).toBe('Le Sénat adopte le budget');
    expect(s.slug).toBe('le-senat-adopte-le-budget');
    // Two members: a Story is never born alone (ADR-0015).
    expect(s.articles.map((a) => a.id)).toEqual(['a2', 'a1']);
  });

  it('a proposed new Story reduced to its seed alone is dropped and its members orphaned (ADR-0015)', async () => {
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
          membership: fakeMembership(false),
        },
      }),
    );
    expect(outcome.stories).toHaveLength(0);
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
      {
        story: 'Titre a1',
        article: 'Titre a2',
        headlines: ['Titre a1', 'Titre a3'],
      },
      {
        story: 'Titre a1',
        article: 'Titre a3',
        headlines: ['Titre a1', 'Titre a2'],
      },
    ]);
  });

  it('a member that fails the seed check leaves the new Story seed alone — dropped, members orphaned (ADR-0015)', async () => {
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
    // The refused member a2 orphans; the Story keeps only its seed a1,
    // which is below the two-Article birth minimum — dropped (ADR-0015).
    expect(outcome.stories).toHaveLength(0);
  });

  it('a member of a new Story: a failed check fails the build when every check fails (issue #40)', async () => {
    for (const membership of [
      missingMembershipChecker(),
      fakeMembership(null),
    ]) {
      await expect(
        groupStories(
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
        ),
      ).rejects.toThrow(/all \d+ checks failed/);
    }
  });

  it('a key Story no Article claimed never publishes', async () => {
    const outcome = await groupStories(
      input({
        articles: [article('a1'), article('a2')],
        clients: {
          grouping: fakeGrouping({
            newStories: [
              { key: 'k1', title: 'Vide' },
              { key: 'k2', title: 'Pleine' },
            ],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k2', confidence: 0.3 },
              { articleId: 'a2', newStoryKey: 'k2', confidence: 0.3 },
            ],
            titleUpdates: [],
          }),
          membership: fakeMembership(true),
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
        articles: [article('a1'), article('a2')],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1', title: 'Collision' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.3 },
            ],
            titleUpdates: [],
          }),
          membership: fakeMembership(true),
        },
      }),
    );
    const created = outcome.stories.find((s) => s.id !== 's1')!;
    expect(created.slug).toBe('collision-000000'); // 6-hex slice of the Story id
  });

  it('two new Stories claiming one slug: the smallest Story id keeps the bare slug', async () => {
    const outcome = await groupStories(
      input({
        articles: [
          article('a1', { headline: 'Le Sénat adopte le budget 2027' }),
          article('a2', { headline: 'Le budget 2027 adopté par le Sénat' }),
          article('a3', { headline: 'Victoire du Stade Toulousain en rugby' }),
          article('a4', {
            headline: 'Le Stade Toulousain remporte le match de rugby',
          }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [
              { key: 'k2', title: 'Même sujet' }, // created first → id 000000000001
              { key: 'k1', title: 'Même sujet' },
            ],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k2', confidence: 0.3 },
              { articleId: 'a2', newStoryKey: 'k2', confidence: 0.3 },
              { articleId: 'a3', newStoryKey: 'k1', confidence: 0.3 },
              { articleId: 'a4', newStoryKey: 'k1', confidence: 0.3 },
            ],
            titleUpdates: [],
          }),
          membership: fakeMembership(true),
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
        articles: [
          article('a1', { headline: 'Le Sénat adopte le budget 2027' }),
          article('a2', { headline: 'Le budget 2027 adopté par le Sénat' }),
          article('a3', { headline: 'Victoire du Stade Toulousain en rugby' }),
          article('a4', {
            headline: 'Le Stade Toulousain remporte le match de rugby',
          }),
        ],
        makeId: () => ids[n++],
        clients: {
          grouping: fakeGrouping({
            newStories: [
              { key: 'k1', title: 'Même sujet' }, // created first → id ffffffffffff
              { key: 'k2', title: 'Même sujet' }, // created second → id 000000000001
            ],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.3 },
              { articleId: 'a3', newStoryKey: 'k2', confidence: 0.3 },
              { articleId: 'a4', newStoryKey: 'k2', confidence: 0.3 },
            ],
            titleUpdates: [],
          }),
          membership: fakeMembership(true),
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
        articles: [article('a1'), article('a2')],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1', title: 'Collision' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.3 },
            ],
            titleUpdates: [],
          }),
          membership: fakeMembership(true),
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
          membership: fakeMembership(false),
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
        storyDay: '2026-10-05',
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
          membership: fakeMembership(false),
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
        clients: {
          grouping: fakeGrouping(null),
          membership: missingMembershipChecker(),
        },
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

  it("an Article published 23:50 and collected at 00:10 joins yesterday's Story (ADR-0017 window)", async () => {
    // 2026-10-06T21:50Z = 23:50 Paris on Oct 6; NOW = 00:10 Paris on Oct 7.
    const outcome = await groupStories(
      input({
        now: new Date('2026-10-06T22:10:00Z'),
        articles: [article('a-y', { publishedAt: '2026-10-06T21:50:00Z' })],
        existing: [
          story({
            storyDay: '2026-10-06',
            articles: [article('a0', { publishedAt: '2026-10-06T20:00:00Z' })],
          }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [{ articleId: 'a-y', storyId: 's1', confidence: 0.9 }],
            titleUpdates: [],
          }),
          membership: fakeMembership(true),
        },
      }),
    );
    const s = outcome.stories.find((s) => s.id === 's1')!;
    expect(s.articles.map((a) => a.id)).toEqual(['a-y', 'a0']);
    expect(outcome.changed.has('story-un')).toBe(true);
  });

  it("an Article published 00:01 the next day never joins yesterday's Story (day split, ADR-0017)", async () => {
    // 2026-10-06T22:01Z = 00:01 Paris on Oct 7: a new day, new Stories.
    const outcome = await groupStories(
      input({
        now: new Date('2026-10-06T22:10:00Z'),
        articles: [article('a-next', { publishedAt: '2026-10-06T22:01:00Z' })],
        existing: [
          story({
            storyDay: '2026-10-06',
            articles: [article('a0', { publishedAt: '2026-10-06T20:00:00Z' })],
          }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [
              { articleId: 'a-next', storyId: 's1', confidence: 0.9 },
            ],
            titleUpdates: [],
          }),
          membership: fakeMembership(true),
        },
      }),
    );
    const s = outcome.stories.find((s) => s.id === 's1')!;
    expect(s.articles.map((a) => a.id)).toEqual(['a0']); // not merged: other day
    expect(outcome.changed.size).toBe(0);
  });

  it('a late-collected old Article (window closed) is never grouped: Unassigned, retried next build', async () => {
    // Published Oct 4 (23:50 Paris), collected Oct 7 00:10 Paris: its day's
    // window closed at 06:00 on Oct 5. The Grouping model is never called.
    const outcome = await groupStories(
      input({
        now: new Date('2026-10-06T22:10:00Z'),
        articles: [article('a-old', { publishedAt: '2026-10-04T21:50:00Z' })],
        existing: [
          story({
            storyDay: '2026-10-04',
            articles: [article('a0', { publishedAt: '2026-10-04T20:00:00Z' })],
          }),
        ],
        clients: NO_CLIENTS,
      }),
    );
    expect(outcome.stories).toHaveLength(1); // passed through untouched
    expect(outcome.changed.size).toBe(0);
  });

  it("a new Story carries the founding Article's Publication day, fixed at creation (ADR-0017)", async () => {
    // Seed published 23:50 Paris on Oct 6, collected 00:10 Paris on Oct 7:
    // the Story is born on Oct 6, not on the collection day.
    const outcome = await groupStories(
      input({
        now: new Date('2026-10-06T22:10:00Z'),
        articles: [
          article('a-seed', { publishedAt: '2026-10-06T21:50:00Z' }),
          article('a-mate', { publishedAt: '2026-10-06T21:55:00Z' }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1', title: 'Nouvel événement' }],
            assignments: [
              { articleId: 'a-seed', newStoryKey: 'k1', confidence: 0.3 },
              { articleId: 'a-mate', newStoryKey: 'k1', confidence: 0.3 },
            ],
            titleUpdates: [],
          }),
          membership: fakeMembership(true),
        },
      }),
    );
    expect(outcome.stories).toHaveLength(1);
    expect(outcome.stories[0]!.storyDay).toBe('2026-10-06');
  });

  it("a member of another day than its Story's founding day is refused and orphaned (ADR-0017)", async () => {
    // The model proposes a new Story from a 23:50 seed and a 00:01 next-day
    // Article: only the seed's day matches, the other member never joins.
    const outcome = await groupStories(
      input({
        now: new Date('2026-10-06T22:10:00Z'),
        articles: [
          article('a-seed', { publishedAt: '2026-10-06T21:50:00Z' }),
          article('a-next', { publishedAt: '2026-10-06T22:01:00Z' }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1', title: 'Nouvel événement' }],
            assignments: [
              { articleId: 'a-seed', newStoryKey: 'k1', confidence: 0.3 },
              { articleId: 'a-next', newStoryKey: 'k1', confidence: 0.3 },
            ],
            titleUpdates: [],
          }),
          membership: fakeMembership(true),
        },
      }),
    );
    // The proposed Story is reduced to its seed alone: dropped (ADR-0015),
    // both Articles orphaned — the next-day one also for the day rule.
    expect(outcome.stories).toHaveLength(0);
  });

  it('the model only sees Stories whose ingestion window is open (ADR-0017)', async () => {
    // NOW = Oct 6 12:00Z (14:00 Paris): the Oct 5 Story's window closed at
    // 06:00 Paris on Oct 6 — invisible to the model even though prompt
    // text is unchanged.
    const calls: {
      input?: Parameters<import('./gemini.ts').GroupingModel['group']>[0];
    }[] = [];
    await groupStories(
      input({
        articles: [article('a0'), article('a1')],
        existing: [
          story({ articles: [article('a0')] }),
          story({
            id: 's-closed',
            slug: 'hier',
            title: 'Hier',
            storyDay: '2026-10-05',
            articles: [article('a-h', { publishedAt: '2026-10-05T10:00:00Z' })],
          }),
        ],
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
          membership: fakeMembership(false),
        },
      }),
    );
    const modelInput = calls[0]!.input!;
    expect(modelInput.stories.map((s) => s.id)).toEqual(['s1']);
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
          membership: fakeMembership(false),
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
          membership: fakeMembership(false),
        },
      }),
    );
    const sf = outcome.stories.find((s) => s.id === 'sf')!;
    expect(sf.articles).toHaveLength(1); // untouched, full history kept
    expect(outcome.live.map((s) => s.id)).not.toContain('sf');
    expect(outcome.changed.has('frozen')).toBe(false);
    // a1 is not merged into the frozen Story: it stays unassigned (ADR-0015).
    expect(outcome.stories).toHaveLength(1);
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
        { story: nobel.a1, article: nobel.a2, headlines: [nobel.a1] },
        { story: nobel.a1, article: nobel.a3, headlines: [nobel.a1] },
      ]);
    });

    it('unrelated proposed seeds never spend guard checks on each other', async () => {
      const checkCalls: { story?: string; article?: string }[] = [];
      const outcome = await groupStories(
        input({
          articles: [
            article('a1', { headline: 'Le Sénat adopte le budget 2027' }),
            article('a2', {
              headline: 'Le budget 2027 adopté par le Sénat',
            }),
            article('a3', {
              headline: 'Victoire du Stade Toulousain en rugby',
            }),
            article('a4', {
              headline: 'Le Stade Toulousain remporte le match de rugby',
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
                { articleId: 'a2', newStoryKey: 'k1', confidence: 0.3 },
                { articleId: 'a3', newStoryKey: 'k2', confidence: 0.3 },
                { articleId: 'a4', newStoryKey: 'k2', confidence: 0.3 },
              ],
              titleUpdates: [],
            }),
            membership: fakeMembership(true, checkCalls),
          },
        }),
      );
      // Zero token overlap between the two seeds: no guard check runs
      // across keys — the only belongs calls are each key's non-seed member
      // against its own seed. No per-build budget caps them (ADR-0012).
      expect(checkCalls).toEqual([
        {
          story: 'Le Sénat adopte le budget 2027',
          article: 'Le budget 2027 adopté par le Sénat',
          headlines: ['Le Sénat adopte le budget 2027'],
        },
        {
          story: 'Victoire du Stade Toulousain en rugby',
          article: 'Le Stade Toulousain remporte le match de rugby',
          headlines: ['Victoire du Stade Toulousain en rugby'],
        },
      ]);
      expect(outcome.stories).toHaveLength(2);
      expect(outcome.live).toHaveLength(2);
    });

    it('twin seeds the guard refuses are all dropped — Articles orphaned (ADR-0015)', async () => {
      const outcome = await groupStories(
        input({
          articles: nobelArticles(),
          clients: {
            grouping: fakeGrouping(nobelProposal()),
            membership: fakeMembership(false),
          },
        }),
      );
      // Each proposed key kept only its seed: below the two-Article birth
      // minimum, every key is dropped and the Articles retry next build.
      expect(outcome.stories).toHaveLength(0);
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
          headlines: ['EN DIRECT – Colère des lycéens'],
        },
      ]);
    });

    it('a proposed singleton the guard refuses is dropped; the Article is orphaned (ADR-0015)', async () => {
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
      expect(outcome.stories).toHaveLength(1); // only the live Story s1
      expect(outcome.stories[0]!.articles.map((a) => a.id)).toEqual(['a0']);
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
        { story: nobel.a1, article: nobel.a2, headlines: [nobel.a1] },
        { story: nobel.a1, article: nobel.a3, headlines: [nobel.a1] },
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
          headlines: ['EN DIRECT – Colère des lycéens'],
        },
        {
          story: 'Mouvement de contestation lycéen',
          article: 'Blocus des lycées : ce qui bloque la rentrée',
          headlines: ['EN DIRECT – Colère des lycéens'],
        },
      ]);
    });

    it('every merge pair is checked — no per-build budget (ADR-0012)', async () => {
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
      // 1 seed-guard check + all 21 merge checks — nothing is starved.
      expect(checkCalls).toHaveLength(22);
      const s1 = outcome.stories.find((s) => s.id === 's1')!;
      expect(s1.articles).toHaveLength(23); // a0 + 21 checked merges + the absorbed seed
      expect(outcome.stories).toHaveLength(1); // no splits: nothing starved
    });
  });
});

describe('memberDigest (ADR-0018)', () => {
  const candidate = article('a1', {
    headline: 'Le syndicat Alliance dépose plainte contre l\u2019État',
  });

  it('ranks member headlines by token overlap with the candidate first, and never shows the candidate itself', () => {
    const digest = memberDigest(candidate, [
      {
        id: 'x3',
        headline: 'Nouvelle journée de mobilisation lycéenne à Paris',
        publishedAt: '2026-10-06T11:00:00Z',
      },
      {
        id: 'x2',
        headline: 'Le syndicat Alliance conteste la gestion des manifestations',
        publishedAt: '2026-10-06T10:00:00Z',
      },
      {
        id: 'a1',
        headline: 'Le syndicat Alliance dépose plainte contre l\u2019État',
        publishedAt: '2026-10-06T09:00:00Z',
      },
      {
        id: 'x1',
        headline: 'Le syndicat Alliance dépose plainte contre l\u2019État',
        publishedAt: '2026-10-06T09:00:00Z',
      },
    ]);
    expect(digest).toEqual([
      'Le syndicat Alliance dépose plainte contre l\u2019État',
      'Le syndicat Alliance conteste la gestion des manifestations',
      'Nouvelle journée de mobilisation lycéenne à Paris',
    ]);
  });

  it('caps at five, breaking score ties by recency then original order', () => {
    const members = [
      { id: 'x5', headline: 'Titre cinq', publishedAt: '2026-10-06T10:00:00Z' },
      {
        id: 'x6',
        headline: 'Titre récent',
        publishedAt: '2026-10-06T11:00:00Z',
      },
      { id: 'x1', headline: 'Titre un', publishedAt: '2026-10-06T08:00:00Z' },
      { id: 'x2', headline: 'Titre deux', publishedAt: '2026-10-06T07:00:00Z' },
      {
        id: 'x3',
        headline: 'Titre trois',
        publishedAt: '2026-10-06T06:00:00Z',
      },
      {
        id: 'x4',
        headline: 'Titre quatre',
        publishedAt: '2026-10-06T05:00:00Z',
      },
    ];
    // No overlap at all with the candidate: recency decides, five kept.
    const digest = memberDigest(candidate, members);
    expect(digest).toEqual([
      'Titre récent',
      'Titre cinq',
      'Titre un',
      'Titre deux',
      'Titre trois',
    ]);
    // Same scores and same dates: original order holds.
    const tied = memberDigest(candidate, [
      {
        id: 'x1',
        headline: 'Premier ex aequo',
        publishedAt: '2026-10-06T10:00:00Z',
      },
      {
        id: 'x2',
        headline: 'Second ex aequo',
        publishedAt: '2026-10-06T10:00:00Z',
      },
    ]);
    expect(tied).toEqual(['Premier ex aequo', 'Second ex aequo']);
  });
});
