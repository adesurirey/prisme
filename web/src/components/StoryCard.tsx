import type { Outlet, Story } from '@prisme/domain';
import {
  blindspots,
  coverageCounts,
  exposureShares,
  foundingInstant,
  pickStoryImage,
  reportingOutletIds,
} from '@prisme/domain';
import { formatStoryDate } from '../article-date';
import { withBase } from '../data';
import { storyUrl } from '../story-url';
import BlindspotBadge from './BlindspotBadge';
import CoverageMeta from './CoverageMeta';
import ImageCredit from './ImageCredit';
import StoryImage from './StoryImage';

/**
 * One Story in the Edition index, in ranking order (issue #6: the Edition
 * orders by Outlets currently on the Front page, then Coverage): Section,
 * title, Blindspot badges, the Coverage meta line (compact strip + counted
 * Articles — see CoverageMeta) — one whole-card link
 * to the Story page, where the Articles live, styled like the Story page's
 * Article cards (hover surface, no animation).
 *
 * The root carries data-story-id/data-article-count for the client-side
 * per-visitor badge (trending.ts): "En hausse" when the Story's Article
 * count grew ≥ 25 % since the reader's last visit — the same domain gate
 * that re-fires a Summaries pass (ADR-0029). The prerendered HTML has no
 * idea who is reading, so the per-visitor signal is decided in the
 * browser.
 *
 * Link structure: a stretched link (<a> absolute inset-0) makes the
 * whole card navigate while the image column — positioned, painted
 * above the link — carries the photo credit badge (ImageCredit, a
 * native <details>): toggling the badge never triggers navigation.
 */
export default function StoryCard({
  story,
  outlets,
  tail,
}: {
  story: Story;
  outlets: Outlet[];
  /** Load-more tail marker (index.astro): the CSS rule
   * `html.js [data-load-more-tail]` hides the card before first paint,
   * load-more.ts flips `data-revealed` to bring it in. */
  tail?: boolean;
}) {
  const byId = new Map(outlets.map((o) => [o.id, o]));
  const counts = coverageCounts(story.articles, byId);
  const shares = exposureShares(story.articles, byId);
  const reporting = reportingOutletIds(story.articles).size;
  const spots = blindspots(counts);
  const image = pickStoryImage(story, byId);
  const imageOutlet = image && byId.get(image.outletId);
  // The founding instant (ADR-0026): the earliest Article's publication —
  // the timeline anchor every edition's list is read by.
  const founded = foundingInstant(story);
  return (
    <article
      className="group/card relative -mx-5"
      data-story-id={story.id}
      data-article-count={story.articles.length}
      data-load-more-tail={tail ? '' : undefined}
    >
      {/* Stretched link: the whole card navigates. */}
      {/* biome-ignore lint/a11y/useAnchorContent: the link is the card's
          click surface; the accessible name comes from the story title
          the card displays right next to it. */}
      <a
        href={withBase(storyUrl(story))}
        aria-label={story.title}
        className="absolute inset-0 rounded-xl"
      />
      <div className="flex items-start gap-4 px-5 py-5">
        <div className="min-w-0 flex-1">
          {/* The per-visitor badge slot ("En hausse",
              trending.ts) sits above the title — a per-visitor highlight
              deserves the first read, not the bottom of the meta pile.
              Invisible (empty:hidden) until trending.ts appends the
              client-side badge. */}
          <p data-trending-slot className="empty:hidden mb-1 text-[13px]" />
          <h2 className="text-[16px] font-semibold sm:text-[18px] leading-snug tracking-[-0.01em] group-hover/card:underline">
            {story.title}
          </h2>
          {/* The founding time (issue #136, ADR-0029): after the Coverage
              count, no prefix, desktop only (hidden on small screens where
              the meta row wraps too tight) — today « 21:11 »,
              yesterday « hier à 21:11 », older « 7 oct. » — so every
              list (En direct, Aujourd'hui, 7 jours) reads as a timeline. */}
          {/* Meta on one row, both tiers inline. */}
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted sm:gap-x-3">
            <CoverageMeta
              counts={counts}
              shares={shares}
              reporting={reporting}
              totalOutlets={outlets.length}
            />
            {founded !== undefined && (
              <span className="hidden whitespace-nowrap text-faint sm:inline">
                {formatStoryDate(new Date(founded))}
              </span>
            )}
          </p>
          {spots.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {spots.map((leaning) => (
                <BlindspotBadge key={leaning} leaning={leaning} />
              ))}
            </div>
          )}
        </div>
        {/* Painted above the stretched link but click-through (the column
            is pointer-events-none): tapping the thumbnail navigates via
            the stretched link; the credit badge re-enables pointer events
            so it toggles without following the card link. */}
        <div className="pointer-events-none relative shrink-0 self-center">
          {image && imageOutlet && (
            <StoryImage
              article={image}
              outlet={imageOutlet}
              className="h-18 w-32 rounded-md"
              sizes="128px"
            />
          )}
          {imageOutlet && <ImageCredit name={imageOutlet.name} compact />}
        </div>
      </div>
    </article>
  );
}
