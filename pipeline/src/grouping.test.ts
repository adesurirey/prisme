import type { Article, Story } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import {
  bestEpisodeMatch,
  groupStories,
  meetsBirthMinimum,
  memberDigest,
  wordKey,
} from './grouping.ts';
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
  titles: {
    label: 'FakeTitles',
    model: 'fake',
    title: async () => {
      throw new Error('no Title pass answer in this test');
    },
  },
};

/** A Title pass that answers with the given titles/updates, recording its
 * inputs. Called with no answer, it auto-answers one `Titre <key>` per
 * birth (the slug follows), with no updates; `null` throws loudly — for
 * paths the test must never reach. */
function fakeTitlePass(
  answer: {
    titles?: { key: string; title: string }[];
    titleUpdates?: { storyId: string; title: string }[];
  } | null = {},
  calls: { input?: import('./title-pass.ts').TitlePassInput }[] = [],
): import('./title-pass.ts').TitlePassModel {
  return {
    label: 'FakeTitles',
    model: 'fake',
    async title(input) {
      calls.push({ input });
      if (answer == null) throw new Error('no Title pass answer in this test');
      const auto = input.births.map((b) => ({
        key: b.key,
        title: `Titre ${b.key}`,
      }));
      const titles = answer.titles ?? auto;
      const updates = answer.titleUpdates ?? [];
      return { titles, titleUpdates: updates };
    },
  };
}

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
    async sameSubject(episodes, birth) {
      calls.push({
        story: episodes.map((e) => e.title).join(' | '),
        article: birth.title,
        headlines: birth.headlines,
      });
      return answer == null ? 'failed' : answer ? 'yes' : 'no';
    },
    async absorbs(story, bunch) {
      calls.push({
        story: story.title,
        article: bunch.title,
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
  clients?:
    | (Omit<import('./grouping.ts').GroupingClients, 'titles'> & {
        titles?: import('./title-pass.ts').TitlePassModel;
      })
    | undefined;
  makeId?: () => string;
  now?: Date;
}) {
  return {
    articles: overrides.articles ?? [],
    teasers: overrides.teasers ?? new Map<string, string>(),
    existing: overrides.existing ?? [],
    now: overrides.now ?? NOW,
    makeId: overrides.makeId ?? counter(),
    clients: overrides.clients
      ? { titles: fakeTitlePass(), ...overrides.clients }
      : NO_CLIENTS,
  };
}

describe('wordKey — light French stemming (issue #141)', () => {
  it('strips the plural s so inflections share one key', () => {
    expect(wordKey('manifestations')).toBe(wordKey('manifestation'));
    expect(wordKey('interpellations')).toBe(wordKey('interpellation'));
  });

  it('strips the feminine e so gendered forms share one key', () => {
    expect(wordKey('mobilisée')).toBe(wordKey('mobilisé'));
    expect(wordKey('grenades')).toBe(wordKey('grenade'));
  });

  it('keeps short words intact rather than over-merging', () => {
    expect(wordKey('rue')).toBe('rue');
    expect(wordKey('jeux')).toBe('jeux');
    expect(wordKey('lois')).toBe('lois');
  });

  it('still drops stopwords on their surface form', () => {
    expect(wordKey('une')).toBeUndefined();
    expect(wordKey('avec')).toBeUndefined();
  });
});

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
          grouping: fakeGrouping({ newStories: [], assignments: [] }, calls),
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
            outletId: 'liberation',
            headline:
              'La plainte du syndicat Alliance détaillée par le parquet',
          }),
        ],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
            ],
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
            async absorbs(story, bunch) {
              calls.push({
                story: story.title,
                article: bunch.title,
                headlines: story.headlines,
              });
              return 'no';
            },
            async sameSubject() {
              throw new Error('no topic check in this test');
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
        articles: [article('a0', { publishedAt: '2026-10-06T10:00:00Z' })],
      }),
    ];
    const outcome = await groupStories(
      input({
        articles: [
          article('a0', { publishedAt: '2026-10-06T10:00:00Z' }),
          article('a1', { publishedAt: '2026-10-06T11:00:00Z' }),
        ],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [{ articleId: 'a1', storyId: 's1', confidence: 0.9 }],
          }),
          membership: fakeMembership(true),
        },
      }),
    );
    const s = outcome.stories.find((s) => s.id === 's1')!;
    expect(s.articles.map((a) => a.id)).toEqual(['a1', 'a0']); // a1 is newer: newest first
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
            sameSubject: async () => {
              throw new Error('no topic check in this test');
            },
            absorbs: async () => {
              throw new Error('no guard check in this test');
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
            }),
            membership: {
              label: 'FakeJev',
              belongs: async () => {
                throw new Error('FakeJev HTTP 401: bad key');
              },
              sameSubject: async () => {
                throw new Error('no topic check in this test');
              },
              absorbs: async () => {
                throw new Error('no guard check in this test');
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
          }),
          membership: missingMembershipChecker(),
        },
      }),
    );
    expect(outcome.stories).toHaveLength(0); // orphan, no singleton birth
  });

  it('a new Story carries the Title pass title and a fresh id; the slug derives from the title', async () => {
    const outcome = await groupStories(
      input({
        articles: [
          article('a1', { publishedAt: '2026-10-06T09:00:00Z' }),
          article('a2', {
            outletId: 'liberation',
            publishedAt: '2026-10-06T10:00:00Z',
          }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
            ],
          }),
          membership: fakeMembership(true),
          titles: fakeTitlePass({
            titles: [{ key: 'k1', title: 'Le Sénat adopte le budget' }],
          }),
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
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
            ],
          }),
          membership: fakeMembership(false),
        },
      }),
    );
    expect(outcome.stories).toHaveLength(0);
  });

  it('two same-Outlet Articles proposed as a new Story never publish; both stay Unassigned and retry each build (ADR-0027)', async () => {
    // The Grouping model never sees Outlet ids, so the Outlet dimension of
    // the birth minimum is enforced at the drop pass, like the two-Article
    // minimum: a single-Outlet proposal is dropped before it can publish.
    const groupingCalls: {
      input?: Parameters<import('./gemini.ts').GroupingModel['group']>[0];
    }[] = [];
    const proposePair = () =>
      fakeGrouping(
        {
          newStories: [{ key: 'k1' }],
          assignments: [
            { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
            { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
          ],
        },
        groupingCalls,
      );
    const first = await groupStories(
      input({
        articles: [article('a1'), article('a2')], // both lemonde: one Outlet
        clients: {
          grouping: proposePair(),
          membership: fakeMembership(true),
        },
      }),
    );
    // Dropped before it can publish: no Story, no file, nothing live.
    expect(first.stories).toHaveLength(0);
    expect(first.changed.size).toBe(0);
    expect(first.live).toHaveLength(0);
    // Both Articles stayed Unassigned — written to no Story file — so the
    // next build re-presents them as fresh, until a second Outlet covers
    // the event or they age out of the collection window.
    await groupStories(
      input({
        articles: [article('a1'), article('a2')],
        existing: first.stories,
        clients: {
          grouping: proposePair(),
          membership: fakeMembership(true),
        },
      }),
    );
    expect(groupingCalls[1]?.input?.articles.map((a) => a.id)).toEqual([
      'a1',
      'a2',
    ]);
  });

  it('the same pair plus one Article from a second Outlet births the Story; the earliest Article anchors the founding (ADR-0027)', async () => {
    // The second Outlet's scoop — published 23:50 Paris on Oct 5, collected
    // with the Oct 6 pair — is the earliest member: it anchors the founding
    // instant (and the Story day) even though it was not the seed.
    const outcome = await groupStories(
      input({
        articles: [
          article('a1', { publishedAt: '2026-10-06T09:00:00Z' }),
          article('a2', { publishedAt: '2026-10-06T10:00:00Z' }),
          article('scoop', {
            outletId: 'liberation',
            publishedAt: '2026-10-05T21:50:00Z',
          }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'scoop', newStoryKey: 'k1', confidence: 0.9 },
            ],
          }),
          membership: fakeMembership(true),
          titles: fakeTitlePass({ titles: [{ key: 'k1', title: 'Le scoop' }] }),
        },
      }),
    );
    expect(outcome.stories).toHaveLength(1);
    expect(outcome.stories[0]!.articles.map((a) => a.id).sort()).toEqual([
      'a1',
      'a2',
      'scoop',
    ]);
    // The founding instant is the earliest Article of the member set —
    // the scoop's Publication day (ADR-0017, ADR-0026).
    expect(outcome.stories[0]!.storyDay).toBe('2026-10-05');
  });

  it('the Story day follows the admitted founding, never a claimed-then-refused ghost member (issue #142)', async () => {
    // The ghost is claimed for the key and published one Paris day before
    // every admitted member — but its Membership check is refused, so it
    // never joins. The day must come from the admitted set, not the ghost.
    const membership: import('./decision-model.ts').MembershipChecker = {
      label: 'FakeJev',
      async belongs(story, article) {
        return article.headline.startsWith('Ghost ') ? 'no' : 'yes';
      },
      async sameSubject() {
        return 'no';
      },
      async absorbs() {
        return 'no';
      },
    };
    const outcome = await groupStories(
      input({
        articles: [
          article('a2', {
            outletId: 'leparisien',
            publishedAt: '2026-10-06T10:00:00Z',
          }),
          article('a1', {
            outletId: 'liberation',
            publishedAt: '2026-10-06T09:00:00Z', // Paris 2026-10-06 11:00
          }),
          article('ghost', {
            headline: 'Ghost revendiqué puis refusé',
            publishedAt: '2026-10-05T21:30:00Z', // Paris 2026-10-05 23:30
          }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'ghost', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
            ],
          }),
          membership,
          titles: fakeTitlePass({ titles: [{ key: 'k1', title: 'Admis' }] }),
        },
      }),
    );
    // The ghost was refused: the Story keeps the two admitted Articles
    // (two Outlets — the birth minimum holds) and its day is the Paris day
    // of the earliest admitted member (2026-10-06T09:00Z), not the ghost's
    // claim-time 2026-10-05.
    expect(outcome.stories).toHaveLength(1);
    expect(outcome.stories[0]!.articles.map((a) => a.id).sort()).toEqual([
      'a1',
      'a2',
    ]);
    expect(outcome.stories[0]!.storyDay).toBe('2026-10-06');
  });

  it('a birth from one news Article and one Opinion Article of two different Outlets is valid (ADR-0011, ADR-0027)', async () => {
    // An Opinion piece counts toward the birth like any Article: the
    // minimum counts Articles and Outlets, never Kinds.
    const outcome = await groupStories(
      input({
        articles: [
          article('a1', { kind: 'news' }),
          article('o1', { outletId: 'liberation', kind: 'opinion' }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'o1', newStoryKey: 'k1', confidence: 0.9 },
            ],
          }),
          membership: fakeMembership(true),
          titles: fakeTitlePass({ titles: [{ key: 'k1', title: 'Édito' }] }),
        },
      }),
    );
    expect(outcome.stories).toHaveLength(1);
    expect(outcome.stories[0]!.articles.map((a) => a.id)).toEqual(['a1', 'o1']);
  });

  it('a new Story carries its seed unconditionally; every further member is checked against the seed', async () => {
    const membershipCalls: { story?: string; article?: string }[] = [];
    const outcome = await groupStories(
      input({
        articles: [
          article('a1'),
          article('a2', { outletId: 'liberation' }),
          article('a3'),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a3', newStoryKey: 'k1', confidence: 0.9 },
            ],
          }),
          membership: fakeMembership(true, membershipCalls),
        },
      }),
    );
    // a1 is the seed (fresh order): joins without a check. a2 and a3 are
    // checked — against the seed headline, not the proposed title. a2
    // carries the second Outlet the birth minimum needs (ADR-0027).
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
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
            ],
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
                newStories: [{ key: 'k1' }],
                assignments: [
                  { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
                  { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
                ],
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
        articles: [article('a1'), article('a2', { outletId: 'liberation' })],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }, { key: 'k2' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k2', confidence: 0.3 },
              { articleId: 'a2', newStoryKey: 'k2', confidence: 0.3 },
            ],
          }),
          membership: fakeMembership(true),
          titles: fakeTitlePass({ titles: [{ key: 'k2', title: 'Pleine' }] }),
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
        articles: [article('a1'), article('a2', { outletId: 'liberation' })],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.3 },
            ],
          }),
          membership: fakeMembership(true),
          titles: fakeTitlePass({
            titles: [{ key: 'k1', title: 'Collision' }],
          }),
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
          article('a2', {
            outletId: 'liberation',
            headline: 'Le budget 2027 adopté par le Sénat',
          }),
          article('a3', { headline: 'Victoire du Stade Toulousain en rugby' }),
          article('a4', {
            outletId: 'liberation',
            headline: 'Le Stade Toulousain remporte le match de rugby',
          }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [
              { key: 'k2' }, // created first → id 000000000001
              { key: 'k1' },
            ],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k2', confidence: 0.3 },
              { articleId: 'a2', newStoryKey: 'k2', confidence: 0.3 },
              { articleId: 'a3', newStoryKey: 'k1', confidence: 0.3 },
              { articleId: 'a4', newStoryKey: 'k1', confidence: 0.3 },
            ],
          }),
          membership: fakeMembership(true),
          titles: fakeTitlePass({
            titles: [
              { key: 'k1', title: 'Même sujet' },
              { key: 'k2', title: 'Même sujet' },
            ],
          }),
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
          article('a2', {
            outletId: 'liberation',
            headline: 'Le budget 2027 adopté par le Sénat',
          }),
          article('a3', { headline: 'Victoire du Stade Toulousain en rugby' }),
          article('a4', {
            outletId: 'liberation',
            headline: 'Le Stade Toulousain remporte le match de rugby',
          }),
        ],
        makeId: () => ids[n++],
        clients: {
          grouping: fakeGrouping({
            newStories: [
              { key: 'k1' }, // created first → id ffffffffffff
              { key: 'k2' }, // created second → id 000000000001
            ],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.3 },
              { articleId: 'a3', newStoryKey: 'k2', confidence: 0.3 },
              { articleId: 'a4', newStoryKey: 'k2', confidence: 0.3 },
            ],
          }),
          membership: fakeMembership(true),
          titles: fakeTitlePass({
            titles: [
              { key: 'k1', title: 'Même sujet' },
              { key: 'k2', title: 'Même sujet' },
            ],
          }),
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
        articles: [article('a1'), article('a2', { outletId: 'liberation' })],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.3 },
            ],
          }),
          membership: fakeMembership(true),
          titles: fakeTitlePass({
            titles: [{ key: 'k1', title: 'Collision' }],
          }),
        },
      }),
    );
    const created = outcome.stories.find((s) => s.id === '000000000001')!;
    expect(created.slug).toBe('collision-00000000'); // 8-hex slice
  });

  it('re-titles a Story that gained Articles via the Title pass; the slug never changes', async () => {
    const existing = [story({ articles: [article('a0')] })];
    const outcome = await groupStories(
      input({
        articles: [article('a0'), article('a1')],
        existing,
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [{ articleId: 'a1', storyId: 's1', confidence: 0.9 }],
          }),
          membership: fakeMembership(true),
          titles: fakeTitlePass({
            titleUpdates: [{ storyId: 's1', title: 'Meilleur titre' }],
          }),
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
          }),
          membership: fakeMembership(false),
          titles: fakeTitlePass({
            titleUpdates: [{ storyId: 's2', title: 'Titre changé' }],
          }),
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

  it('an Article published 23:50 and collected at 00:10 joins its Story (ADR-0027 window)', async () => {
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
          }),
          membership: fakeMembership(true),
        },
      }),
    );
    const s = outcome.stories.find((s) => s.id === 's1')!;
    expect(s.articles.map((a) => a.id)).toEqual(['a-y', 'a0']);
    expect(outcome.changed.has('story-un')).toBe(true);
  });

  it('an Article published the morning after an evening founding joins the Story (ADR-0027, issue #116)', async () => {
    // The Trump/Zelensky shape: a Story founded 2026-10-17 22:01 UTC
    // (00:01 Paris) absorbs the overnight cycle — here an Article published
    // 2026-10-18 08:00 UTC (10:00 Paris), which the day rule of ADR-0017
    // rejected into a duplicate fragment. NOW is the next build, 09:00 UTC:
    // the Story's window is still open (founding + 24h).
    const outcome = await groupStories(
      input({
        now: new Date('2026-10-18T09:00:00Z'),
        articles: [
          article('a-morning', { publishedAt: '2026-10-18T08:00:00Z' }),
        ],
        existing: [
          story({
            id: 's1',
            slug: 'soir',
            title: 'Soir',
            storyDay: '2026-10-17',
            articles: [article('a0', { publishedAt: '2026-10-17T22:01:00Z' })],
          }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [
              { articleId: 'a-morning', storyId: 's1', confidence: 0.9 },
            ],
          }),
          membership: fakeMembership(true),
        },
      }),
    );
    const s = outcome.stories.find((s) => s.id === 's1')!;
    expect(s.articles.map((a) => a.id)).toEqual(['a-morning', 'a0']);
    expect(outcome.changed.has('soir')).toBe(true);
    expect(outcome.live.map((s) => s.id)).toEqual(['s1']);
  });

  it('an Article published just past the window close is refused: the Story is frozen (ADR-0027)', async () => {
    // Founded 2026-10-17T22:01:00Z with no later Article, the window closes
    // at founding + 24h = 2026-10-18T22:01:00Z (the floor term):
    // an Article published one second later finds a frozen Story and stays
    // Unassigned — re-presented next build, retried against open windows.
    const outcome = await groupStories(
      input({
        now: new Date('2026-10-18T22:02:00Z'),
        articles: [article('a-late', { publishedAt: '2026-10-18T22:01:01Z' })],
        existing: [
          story({
            id: 's1',
            slug: 'soir',
            title: 'Soir',
            storyDay: '2026-10-17',
            articles: [article('a0', { publishedAt: '2026-10-17T22:01:00Z' })],
          }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [
              { articleId: 'a-late', storyId: 's1', confidence: 0.9 },
            ],
          }),
          membership: fakeMembership(true),
        },
      }),
    );
    const s = outcome.stories.find((s) => s.id === 's1')!;
    expect(s.articles.map((a) => a.id)).toEqual(['a0']); // not merged: window closed
    expect(outcome.changed.size).toBe(0);
    expect(outcome.live).toHaveLength(0);
  });

  it('a Story more than 24h past its founding whose newest Article is less than 12h old is still live and absorbs a matching Article (ADR-0027)', async () => {
    // Founded 2026-10-05T10:00Z, newest Article 2026-10-06T10:00Z, NOW
    // 2026-10-06T12:00Z: 26 hours past the founding — ADR-0026 froze it 2
    // hours ago; the silence rule keeps it open until newest + 12h. The
    // model sees it in the live pool and the assignment merges.
    const calls: {
      input?: Parameters<import('./gemini.ts').GroupingModel['group']>[0];
    }[] = [];
    const outcome = await groupStories(
      input({
        articles: [article('a-new', { publishedAt: '2026-10-06T11:30:00Z' })],
        existing: [
          story({
            id: 's1',
            slug: 'saga',
            title: 'Saga',
            storyDay: '2026-10-05',
            articles: [
              article('a0', { publishedAt: '2026-10-05T10:00:00Z' }),
              article('a1', { publishedAt: '2026-10-06T10:00:00Z' }),
            ],
          }),
        ],
        clients: {
          grouping: fakeGrouping(
            {
              newStories: [],
              assignments: [
                { articleId: 'a-new', storyId: 's1', confidence: 0.9 },
              ],
            },
            calls,
          ),
          membership: fakeMembership(true),
        },
      }),
    );
    // The resolver's live pool follows the new window: the model sees it.
    expect(calls[0]!.input!.stories.map((s) => s.id)).toEqual(['s1']);
    const s = outcome.stories.find((s) => s.id === 's1')!;
    expect(s.articles.map((a) => a.id)).toContain('a-new');
    expect(outcome.changed.has('saga')).toBe(true);
  });

  it('a Story silent past max(founding + 24h, newest + 12h) is frozen: invisible to the model, refusing merges (ADR-0027)', async () => {
    // Founded 2026-10-04T20:00Z, newest Article 2026-10-05T00:00Z, NOW
    // 2026-10-06T12:00Z: the close is founding + 24h (2026-10-05T20:00Z) —
    // the silence term (2026-10-05T12:00Z) never rose past the floor. The
    // Story is closed for good (ADR-0005): same-event fresh coverage
    // cannot merge and will birth its Episode instead.
    const calls: {
      input?: Parameters<import('./gemini.ts').GroupingModel['group']>[0];
    }[] = [];
    const outcome = await groupStories(
      input({
        articles: [article('a-new', { publishedAt: '2026-10-06T11:00:00Z' })],
        existing: [
          story({
            id: 's1',
            slug: 'passee',
            title: 'Passée',
            storyDay: '2026-10-04',
            articles: [
              article('a0', { publishedAt: '2026-10-04T20:00:00Z' }),
              article('a1', { publishedAt: '2026-10-05T00:00:00Z' }),
            ],
          }),
        ],
        clients: {
          grouping: fakeGrouping(
            {
              newStories: [],
              assignments: [
                { articleId: 'a-new', storyId: 's1', confidence: 0.9 },
              ],
            },
            calls,
          ),
          membership: fakeMembership(true),
        },
      }),
    );
    expect(calls[0]!.input!.stories).toEqual([]); // invisible to the model
    const s = outcome.stories.find((s) => s.id === 's1')!;
    expect(s.articles.map((a) => a.id)).toEqual(['a0', 'a1']); // untouched
    expect(outcome.changed.size).toBe(0);
    expect(outcome.live).toHaveLength(0);
  });

  it('the floor holds: a Story silent 23h past its founding still absorbs (founding + 24h, not founding + 12h) (ADR-0027)', async () => {
    // Founded 2026-10-05T13:00Z with a single Article, NOW 2026-10-06
    // 12:00Z: the close is founding + 24h (2026-10-06T13:00Z) — one hour
    // of life left. The pure-rolling rule ADR-0027 rejected would have
    // frozen it 11 hours ago (newest + 12h = 2026-10-06T01:00Z); the floor
    // term keeps every Story a full day.
    const outcome = await groupStories(
      input({
        articles: [article('a-new', { publishedAt: '2026-10-06T11:00:00Z' })],
        existing: [
          story({
            id: 's1',
            slug: 'soir',
            title: 'Soir',
            storyDay: '2026-10-05',
            articles: [article('a0', { publishedAt: '2026-10-05T13:00:00Z' })],
          }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [
              { articleId: 'a-new', storyId: 's1', confidence: 0.9 },
            ],
          }),
          membership: fakeMembership(true),
        },
      }),
    );
    const s = outcome.stories.find((s) => s.id === 's1')!;
    expect(s.articles.map((a) => a.id)).toContain('a-new');
    expect(outcome.changed.has('soir')).toBe(true);
  });

  it('fresh coverage of a Story silent past its extension births its Episode (ADR-0027)', async () => {
    // The predecessor froze at founding + 24h (2026-10-05T20:00Z — the
    // floor term wins here: newest + 12h = 2026-10-05T12:00Z is earlier);
    // the new development is fresh and cannot join the closed Story
    // (ADR-0005): it births the Episode (ADR-0018), and the Jev-confirmed
    // thread inherits the predecessor's Topic (ADR-0024) — the exit a 24h-
    // frozen Story already had, now also the exit for silences past the
    // extension. The two fresh Articles come from two distinct Outlets —
    // the birth minimum (ADR-0015, ADR-0027) — the scoop's Outlet plus the
    // follow-up's.
    // (The proven episode pair of the Topics suite, against a frozen
    // predecessor this time.)
    const predecessor = story({
      id: 's1',
      slug: 'oregon',
      title: 'Un adolescent tue quatre personnes dans une école de l’Oregon',
      storyDay: '2026-10-04',
      topicId: 'un-adolescent-tue-quatre-personnes-dans-une-ecole-de-l-oreg',
      articles: [
        article('a0', {
          headline:
            'Quatre morts dans une fusillade dans une école de l’Oregon',
          publishedAt: '2026-10-04T20:00:00Z',
        }),
        article('a1', {
          headline:
            'La tuerie de l’Oregon : l’adolescent avait été élève de l’école',
          publishedAt: '2026-10-05T00:00:00Z',
        }),
      ],
    });
    const outcome = await groupStories(
      input({
        articles: [
          article('a2', {
            headline:
              'Fusillade dans une école de l’Oregon : l’auteur était un ancien élève',
          }),
          article('a3', {
            outletId: 'lefigaro',
            headline:
              'La tuerie de l’Oregon : un an après, le procès s’ouvre à Portland',
          }),
        ],
        existing: [predecessor],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a3', newStoryKey: 'k1', confidence: 0.9 },
            ],
          }),
          membership: fakeMembership(true),
        },
      }),
    );
    const born = outcome.stories.find((s) => s.id === '000000000001')!;
    expect(born.topicId).toBe(predecessor.topicId);
    const p = outcome.stories.find((s) => s.id === 's1')!;
    expect(p.articles).toHaveLength(2); // untouched, closed for good
    expect(outcome.live.map((s) => s.id)).toEqual(['000000000001']);
  });

  it('a late-collected old Article (window closed) is never grouped: Unassigned, retried next build', async () => {
    // Published Oct 4 (23:50 Paris), collected Oct 7 00:10 Paris: nearly 48
    // hours old, outside the rolling 24h collection window — and the Story
    // it matched froze long ago. The Grouping model is never called.
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
          article('a-mate', {
            outletId: 'liberation',
            publishedAt: '2026-10-06T21:55:00Z',
          }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a-seed', newStoryKey: 'k1', confidence: 0.3 },
              { articleId: 'a-mate', newStoryKey: 'k1', confidence: 0.3 },
            ],
          }),
          membership: fakeMembership(true),
        },
      }),
    );
    expect(outcome.stories).toHaveLength(1);
    expect(outcome.stories[0]!.storyDay).toBe('2026-10-06');
  });

  it("a multi-member birth in collect's newest-first order: the founding is the earliest member (ADR-0026)", async () => {
    // Production shape: collect.ts delivers Articles newest-first, so the
    // first-claimed member of a proposed key is its newest one. The founding
    // instant is the earliest publishedAt among the key's Articles — the
    // 09:50 member — not the first-claimed one: the Story is born with both
    // members, not reduced to its seed and dropped (ADR-0015).
    const outcome = await groupStories(
      input({
        articles: [
          article('a-seed', { publishedAt: '2026-10-06T10:00:00Z' }),
          article('a-early', {
            outletId: 'liberation',
            publishedAt: '2026-10-06T09:50:00Z',
          }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a-seed', newStoryKey: 'k1', confidence: 0.3 },
              { articleId: 'a-early', newStoryKey: 'k1', confidence: 0.3 },
            ],
          }),
          membership: fakeMembership(true),
        },
      }),
    );
    expect(outcome.stories).toHaveLength(1);
    expect(outcome.stories[0]!.articles.map((a) => a.id)).toEqual([
      'a-seed',
      'a-early',
    ]); // newest first
    // The Story day is the founding Article's Publication day — the
    // earliest member's (ADR-0017, ADR-0026).
    expect(outcome.stories[0]!.storyDay).toBe('2026-10-06');
  });

  it("an Article published before an existing Story's founding is refused and orphaned (ADR-0026)", async () => {
    // The Story on disk was founded at 10:00Z; the fresh Article published
    // 10 minutes before that can never join — strict membership admits no
    // pre-founding Article, so the founding instant — and the window —
    // stays stable. It stays Unassigned, re-presented next build.
    const outcome = await groupStories(
      input({
        articles: [article('a-early', { publishedAt: '2026-10-06T09:50:00Z' })],
        existing: [
          story({
            articles: [article('a0', { publishedAt: '2026-10-06T10:00:00Z' })],
          }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [
              { articleId: 'a-early', storyId: 's1', confidence: 0.9 },
            ],
          }),
          membership: fakeMembership(true),
        },
      }),
    );
    const s1 = outcome.stories.find((s) => s.id === 's1')!;
    expect(s1.articles.map((a) => a.id)).toEqual(['a0']); // not merged: pre-founding
    expect(outcome.changed.size).toBe(0);
  });

  it('a Story born right after midnight keeps its 24h window across the day split (ADR-0026)', async () => {
    // Seed published 00:01 Paris on Oct 7 (22:01 UTC Oct 6), member 10
    // minutes later: the Story ingests until 22:01 UTC Oct 7 — the member
    // joins even though it is published on a different Paris day (the
    // overnight cycle belongs to the evening Story, issue #116).
    const outcome = await groupStories(
      input({
        now: new Date('2026-10-06T22:10:00Z'),
        articles: [
          article('a-seed', { publishedAt: '2026-10-06T22:01:00Z' }),
          article('a-next', {
            outletId: 'liberation',
            publishedAt: '2026-10-06T22:05:00Z',
          }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a-seed', newStoryKey: 'k1', confidence: 0.3 },
              { articleId: 'a-next', newStoryKey: 'k1', confidence: 0.3 },
            ],
          }),
          membership: fakeMembership(true),
        },
      }),
    );
    expect(outcome.stories).toHaveLength(1);
    expect(outcome.stories[0]!.storyDay).toBe('2026-10-07');
    expect(outcome.stories[0]!.articles.map((a) => a.id)).toEqual([
      'a-next',
      'a-seed',
    ]); // newest first
  });

  it('the model only sees Stories whose Ingestion window is open (ADR-0027)', async () => {
    // NOW = Oct 6 12:00Z (14:00 Paris): the Oct 5 Story was founded 26
    // hours ago and silent ever since — its window closed at founding +
    // 24h, so it is invisible to the model even though prompt text is
    // unchanged.
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

  it('an overnight cycle lands whole in one Story: each merge extends the window (ADR-0027)', async () => {
    // A Story founded 2026-10-05 22:00 UTC absorbs a full overnight cycle —
    // one Article per hour, 22:30 UTC through 21:30 UTC the next day. Every
    // merge passes its Membership check and extends the window 12 hours
    // past itself, so the day's coverage stays one Story instead of
    // forking next-day fragments (ADR-0027); the Story is still live at
    // the end of the build.
    const overnight = Array.from({ length: 24 }, (_, i) =>
      article(`b${String(i).padStart(2, '0')}`, {
        publishedAt: new Date(
          Date.parse('2026-10-05T22:00:00Z') + (i + 1) * 3_600_000,
        ).toISOString(),
      }),
    );
    const outcome = await groupStories(
      input({
        now: new Date('2026-10-06T21:45:00Z'),
        articles: [
          article('a0', { publishedAt: '2026-10-05T22:00:00Z' }),
          ...overnight,
        ],
        existing: [
          story({
            articles: [article('a0', { publishedAt: '2026-10-05T22:00:00Z' })],
          }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: overnight.map((a) => ({
              articleId: a.id,
              storyId: 's1',
              confidence: 0.9,
            })),
          }),
          membership: fakeMembership(true),
        },
      }),
    );
    const s1 = outcome.stories.find((s) => s.id === 's1')!;
    expect(s1.articles).toHaveLength(25); // a0 + the 24 merges
    const times = s1.articles.map((a) => Date.parse(a.publishedAt));
    expect(Math.max(...times) - Math.min(...times)).toBeLessThanOrEqual(
      24 * 60 * 60 * 1000,
    );
    expect(outcome.live.map((s) => s.id)).toContain('s1');
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

  describe('birth guard (issue #36, ADR-0030)', () => {
    const nobel = {
      a1: 'Le prix Nobel de littérature 2026 décerné à Anne Carson',
      a2: "Le prix Nobel de littérature décerné à l'écrivaine Anne Carson",
      a3: 'Anne Carson, écrivaine canadienne, reçoit le prix Nobel',
    };

    function nobelArticles(): Article[] {
      return [
        article('a1', { headline: nobel.a1 }),
        // Two Outlets among the twins: the collapsed birth meets the
        // two-Outlet minimum (ADR-0027).
        article('a2', { outletId: 'liberation', headline: nobel.a2 }),
        article('a3', { outletId: 'liberation', headline: nobel.a3 }),
      ];
    }

    function nobelProposal() {
      return {
        newStories: [{ key: 'k1' }, { key: 'k2' }, { key: 'k3' }],
        assignments: [
          { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
          { articleId: 'a2', newStoryKey: 'k2', confidence: 0.3 },
          { articleId: 'a3', newStoryKey: 'k3', confidence: 0.3 },
        ],
      };
    }

    function nobelTitles() {
      return fakeTitlePass({
        titles: [
          { key: 'k1', title: nobel.a1 },
          { key: 'k2', title: nobel.a2 },
          { key: 'k3', title: nobel.a3 },
        ],
      });
    }

    it('three same-build twin seeds collapse into one Story; only the twin checks run', async () => {
      const checkCalls: { story?: string; article?: string }[] = [];
      const outcome = await groupStories(
        input({
          articles: nobelArticles(),
          clients: {
            grouping: fakeGrouping(nobelProposal()),
            membership: fakeMembership(true, checkCalls),
            titles: nobelTitles(),
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
              outletId: 'liberation',
              headline: 'Le budget 2027 adopté par le Sénat',
            }),
            article('a3', {
              headline: 'Victoire du Stade Toulousain en rugby',
            }),
            article('a4', {
              outletId: 'liberation',
              headline: 'Le Stade Toulousain remporte le match de rugby',
            }),
          ],
          clients: {
            grouping: fakeGrouping({
              newStories: [{ key: 'k1' }, { key: 'k2' }],
              assignments: [
                { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
                { articleId: 'a2', newStoryKey: 'k1', confidence: 0.3 },
                { articleId: 'a3', newStoryKey: 'k2', confidence: 0.3 },
                { articleId: 'a4', newStoryKey: 'k2', confidence: 0.3 },
              ],
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
            titles: nobelTitles(),
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
              newStories: [{ key: 'k1' }],
              assignments: [
                { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
              ],
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
              newStories: [{ key: 'k1' }],
              assignments: [
                { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
              ],
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
              newStories: [{ key: 'k1' }, { key: 'k2' }],
              assignments: [
                { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
                { articleId: 'a2', newStoryKey: 'k2', confidence: 0.3 },
                { articleId: 'a3', newStoryKey: 'k2', confidence: 0.3 },
              ],
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
              newStories: [{ key: 'k1' }],
              assignments: [
                { articleId: 'a1', newStoryKey: 'k1', confidence: 0.3 },
                { articleId: 'a2', newStoryKey: 'k1', confidence: 0.3 },
              ],
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
              newStories: [{ key: 'k1' }],
              assignments: [
                ...fresh.slice(0, 21).map((a) => ({
                  articleId: a.id,
                  storyId: 's1',
                  confidence: 0.9,
                })),
                { articleId: 'a22', newStoryKey: 'k1', confidence: 0.3 },
              ],
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

    it('a same-event birth beside its live mother is absorbed — the 2026-10-24 incident (issue #140, ADR-0030)', async () => {
      // The real morning, replayed: four live Stories qualify lexically —
      // three same-subject different-fact Stories outrank the true twin,
      // so the old top-2 cap asked only the near-misses and the duplicate
      // was born. Unbounded candidates ask all four; only the mother says
      // yes, her chain joins her, and the narrow portrait retries alone.
      const absorbsCalls: { story?: string; article?: string }[] = [];
      const SURVIVOR =
        "Laurent Nuñez mobilise 70 000 forces de l'ordre pour les manifestations";
      const survivor = story({
        id: '1e52bac1f877',
        slug: 'laurent-nunez-mobilise-70-000-forces-de-l-ordre-pour-les',
        title: SURVIVOR,
        createdAt: '2026-10-23T13:01:29.637Z',
        storyDay: '2026-10-23',
        articles: [
          article('n0', {
            outletId: 'humanite',
            headline:
              '70 000 policiers et gendarmes dont « le RAID, le GIGN et la BRI » mobilisés',
            publishedAt: '2026-10-23T11:15:30.000Z',
          }),
          article('n1', {
            outletId: 'europe-1',
            headline:
              'INFO EUROPE 1 – «Actions plus violentes» et «détermination renforcée»',
            publishedAt: '2026-10-23T10:01:00.000Z',
          }),
        ],
      });
      const crowders = [
        story({
          id: '3bca5d1e9243',
          slug: 'intersyndicale',
          title:
            "L'intersyndicale maintient le parcours de la manifestation du 24 octobre à Paris malgré l'interdiction de la préfecture",
          articles: [
            article('c1a', {
              headline:
                '24 octobre : manifestation sous haute surveillance à Paris, interdite à Marseille',
              publishedAt: '2026-10-23T17:30:00.000Z',
            }),
            article('c1b', {
              outletId: 'tf1-info',
              headline:
                'Dispositif policier, interdictions... : samedi, la carte de la fermeté',
              publishedAt: '2026-10-22T18:50:22.000Z',
            }),
          ],
        }),
        story({
          id: '738eed38941c',
          slug: 'conseil-etat',
          title:
            'Le Conseil d’État saisi en urgence contre l’interdiction des manifestations non syndicales',
          articles: [
            article('c2a', {
              outletId: 'bfmtv',
              headline:
                '24 octobre: Emmanuel Macron indique que "des tracés alternatifs" seront proposés',
              publishedAt: '2026-10-23T17:10:00.000Z',
            }),
            article('c2b', {
              outletId: 'humanite',
              headline:
                'Emmanuel Macron interdit toute manifestation en dehors de celles organisées par les syndicats',
              publishedAt: '2026-10-22T10:42:05.000Z',
            }),
          ],
        }),
        story({
          id: 'ee682df6b940',
          slug: 'commercants',
          title:
            "Des commerçants s'arment pour protéger leurs boutiques avant les manifestations",
          articles: [
            article('c3a', {
              outletId: 'causeur',
              headline:
                'Paris : face aux pillages, des commerçants s’arment pour le 24 octobre',
              publishedAt: '2026-10-23T15:00:00.000Z',
            }),
          ],
        }),
      ];
      const bunch = [
        article('seed', {
          outletId: 'le-parisien',
          headline:
            'Manifestation du 24 octobre à Paris : les 24 stations de métro fermées ce samedi',
          publishedAt: '2026-10-24T05:01:18.076Z',
        }),
        article('libe', {
          outletId: 'liberation',
          headline:
            'Paroles de manifestants : «Si je commence à ne pas y aller car j’ai peur de me faire gazer, c’est une capitulation»',
          publishedAt: '2026-10-24T04:47:00.000Z',
        }),
        article('courrier', {
          outletId: 'courrier-international',
          headline:
            'Nouveau week-end de manifestations, un dispositif de sécurité “massif” déployé',
          publishedAt: '2026-10-24T04:00:05.000Z',
        }),
        article('rfi', {
          outletId: 'rfi',
          headline:
            'Manifestations en France: un «acte II» sous haute surveillance, les manifestants entre peur et détermination',
          publishedAt: '2026-10-23T22:00:49.000Z',
        }),
      ];
      const membership: import('./decision-model.ts').MembershipChecker = {
        label: 'FakeJev',
        async belongs(story, article) {
          // Only the narrow «Paroles» portrait is refused by the mother;
          // the dispositif and acte-II articles are her own chain.
          return article.headline.startsWith('Paroles') ? 'no' : 'yes';
        },
        async absorbs(story, bunch) {
          absorbsCalls.push({ story: story.title, article: bunch.title });
          return story.title === SURVIVOR ? 'yes' : 'no';
        },
        async sameSubject() {
          throw new Error('no topic check in this test');
        },
      };
      const outcome = await groupStories(
        input({
          articles: bunch,
          existing: [survivor, ...crowders],
          now: new Date('2026-10-24T05:01:18.400Z'),
          clients: {
            grouping: fakeGrouping({
              newStories: [{ key: 'k1' }],
              assignments: bunch.map((a) => ({
                articleId: a.id,
                newStoryKey: 'k1',
                confidence: 0.3,
              })),
            }),
            membership,
          },
        }),
      );
      // No twin was born: the four live Stories are the whole outcome.
      expect(outcome.stories).toHaveLength(4);
      // The guard asked EVERY qualifying candidate — under the old top-2
      // cap the three lexical crowders spent the checks and the twin was
      // never compared to its mother (issue #140).
      expect(absorbsCalls.map((c) => c.story).sort()).toEqual(
        [SURVIVOR, ...crowders.map((c) => c.title)].sort(),
      );
      // The mother absorbed her chain — the seed (on the bunch verdict)
      // and the two members that passed their own checks; the «Paroles»
      // portrait was refused and stays Unassigned, to retry next build.
      const mother = outcome.stories.find((s) => s.id === '1e52bac1f877')!;
      expect(mother.articles.map((a) => a.id).sort()).toEqual([
        'courrier',
        'n0',
        'n1',
        'rfi',
        'seed',
      ]);
      expect(
        outcome.stories.some((s) => s.articles.some((a) => a.id === 'libe')),
      ).toBe(false);
    });
  });
});

describe('meetsBirthMinimum (ADR-0015, ADR-0027)', () => {
  it('needs at least two Articles: the Article dimension of the birth minimum', () => {
    expect(meetsBirthMinimum([])).toBe(false);
    expect(meetsBirthMinimum([article('a1')])).toBe(false);
  });

  it('needs at least two distinct Outlets: the Outlet dimension (ADR-0027)', () => {
    expect(
      meetsBirthMinimum([article('a1'), article('a2'), article('a3')]), // all default to lemonde
    ).toBe(false);
  });

  it('two Articles from two distinct Outlets meet the minimum', () => {
    expect(
      meetsBirthMinimum([
        article('a1'),
        article('o1', { outletId: 'liberation' }),
      ]),
    ).toBe(true);
  });

  it('an Opinion Article counts toward the birth like any Article (ADR-0011)', () => {
    // The rule counts Articles and Outlets, never Kinds — an Opinion
    // piece from a second Outlet completes a birth.
    expect(
      meetsBirthMinimum([
        article('a1', { kind: 'news' }),
        article('o1', { outletId: 'liberation', kind: 'opinion' }),
      ]),
    ).toBe(true);
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

describe('Title pass (ADR-0023)', () => {
  it('births are titled by the pass, updates carry the full history, slugs derive from titles', async () => {
    const passCalls1: { input?: import('./title-pass.ts').TitlePassInput }[] =
      [];
    const outcome = await groupStories(
      input({
        articles: [
          article('a1', { headline: 'Le Sénat adopte le budget' }),
          article('a2', {
            outletId: 'liberation',
            headline: 'Le budget adopté cette nuit',
          }),
          article('a3', {
            headline: 'Le budget adopté',
            publishedAt: '2026-10-06T11:00:00Z',
          }),
        ],
        existing: [
          story({ articles: [article('a0', { headline: 'Ancien fait' })] }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a3', storyId: 's1', confidence: 0.9 },
            ],
          }),
          membership: fakeMembership(true),
          titles: fakeTitlePass(
            {
              titles: [{ key: 'k1', title: 'Le Sénat adopte le budget' }],
              titleUpdates: [{ storyId: 's1', title: 'Meilleur titre' }],
            },
            passCalls1,
          ),
        },
      }),
    );
    const [pass] = passCalls1;
    // One birth with both headlines; the gaining Story is an update with
    // its full history (founding Article included), not just the newcomer.
    expect(pass?.input?.births.map((b) => b.key)).toEqual(['k1']);
    expect(pass?.input?.births[0]?.headlines).toHaveLength(2);
    expect(pass?.input?.updates.map((u) => u.storyId)).toEqual(['s1']);
    expect(pass?.input?.updates[0]?.headlines).toEqual([
      'Le budget adopté',
      'Ancien fait',
    ]);
    const born = outcome.stories.find((s) => s.id === '000000000001')!;
    expect(born.title).toBe('Le Sénat adopte le budget');
    expect(born.slug).toBe('le-senat-adopte-le-budget');
    expect(outcome.stories.find((s) => s.id === 's1')!.title).toBe(
      'Meilleur titre',
    );
  });

  it('a birth similar to a Story on disk carries it as the previous episode', async () => {
    const episodeCalls: { input?: import('./title-pass.ts').TitlePassInput }[] =
      [];
    await groupStories(
      input({
        articles: [
          article('a1', {
            headline:
              'Fusillade dans une école de l’Oregon : l’auteur était un ancien élève',
          }),
          article('a2', {
            outletId: 'liberation',
            headline:
              'La tuerie de l’Oregon : l’adolescent avait été élève de l’école',
          }),
        ],
        existing: [
          story({
            title:
              'Un adolescent tue quatre personnes dans une école de l’Oregon',
            storyDay: '2026-10-05',
            topicId: 'un-adolescent-tue-quatre-personnes-dans-une-ecole-de',
            articles: [
              article('a0', {
                headline:
                  'Quatre morts dans une fusillade dans une école de l’Oregon',
                publishedAt: '2026-10-05T10:00:00Z',
              }),
            ],
          }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
            ],
          }),
          membership: fakeMembership(true),
          titles: fakeTitlePass({}, episodeCalls),
        },
      }),
    );
    const [pass] = episodeCalls;
    expect(pass?.input?.births[0]?.episode).toEqual({
      title: 'Un adolescent tue quatre personnes dans une école de l’Oregon',
      storyDay: '2026-10-05',
      // The thread's display label (topics resolve before the Title pass).
      subject: 'Ancien élève',
    });
  });

  it('an unrelated birth carries no episode context', async () => {
    const unrelatedCalls: {
      input?: import('./title-pass.ts').TitlePassInput;
    }[] = [];
    await groupStories(
      input({
        articles: [
          article('a1', { headline: 'Angèle sort son troisième album' }),
          article('a2', {
            outletId: 'liberation',
            headline: 'Angèle conclut sa tournée à Paris',
          }),
        ],
        existing: [
          story({
            title:
              'Un adolescent tue quatre personnes dans une école de l’Oregon',
            articles: [article('a0')],
          }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
            ],
          }),
          membership: fakeMembership(true),
          titles: fakeTitlePass({}, unrelatedCalls),
        },
      }),
    );
    expect(unrelatedCalls.at(-1)?.input?.births[0]?.episode).toBeUndefined();
  });

  it('a failed Title pass fails the build', async () => {
    await expect(
      groupStories(
        input({
          articles: [article('a1')],
          existing: [story({ articles: [article('a0')] })],
          clients: {
            grouping: fakeGrouping({
              newStories: [],
              assignments: [
                { articleId: 'a1', storyId: 's1', confidence: 0.9 },
              ],
            }),
            membership: fakeMembership(true),
            titles: {
              label: 'FakeTitles',
              model: 'fake',
              title: async () => {
                throw new Error('Title pass down');
              },
            },
          },
        }),
      ),
    ).rejects.toThrow('Title pass down');
  });

  it('a birth without a title from the pass fails the build', async () => {
    await expect(
      groupStories(
        input({
          articles: [article('a1'), article('a2', { outletId: 'liberation' })],
          clients: {
            grouping: fakeGrouping({
              newStories: [{ key: 'k1' }],
              assignments: [
                { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
                { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
              ],
            }),
            membership: fakeMembership(true),
            titles: fakeTitlePass({ titles: [] }),
          },
        }),
      ),
    ).rejects.toThrow(/no title for new Story key k1/);
  });

  it('updates never include Stories born this build', async () => {
    const updateCalls: { input?: import('./title-pass.ts').TitlePassInput }[] =
      [];
    await groupStories(
      input({
        articles: [article('a1'), article('a2', { outletId: 'liberation' })],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
            ],
          }),
          membership: fakeMembership(true),
          titles: fakeTitlePass({}, updateCalls),
        },
      }),
    );
    expect(updateCalls.at(-1)?.input?.updates).toEqual([]);
  });

  it('the pass is skipped when nothing was born and nothing gained Articles', async () => {
    const skippedCalls: { input?: import('./title-pass.ts').TitlePassInput }[] =
      [];
    const outcome = await groupStories(
      input({
        articles: [],
        existing: [story({ articles: [article('a0')] })],
        clients: {
          grouping: fakeGrouping({ newStories: [], assignments: [] }),
          membership: fakeMembership(true),
          titles: fakeTitlePass(null, skippedCalls),
        },
      }),
    );
    expect(outcome.changed.size).toBe(0);
    expect(skippedCalls).toHaveLength(0);
  });

  it('bestEpisodeMatch ranks the best overlap and respects the threshold', () => {
    const oregon = story({
      title: 'Un adolescent tue quatre personnes dans une école de l’Oregon',
      storyDay: '2026-10-05',
      articles: [
        article('a0', {
          headline:
            'Quatre morts dans une fusillade dans une école de l’Oregon',
        }),
      ],
    });
    const other = story({ title: 'Angèle sort son troisième album' });
    expect(
      bestEpisodeMatch(
        [
          'Fusillade dans une école de l’Oregon : l’auteur était un ancien élève',
        ],
        [other, oregon],
        '2026-10-06',
      ),
    ).toBe(oregon);
    expect(
      bestEpisodeMatch(['Angèle en concert à Paris'], [oregon], '2026-10-06'),
    ).toBeUndefined();
  });

  it('an Episode older than the age window is not the previous episode (ADR-0024)', () => {
    const oregon = story({
      title: 'Un adolescent tue quatre personnes dans une école de l’Oregon',
      storyDay: '2026-09-28',
      articles: [
        article('a0', {
          headline:
            'Quatre morts dans une fusillade dans une école de l’Oregon',
        }),
      ],
    });
    // 8 days before 2026-10-06: beyond EPISODE_MAX_AGE_DAYS (7) — the story
    // is lexically a match but stale for the reader and for Topics.
    expect(
      bestEpisodeMatch(
        [
          'Fusillade dans une école de l’Oregon : l’auteur était un ancien élève',
        ],
        [oregon],
        '2026-10-06',
      ),
    ).toBeUndefined();
    // Exactly 7 days: at the window edge, still the previous episode.
    expect(
      bestEpisodeMatch(
        [
          'Fusillade dans une école de l’Oregon : l’auteur était un ancien élève',
        ],
        [{ ...oregon, storyDay: '2026-09-29' }],
        '2026-10-06',
      ),
    ).toBeDefined();
  });
});

describe('Title pass — 25% growth gate (ADR-0027)', () => {
  it('a Story that grew less than 25% since its last title pass stays out of the retitle list', async () => {
    // 10 Articles seen at the last pass, 11 now: +1 = 10% growth — the
    // Story gained Articles but stays under the gate.
    const articles = Array.from({ length: 10 }, (_, i) =>
      article(`a${i}`, { publishedAt: `2026-10-06T0${i}:00:00Z` }),
    );
    const passCalls: { input?: import('./title-pass.ts').TitlePassInput }[] =
      [];
    const outcome = await groupStories(
      input({
        articles: [article('a10', { publishedAt: '2026-10-06T10:00:00Z' })],
        existing: [story({ articles, titledArticleCount: 10 })],
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [{ articleId: 'a10', storyId: 's1', confidence: 0.9 }],
          }),
          membership: fakeMembership(true),
          titles: fakeTitlePass(null, passCalls), // throws if the pass runs
        },
      }),
    );
    const s1 = outcome.stories.find((s) => s.id === 's1')!;
    expect(passCalls).toHaveLength(0); // nothing born, nothing to retitle
    expect(s1.articles).toHaveLength(11);
    expect(s1.title).toBe('Story un');
    expect(s1.titledArticleCount).toBe(10);
    // The Story still gained an Article: its file is rewritten, watermark
    // held — the stamp never drops the change from the build's set.
    expect(outcome.changed.has('story-un')).toBe(true);
  });

  it('a Story that grew at least 25% since its last title pass enters the retitle list with its whole headline set', async () => {
    // 8 Articles seen at the last pass, 10 now: +2 = 25% growth — the gate
    // is « at least », and the boundary fires.
    const articles = Array.from({ length: 8 }, (_, i) =>
      article(`a${i}`, { publishedAt: `2026-10-06T0${i}:00:00Z` }),
    );
    const passCalls: { input?: import('./title-pass.ts').TitlePassInput }[] =
      [];
    await groupStories(
      input({
        articles: [
          article('a8', { publishedAt: '2026-10-06T08:00:00Z' }),
          article('a9', { publishedAt: '2026-10-06T09:00:00Z' }),
        ],
        existing: [story({ articles, titledArticleCount: 8 })],
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [
              { articleId: 'a8', storyId: 's1', confidence: 0.9 },
              { articleId: 'a9', storyId: 's1', confidence: 0.9 },
            ],
          }),
          membership: fakeMembership(true),
          titles: fakeTitlePass(
            { titleUpdates: [{ storyId: 's1', title: 'Meilleur titre' }] },
            passCalls,
          ),
        },
      }),
    );
    const [pass] = passCalls;
    expect(pass?.input?.updates.map((u) => u.storyId)).toEqual(['s1']);
    // The whole headline set — all ten, newest first — never windowed or
    // truncated: the founding anchor is the prompt's update rule, not the
    // payload order (replaying oldest-first weakened it).
    expect(pass?.input?.updates[0]?.headlines).toEqual([
      'Titre a9',
      'Titre a8',
      'Titre a7',
      'Titre a6',
      'Titre a5',
      'Titre a4',
      'Titre a3',
      'Titre a2',
      'Titre a1',
      'Titre a0',
    ]);
  });

  it('a 100-Article Story that gains one Article is not re-titled — titles stop re-firing hourly (ADR-0027)', async () => {
    const articles = Array.from({ length: 100 }, (_, i) => article(`a${i}`));
    const passCalls: { input?: import('./title-pass.ts').TitlePassInput }[] =
      [];
    const outcome = await groupStories(
      input({
        articles: [article('a100')],
        existing: [story({ articles, titledArticleCount: 100 })],
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [
              { articleId: 'a100', storyId: 's1', confidence: 0.9 },
            ],
          }),
          membership: fakeMembership(true),
          titles: fakeTitlePass(null, passCalls), // throws if the pass runs
        },
      }),
    );
    const s1 = outcome.stories.find((s) => s.id === 's1')!;
    expect(passCalls).toHaveLength(0);
    expect(s1.title).toBe('Story un');
    expect(s1.titledArticleCount).toBe(100);
  });

  it('a Story with no watermark yet is re-titled once, then stamped — Stories born before ADR-0027 transition in one build', async () => {
    const articles = Array.from({ length: 4 }, (_, i) =>
      article(`a${i}`, { publishedAt: `2026-10-06T0${i + 4}:00:00Z` }),
    );
    const passCalls: { input?: import('./title-pass.ts').TitlePassInput }[] =
      [];
    const outcome = await groupStories(
      input({
        articles: [article('a4', { publishedAt: '2026-10-06T09:00:00Z' })],
        existing: [story({ articles })], // no titledArticleCount on disk
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [{ articleId: 'a4', storyId: 's1', confidence: 0.9 }],
          }),
          membership: fakeMembership(true),
          titles: fakeTitlePass(
            { titleUpdates: [{ storyId: 's1', title: 'Meilleur titre' }] },
            passCalls,
          ),
        },
      }),
    );
    expect(passCalls[0]?.input?.updates.map((u) => u.storyId)).toEqual(['s1']);
    const s1 = outcome.stories.find((s) => s.id === 's1')!;
    expect(s1.title).toBe('Meilleur titre');
    expect(s1.titledArticleCount).toBe(5);
  });

  it('a declined retitle still stamps the watermark — the pass ran over the whole set', async () => {
    // 4 Articles seen at the last pass, 5 now: +1 = 25% growth — the gate
    // fires, and the model keeps the current title.
    const articles = Array.from({ length: 4 }, (_, i) =>
      article(`a${i}`, { publishedAt: `2026-10-06T0${i + 4}:00:00Z` }),
    );
    const passCalls: { input?: import('./title-pass.ts').TitlePassInput }[] =
      [];
    const outcome = await groupStories(
      input({
        articles: [article('a4', { publishedAt: '2026-10-06T09:00:00Z' })],
        existing: [story({ articles, titledArticleCount: 4 })],
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [{ articleId: 'a4', storyId: 's1', confidence: 0.9 }],
          }),
          membership: fakeMembership(true),
          // No titleUpdates in the answer: the model declines the retitle.
          titles: fakeTitlePass({}, passCalls),
        },
      }),
    );
    expect(passCalls[0]?.input?.updates.map((u) => u.storyId)).toEqual(['s1']);
    const s1 = outcome.stories.find((s) => s.id === 's1')!;
    expect(s1.title).toBe('Story un');
    // Stamped anyway: the pass saw the whole set, so the Story re-enters
    // only on ≥ 25% further growth — not next build.
    expect(s1.titledArticleCount).toBe(5);
  });

  it('a birth is stamped with the watermark over its whole Article set; one more Article (+50%) re-enters the retitle list next build', async () => {
    const birthCalls: { input?: import('./title-pass.ts').TitlePassInput }[] =
      [];
    const outcome = await groupStories(
      input({
        articles: [
          article('a1', { headline: 'Le Sénat adopte le budget' }),
          article('a2', {
            outletId: 'liberation',
            headline: 'Le budget adopté cette nuit',
            publishedAt: '2026-10-06T11:00:00Z',
          }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
            ],
          }),
          membership: fakeMembership(true),
          titles: fakeTitlePass({}, birthCalls),
        },
      }),
    );
    const born = outcome.stories.find((s) => s.id === '000000000001')!;
    // Births always reach the pass with all their headlines (ADR-0027).
    expect(birthCalls[0]?.input?.births[0]?.headlines).toEqual([
      'Le budget adopté cette nuit',
      'Le Sénat adopte le budget',
    ]);
    expect(born.titledArticleCount).toBe(2);

    // Next build: one more Article = +50% growth since the birth pass —
    // the retitle list re-enters the Story, whole set again.
    const retitleCalls: {
      input?: import('./title-pass.ts').TitlePassInput;
    }[] = [];
    const second = await groupStories(
      input({
        articles: [
          article('a3', {
            headline: 'Le budget promulgué',
            publishedAt: '2026-10-06T11:30:00Z',
          }),
        ],
        existing: outcome.stories,
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [
              { articleId: 'a3', storyId: born.id, confidence: 0.9 },
            ],
          }),
          membership: fakeMembership(true),
          titles: fakeTitlePass(
            { titleUpdates: [{ storyId: born.id, title: 'Meilleur titre' }] },
            retitleCalls,
          ),
        },
      }),
    );
    expect(retitleCalls[0]?.input?.updates.map((u) => u.storyId)).toEqual([
      born.id,
    ]);
    expect(retitleCalls[0]?.input?.updates[0]?.headlines).toHaveLength(3);
    const grown = second.stories.find((s) => s.id === born.id)!;
    expect(grown.title).toBe('Meilleur titre');
    expect(grown.titledArticleCount).toBe(3);
  });
});

describe('Topics (ADR-0024)', () => {
  // The proven episode pair: the Oregon cluster of the day vs the previous
  // day's Oregon Story on disk (overlap ≈ 0.33, above the 0.25 threshold).
  const OREGON_EPISODE_HEADLINES = [
    'Fusillade dans une école de l’Oregon : l’auteur était un ancien élève',
    'La tuerie de l’Oregon : l’adolescent avait été élève de l’école',
  ];
  const EPISODE = story({
    title: 'Un adolescent tue quatre personnes dans une école de l’Oregon',
    storyDay: '2026-10-05',
    topicId: 'un-adolescent-tue-quatre-personnes-dans-une-ecole-de-l-oreg',
    articles: [
      article('a0', {
        headline: 'Quatre morts dans une fusillade dans une école de l’Oregon',
        publishedAt: '2026-10-16T10:00:00Z',
      }),
    ],
  });

  /** A Membership checker answering calls in sequence: the birth's internal
   * merge checks come first, the topic check last (resolveTopics runs after
   * the whole resolution). Answers the calls in order; null means 'failed'. */
  function fakeMembershipSeq(answers: (boolean | null)[]): {
    checker: import('./decision-model.ts').MembershipChecker;
    calls: { story?: string; article?: string; headlines?: string[] }[];
  } {
    const calls: { story?: string; article?: string; headlines?: string[] }[] =
      [];
    return {
      calls,
      checker: {
        label: 'FakeJev',
        async belongs(story, articleHead) {
          const answer = answers[calls.length] ?? null;
          calls.push({ story: story.title, article: articleHead.headline });
          return answer == null ? 'failed' : answer ? 'yes' : 'no';
        },
        async sameSubject(episodes, birth) {
          const answer = answers[calls.length] ?? null;
          calls.push({
            story: episodes.map((e) => e.title).join(' | '),
            article: birth.title,
            headlines: birth.headlines,
          });
          return answer == null ? 'failed' : answer ? 'yes' : 'no';
        },
        async absorbs() {
          throw new Error('no guard check in this test');
        },
      },
    };
  }

  function birthInput(
    membership: import('./decision-model.ts').MembershipChecker,
  ) {
    return input({
      articles: [
        article('a1', { headline: OREGON_EPISODE_HEADLINES[0]! }),
        article('a2', {
          outletId: 'liberation',
          headline: OREGON_EPISODE_HEADLINES[1]!,
        }),
      ],
      existing: [EPISODE],
      clients: {
        grouping: fakeGrouping({
          newStories: [{ key: 'k1' }],
          assignments: [
            { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
            { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
          ],
        }),
        membership,
        titles: fakeTitlePass(),
      },
    });
  }

  it('a birth whose Membership check confirms its Episode inherits its Topic', async () => {
    const { checker, calls } = fakeMembershipSeq([true, true]);
    const outcome = await groupStories(birthInput(checker));
    const born = outcome.stories.find((s) => s.id === '000000000001')!;
    expect(born.topicId).toBe(EPISODE.topicId);
    // The thread reached two Episodes: the Topic exists, labelled by the
    // founding Story on disk — not by the birth.
    expect(outcome.topics).toEqual([
      {
        topicId: EPISODE.topicId,
        // No slug here: the registry module mints it at merge time.
        title: EPISODE.title,
        // The short display label (ADR-0024): the thread's most distinctive
        // repeated pair — here « ancien élève », the birth's only rare
        // tokens (every token the founder shares scores zero against its
        // own document in the corpus).
        label: 'Ancien élève',
        storyDay: '2026-10-05',
        createdAt: EPISODE.createdAt,
      },
    ]);
    // The second check is the topic check: the whole thread (here just the
    // Episode) against the whole birth (title + headlines), not a lone seed
    // (the first one is the birth's internal merge).
    expect(calls).toHaveLength(2);
    expect(calls[1]?.story).toBe(EPISODE.title);
    // The birth is untitled at topic time — its headlines carry it.
    expect(calls[1]?.article).toBe('');
    expect(calls[1]?.headlines).toEqual(OREGON_EPISODE_HEADLINES);
  });

  it('a refused Episode founds a new Topic named by the founding slug', async () => {
    const { checker } = fakeMembershipSeq([true, false]);
    const outcome = await groupStories(birthInput(checker));
    const born = outcome.stories.find((s) => s.id === '000000000001')!;
    // Refused: the birth founds a prospective Topic (its own id as key —
    // no slug exists at topic time) but no registry entry — the thread has
    // a single Episode so far.
    expect(born.topicId).toBe(born.id);
    expect(outcome.topics).toEqual([]);
  });

  it('a failed Membership check fails the build (ADR-0005)', async () => {
    const { checker } = fakeMembershipSeq([true, null]);
    await expect(groupStories(birthInput(checker))).rejects.toThrow(
      /Topic resolution failed/,
    );
  });

  it('a birth with no Episode match founds a new Topic without asking Membership about the Episode', async () => {
    const { checker, calls } = fakeMembershipSeq([true]);
    const outcome = await groupStories(
      input({
        articles: [
          article('a1', {
            headline: 'Angèle sort son troisième album Instinct',
          }),
          article('a2', {
            outletId: 'liberation',
            headline: 'Instinct, le nouvel album d’Angèle',
          }),
        ],
        existing: [EPISODE],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
            ],
          }),
          membership: checker,
          titles: fakeTitlePass(),
        },
      }),
    );
    const born = outcome.stories.find((s) => s.id === '000000000001')!;
    // Prospective key only: a single-Episode thread is not a Topic yet.
    expect(born.topicId).toBe(born.id);
    expect(outcome.topics).toEqual([]);
    // The only check was the birth's internal merge — never the Episode.
    expect(calls).toHaveLength(1);
    expect(calls.every((c) => c.story !== EPISODE.title)).toBe(true);
  });

  it('an Episode without a topicId is never inherited from (no retro-assignment)', async () => {
    const { checker, calls } = fakeMembershipSeq([true]);
    const outcome = await groupStories(
      input({
        articles: [
          article('a1', { headline: OREGON_EPISODE_HEADLINES[0]! }),
          article('a2', {
            outletId: 'liberation',
            headline: OREGON_EPISODE_HEADLINES[1]!,
          }),
        ],
        existing: [{ ...EPISODE, topicId: undefined }],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
            ],
          }),
          membership: checker,
          titles: fakeTitlePass(),
        },
      }),
    );
    const born = outcome.stories.find((s) => s.id === '000000000001')!;
    // The episode matches, but there is no Topic on it to inherit — the
    // birth founds its own without spending a check.
    expect(calls).toHaveLength(1);
    expect(calls.every((c) => c.story !== EPISODE.title)).toBe(true);
    expect(born.topicId).toBe(born.id);
    expect(outcome.topics).toEqual([]);
  });

  it('the topic check sees the whole thread, oldest first', async () => {
    const { checker, calls } = fakeMembershipSeq([true, true]);
    await groupStories(birthInput(checker));
    // EPISODE (10-05) is the only story on disk — the thread is length 1.
    expect(calls[1]?.story).toBe(EPISODE.title);

    // Two stories of the same topic on disk: both go in, oldest first.
    const older = story({
      id: 's0',
      slug: 'premiere-epilogue',
      title: 'Premier épisode du sujet',
      storyDay: '2026-10-04',
      topicId: EPISODE.topicId,
      articles: [
        article('a9', {
          headline: 'Le sujet commence',
          publishedAt: '2026-10-04T10:00:00Z',
        }),
      ],
    });
    const { checker: checker2, calls: calls2 } = fakeMembershipSeq([
      true,
      true,
    ]);
    await groupStories(
      input({
        articles: [
          article('a1', { headline: OREGON_EPISODE_HEADLINES[0]! }),
          article('a2', {
            outletId: 'liberation',
            headline: OREGON_EPISODE_HEADLINES[1]!,
          }),
        ],
        existing: [EPISODE, older],
        clients: {
          grouping: fakeGrouping({
            newStories: [{ key: 'k1' }],
            assignments: [
              { articleId: 'a1', newStoryKey: 'k1', confidence: 0.9 },
              { articleId: 'a2', newStoryKey: 'k1', confidence: 0.9 },
            ],
          }),
          membership: checker2,
          titles: fakeTitlePass(),
        },
      }),
    );
    expect(calls2[1]?.story).toBe(
      'Premier épisode du sujet | ' + EPISODE.title,
    );
  });

  it('Stories that gain Articles keep their Topic; updates found nothing', async () => {
    const { checker, calls } = fakeMembershipSeq([true]);
    const outcome = await groupStories(
      input({
        articles: [article('a3', { headline: 'Le Sénat adopte le budget' })],
        existing: [
          story({
            title: 'Le budget défendu à l’Assemblée',
            articles: [article('a0', { headline: 'Le budget présenté' })],
            topicId: 'le-budget-defendu-a-l-assemblee',
          }),
        ],
        clients: {
          grouping: fakeGrouping({
            newStories: [],
            assignments: [{ articleId: 'a3', storyId: 's1', confidence: 0.9 }],
          }),
          membership: checker,
          titles: fakeTitlePass(),
        },
      }),
    );
    expect(outcome.stories.find((s) => s.id === 's1')!.topicId).toBe(
      'le-budget-defendu-a-l-assemblee',
    );
    expect(outcome.topics).toEqual([]);
    // The only check is the merge itself — Topics never spend one on updates.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.story).toBe('Le budget défendu à l’Assemblée');
  });
});
