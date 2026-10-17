import type { Outlet, Story } from '@prisme/domain';
import {
  blindspots,
  coverageCounts,
  exposureShares,
  pickStoryImage,
  reportingOutletIds,
} from '@prisme/domain';
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
 * The root carries data-story-id/data-coverage for the client-side
 * per-visitor badges (trending.ts): "En hausse" for a Coverage gain since
 * the reader's last visit, "Nouveau" for a Story absent from it
 * (ADR-0020). The prerendered HTML has no idea who is reading, so the
 * per-visitor signals are decided in the browser.
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
  return (
    <article
      className="group/card relative -mx-5"
      data-story-id={story.id}
      data-coverage={reporting}
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
          {/* The per-visitor badge slot ("En hausse" or "Nouveau",
              trending.ts) sits above the title — a per-visitor highlight
              deserves the first read, not the bottom of the meta pile.
              Invisible (empty:hidden) until trending.ts appends the
              client-side badge. */}
          <p data-trending-slot className="empty:hidden mb-1 text-[13px]" />
          <h2 className="text-[16px] font-semibold sm:text-[18px] leading-snug tracking-[-0.01em] group-hover/card:underline">
            {story.title}
          </h2>
          {/* The "maj." date is the Story's newest Article — the same
              articles[0] the Story page header reads. */}
          {/* Meta on one row, both tiers inline. */}
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted sm:gap-x-3">
            <CoverageMeta
              counts={counts}
              shares={shares}
              reporting={reporting}
              totalOutlets={outlets.length}
            />
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
