import type { Story } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import { buildFixtures } from './grouping-fixtures.ts';

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
