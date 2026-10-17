// One-off backtest (free, no API): replay the episode mechanism over the
// data/ archive day by day and print every proposed episode link with its
// score, so a human can grade precision — the grading tool for episode
// links and Topics (ADR-0023, ADR-0024). Run: pnpm backtest:episodes
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Story } from '@prisme/domain';
import {
  bestEpisodeMatch,
  EPISODE_MIN_OVERLAP,
  overlap,
  tokens,
} from './grouping.js';

const dir = join(import.meta.dirname, '../../data/stories');

/** One Story file of the archive, with its headlines hoisted. */
interface ArchivedStory {
  story: Story;
  allHeadlines: string[];
}

const files: ArchivedStory[] = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => {
    const story = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Story;
    return {
      story,
      allHeadlines: story.articles.map((a) => a.headline),
    };
  })
  .sort(
    (a, b) =>
      a.story.storyDay.localeCompare(b.story.storyDay) ||
      a.story.createdAt.localeCompare(b.story.createdAt),
  );

// The matching goes through the production mechanism (bestEpisodeMatch:
// same scoring, same threshold, same age window) so the backtest grades the
// rule the build actually runs. Only the input order differs — the archive
// sorted by day and creation time, where production walks the disk — so
// score ties may resolve differently than a build would.
const seen: Story[] = [];
const links: {
  day: string;
  slug: string;
  episode: { title: string; storyDay: string } | undefined;
  score: number;
}[] = [];

for (const { story, allHeadlines } of files) {
  const episode = bestEpisodeMatch(allHeadlines, seen, story.storyDay);
  // The score itself is display-only — bestEpisodeMatch keeps it private.
  const score =
    episode == null
      ? 0
      : Math.max(
          ...allHeadlines.map((h) => {
            const headlineTokens = tokens(h);
            return Math.max(
              overlap(headlineTokens, tokens(episode.title)),
              ...(episode.articles ?? []).map((a) =>
                overlap(headlineTokens, tokens(a.headline)),
              ),
            );
          }),
        );
  links.push({
    day: story.storyDay,
    slug: story.slug,
    episode:
      episode == null
        ? undefined
        : { title: episode.title, storyDay: episode.storyDay },
    score,
  });
  seen.push(story);
}

const matched = links.filter((l) => l.episode != null);
console.log(
  `stories: ${links.length}, matched (>=${EPISODE_MIN_OVERLAP}): ${matched.length}\n`,
);
for (const l of links) {
  const ep = l.episode
    ? `-> (${l.score.toFixed(2)}) [${l.episode.storyDay}] ${l.episode.title}`
    : '-> —';
  console.log(`${l.day}  ${l.slug}`);
  console.log(`        ${ep}`);
}
