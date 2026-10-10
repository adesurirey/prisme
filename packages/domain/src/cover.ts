import { newestFirst } from './coverage.ts';
import type { Article, Outlet, Story } from './index.ts';

/**
 * Outlets whose feed images are known to be poor covers — TV stills with
 * lower-thirds, banners and channel logos, judged by hand the same way
 * Leanings are (set in config, backed by what actually appears). Their
 * images are last-resort candidates: they never win while any other Outlet
 * offers an image, whatever the freshness gap.
 */
const POOR_IMAGE_OUTLETS = new Set([
  'bfmtv',
  'cnews',
  'france-24',
  'franceinfo',
  'tf1-info',
]);

/**
 * The Story cover rule: which Article supplies the Story's image. The
 * freshest news/live Article with an image wins; ties break by id (ADR-0011:
 * an editorial never supplies the cover). Poor-image Outlets are last
 * resort only — a known-bad image loses to any other candidate, however
 * old. No Leaning is involved, and there is no quality rating — URL signals
 * proved too weak to judge pixels. The image is hotlinked from the Outlet —
 * never stored (ADR-0003).
 */
export function pickStoryImage(
  story: Story,
  // Unused since the leaning-based rules were dropped; kept so call sites
  // that pass an outlet map don't change.
  _outletById?: Map<string, Outlet>,
): Article | undefined {
  // News/live only: an editorial never supplies the cover, and neither do
  // not_news or unclassified Articles (ADR-0011).
  const candidates = story.articles
    .filter((a) => (a.kind === 'news' || a.kind === 'live') && a.imageUrl)
    .sort(newestFirst);
  const good = candidates.filter((a) => !POOR_IMAGE_OUTLETS.has(a.outletId));
  return (good.length > 0 ? good : candidates)[0];
}
