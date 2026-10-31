/**
 * The per-reader badge page wiring (ADR-0029, ADR-0031): one code path for every
 * edition that carries it — la Une, « En direct » and « Le fil » (pages
 * without it stay badge-free and never write the baseline).
 * Pages ship a one-line module script calling installTrendingPage();
 * the cards themselves carry data-story-id/data-summarized-at
 * (StoryCard, StoryHero) and trending.ts decides.
 */
import { installTrending, SEEN_KEY, SESSION_KEY } from './trending';

export function installTrendingPage(): void {
  // DEV-only mock: ?mock-trending seeds a fake baseline so the per-visit
  // signal (StoryCard / StoryHero slot) can be demoed without a real
  // returning-visit baseline: every Story but the last three carries a
  // re-summarization half an hour after the seeded sight (→ « faits nouveaux »);
  // those three were last re-summarized before it (no badge).
  if (import.meta.env.DEV && location.search.includes('mock-trending')) {
    const cards = [
      ...document.querySelectorAll<HTMLElement>('[data-story-id]'),
    ];
    const blob = {
      version: 3,
      stories: {} as Record<string, { seenAt: number }>,
    };
    const UNCHANGED_COUNT = 3;
    const seenAt = Date.now() - 3_600_000;
    cards.forEach((el, i) => {
      const id = el.dataset.storyId;
      if (id == null) return;
      blob.stories[id] = { seenAt };
      el.dataset.summarizedAt = new Date(
        i < cards.length - UNCHANGED_COUNT
          ? seenAt + 1_800_000
          : seenAt - 3_600_000,
      ).toISOString();
    });
    localStorage.setItem(SEEN_KEY, JSON.stringify(blob));
    sessionStorage.removeItem(SESSION_KEY);
  }

  installTrending();
}
