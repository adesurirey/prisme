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
import {
  type EditionActivityWindow,
  hasActivity,
  storyActivity,
} from '../story-activity';
import { storyUrl } from '../story-url';
import ActivitySparkline from './ActivitySparkline';
import BlindspotBadge from './BlindspotBadge';
import CoverageMeta from './CoverageMeta';
import ImageCredit from './ImageCredit';
import StoryImage from './StoryImage';

/**
 * One Story in the Edition index, in ranking order (issue #6: the Edition
 * orders by Outlets currently on the Front page, then Coverage): Section,
 * title, Blindspot badges, the Coverage meta line (compact strip + counted
 * Articles, then the activity sparkline — see CoverageMeta,
 * ActivitySparkline) — one whole-card link to the Story page, where the
 * Articles live, styled like the Story page's Article cards (hover surface,
 * no animation).
 *
 * The sparkline is the intrinsic replacement for the per-visitor badge
 * (ADR-0030, superseding ADR-0029's « En hausse »): the Story's real
 * Article flow across the edition's window, prerendered, identical for
 * every reader. The root still carries data-story-id — load-more counts
 * the cards with it — but nothing per-reader is decided in the browser
 * anymore; alongside the sparkline, the founding time (ADR-0026) keeps
 * every list reading as a timeline.
 *
 * Link structure: a stretched link (<a> absolute inset-0) makes the
 * whole card navigate while the image column — positioned, painted
 * above the link — carries the photo credit badge (ImageCredit, a
 * native <details>): toggling the badge never triggers navigation.
 */
export default function StoryCard({
  story,
  outlets,
  activityWindow,
  tail,
}: {
  story: Story;
  outlets: Outlet[];
  /** The edition's activity window (rolling 24 h / 7 jours): the sparkline's
   *  time base and its reader label. */
  activityWindow: EditionActivityWindow;
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
  const activity = storyActivity(story.articles, byId, activityWindow);
  // The founding instant (ADR-0026): the earliest Article's publication —
  // the timeline anchor every edition's list is read by.
  const founded = foundingInstant(story);
  return (
    <article
      className="group/card relative -mx-5"
      data-story-id={story.id}
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
            {/* The founding time (issue #136, ADR-0029): after the Coverage
                count, no prefix, desktop only (hidden on small screens where
                the meta row wraps too tight). */}
            {founded !== undefined && (
              <span className="hidden whitespace-nowrap text-faint sm:inline">
                {formatStoryDate(new Date(founded))}
              </span>
            )}
            {/* The Story's Article flow across the edition's window —
                intrinsic, identical for every reader. Pushed to the row's
                right end; wraps under the coverage line when the two don't
                fit together. */}
            {hasActivity(activity) && (
              <span className="ml-auto flex items-center text-muted">
                <ActivitySparkline
                  bins={activity}
                  windowLabel={activityWindow.label}
                />
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
