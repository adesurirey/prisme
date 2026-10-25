import type { Article, Story } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import {
  buildDeadlockFixture,
  buildFixtures,
  DEADLOCK_MAGNET_STORY_ID,
  DEADLOCK_MARCH_STORY_ID,
} from './grouping-fixtures.ts';

function article(id: string, headline: string, publishedAt: string) {
  return {
    id,
    outletId: 'lemonde',
    headline,
    url: `https://lemonde.fr/a/${id}`,
    publishedAt,
    frontPage: false,
  };
}

function sectioned(
  base: ReturnType<typeof article>,
  section: Article['section'],
): Article {
  return { ...base, section };
}

function story(articles: ReturnType<typeof article>[]): Story {
  return {
    id: 's1',
    slug: 'story-un',
    title: 'Story un',
    createdAt: '2026-10-06T09:00:00Z',
    storyDay: '2026-10-06',
    articles,
  };
}

describe('buildFixtures (ADR-0018)', () => {
  it('fixture Stories carry their latest member headlines, like the production prompt', () => {
    // A Story holding no fresh Article: all its Articles are members, and
    // it stays a merge target in the long-context fixture.
    const fixture = buildFixtures(
      [
        story([
          article('a0', 'Vieux titre', '2026-10-06T08:00:00Z'),
          article('a3', 'Troisième titre', '2026-10-06T10:00:00Z'),
          article('a1', 'Premier titre', '2026-10-06T10:30:00Z'),
          article('a2', 'Deuxième titre', '2026-10-06T09:30:00Z'),
        ]),
      ],
      '2026-10-06T12:00:00Z',
    );
    const live = fixture.fixtures[1]!.liveStories[0]!;
    expect(live.latestHeadlines).toEqual([
      'Premier titre',
      'Troisième titre',
      'Deuxième titre',
    ]);
    expect(live.headlines).toHaveLength(4);
  });
});

/**
 * The 2026-10-24 deadlock reconstruction (issue #149): synthetic archive
 * Stories shaped like the real ones — the magnet (tribunal ruling on the
 * Paris march route), the march Story born the next night, a live
 * distractor, a frozen Story — around the pinned build instant.
 */
describe('buildDeadlockFixture (issue #149)', () => {
  function archiveStory(
    id: string,
    createdAt: string,
    articles: Article[],
    extra?: Partial<Story>,
  ): Story {
    return {
      id,
      slug: `slug-${id}`,
      title: `Titre ${id}`,
      createdAt,
      storyDay: createdAt.slice(0, 10),
      articles,
      ...extra,
    };
  }

  /** The magnet: born 2026-10-22, its Ingestion window held open by each
   * join — its newest member at the pin (12:53) buys 12 h, so it is live. */
  const magnet = archiveStory(
    DEADLOCK_MAGNET_STORY_ID,
    '2026-10-22T19:01:26.734Z',
    [
      article('m-old', 'Recours déposé', '2026-10-23T16:58:53.000Z'),
      article(
        'm-day',
        'Le tribunal rejette le recours',
        '2026-10-24T09:42:57.000Z',
      ),
      article(
        'm-new',
        'Le cortège parisien démarre',
        '2026-10-24T12:53:10.000Z',
      ),
      // Joined after the pin — not a member at the 23:01 build.
      article('m-late', 'Retour sur la journée', '2026-10-25T18:00:00.000Z'),
    ],
    { title: 'Manifestation du 24 octobre : le tribunal rejette le recours' },
  );

  /** The march Story: born 01:01 on 2026-10-25 — it did not exist at the
   * pin, so its day Articles were the build's Unassigned fresh pool. */
  const march = archiveStory(
    DEADLOCK_MARCH_STORY_ID,
    '2026-10-25T01:01:18.542Z',
    [
      sectioned(
        article(
          'f-first',
          'Des centaines d’interpellations en soirée',
          '2026-10-24T11:59:00.000Z',
        ),
        'politics',
      ),
      sectioned(
        article(
          'f-mid',
          'Une foule immense à Paris',
          '2026-10-24T15:10:11.000Z',
        ),
        'society',
      ),
      sectioned(
        article(
          'f-last',
          'Fin de journée sous tension',
          '2026-10-24T22:07:45.000Z',
        ),
        'politics',
      ),
      // Outside the reconstruction: published after the pin, and the day
      // before the collection window — neither was fresh at 23:01.
      article(
        'f-next-day',
        'Le lendemain de la mobilisation',
        '2026-10-25T08:50:03.000Z',
      ),
      article(
        'f-eve',
        'La veille de la mobilisation',
        '2026-10-23T12:00:00.000Z',
      ),
    ],
  );

  /** A live distractor: recent coverage keeps its window open. */
  const liveDistractor = archiveStory(
    'd1a2b3c4e5f6',
    '2026-10-24T06:00:00.000Z',
    [
      article('d-1', 'Autre fait du jour', '2026-10-24T20:00:00.000Z'),
      article('d-2', 'Autre fait, suite', '2026-10-24T21:00:00.000Z'),
    ],
  );

  /** A frozen Story: newest member 2026-10-23, window closed long before
   * the pin — invisible to the model (ADR-0005). */
  const frozen = archiveStory('frozen000001', '2026-10-20T08:00:00.000Z', [
    article('z-1', 'Vieux fait', '2026-10-23T06:00:00.000Z'),
    article('z-2', 'Vieux fait, suite', '2026-10-23T07:00:00.000Z'),
  ]);

  it('reconstructs the live field as of the pinned build — magnet and distractors in, frozen out, march absent', () => {
    const fixture = buildDeadlockFixture([
      magnet,
      march,
      liveDistractor,
      frozen,
    ]);
    expect(fixture.name).toBe('deadlock');
    expect(fixture.deadlock).toEqual({
      magnetStoryId: DEADLOCK_MAGNET_STORY_ID,
    });
    const liveIds = fixture.liveStories.map((s) => s.id);
    expect(liveIds).toContain(DEADLOCK_MAGNET_STORY_ID);
    expect(liveIds).toContain('d1a2b3c4e5f6');
    expect(liveIds).not.toContain('frozen000001');
    // The march Story did not exist at the pin: never a merge target.
    expect(liveIds).not.toContain(DEADLOCK_MARCH_STORY_ID);
  });

  it('cuts each live Story’s membership at the pin and carries its latest headlines, like the production prompt', () => {
    const fixture = buildDeadlockFixture([magnet, march, liveDistractor]);
    const magnetStory = fixture.liveStories.find(
      (s) => s.id === DEADLOCK_MAGNET_STORY_ID,
    )!;
    // The 2026-10-25 member joined after the pin — not in the digest.
    expect(magnetStory.headlines).toEqual([
      'Recours déposé',
      'Le tribunal rejette le recours',
      'Le cortège parisien démarre',
    ]);
    expect(magnetStory.latestHeadlines).toEqual([
      'Le cortège parisien démarre',
      'Le tribunal rejette le recours',
      'Recours déposé',
    ]);
    expect(magnetStory.title).toBe(
      'Manifestation du 24 octobre : le tribunal rejette le recours',
    );
  });

  it('takes the day’s march Articles as the fresh pool, newest first, ground-truthed to the march Story', () => {
    const fixture = buildDeadlockFixture([magnet, march, liveDistractor]);
    expect(fixture.freshArticles).toEqual([
      {
        id: 'f-last',
        headline: 'Fin de journée sous tension',
        section: 'politics',
      },
      {
        id: 'f-mid',
        headline: 'Une foule immense à Paris',
        section: 'society',
      },
      {
        id: 'f-first',
        headline: 'Des centaines d’interpellations en soirée',
        section: 'politics',
      },
    ]);
    expect(Object.keys(fixture.groundTruth)).toEqual([
      'f-last',
      'f-mid',
      'f-first',
    ]);
    expect(new Set(Object.values(fixture.groundTruth))).toEqual(
      new Set([DEADLOCK_MARCH_STORY_ID]),
    );
  });

  it('throws a re-pin message when a pinned Story is missing from the archive', () => {
    expect(() => buildDeadlockFixture([magnet])).toThrow(/march/);
    expect(() => buildDeadlockFixture([march])).toThrow(/magnet/);
  });

  it('throws when the magnet is not live at the pinned instant — the pin itself is wrong', () => {
    const deadMagnet = archiveStory(
      DEADLOCK_MAGNET_STORY_ID,
      '2026-10-20T08:00:00.000Z',
      [article('m-x', 'Vieux recours', '2026-10-23T06:00:00.000Z')],
    );
    expect(() =>
      buildDeadlockFixture([deadMagnet, march, liveDistractor]),
    ).toThrow(/live/);
  });
});
