/**
 * The per-reader badge page wiring (ADR-0029): one code path for every
 * edition that carries it — la Une and « En direct » (« 7 jours » never
 * imports this, so it stays badge-free and never writes the baseline).
 * Pages ship a one-line module script calling installTrendingPage();
 * the cards themselves carry data-story-id/data-article-count
 * (StoryCard, StoryHero) and trending.ts decides.
 */
import { installTrending, SEEN_KEY, SESSION_KEY } from './trending';

export function installTrendingPage(): void {
  // DEV-only mock: ?mock-trending seeds a fake baseline so the per-visit
  // signal (StoryCard / StoryHero slot) can be demoed without a real
  // returning-visit baseline: every Story but the last three saw half its
  // Article count (≥ 25 % growth → « en hausse »); those three are
  // recorded exactly as-is (no growth → no badge).
  if (import.meta.env.DEV && location.search.includes('mock-trending')) {
    const cards = [
      ...document.querySelectorAll<HTMLElement>('[data-story-id]'),
    ];
    const blob = {
      version: 2,
      stories: {} as Record<string, { articleCount: number; seenAt: number }>,
    };
    const UNCHANGED_COUNT = 3;
    cards.forEach((el, i) => {
      const id = el.dataset.storyId;
      if (id == null) return;
      const count = Number(el.dataset.articleCount ?? 0);
      blob.stories[id] = {
        articleCount:
          i >= cards.length - UNCHANGED_COUNT
            ? count
            : Math.max(1, Math.floor(count / 2)),
        seenAt: Date.now() - 3_600_000,
      };
    });
    localStorage.setItem(SEEN_KEY, JSON.stringify(blob));
    sessionStorage.removeItem(SESSION_KEY);
  }

  installTrending();
}
