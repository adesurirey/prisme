/**
 * Photo credit: the unfolding "i" badge. A native <details>/<summary> —
 * no hydration, so it works on click, touch and keyboard with zero JS.
 * Closed: a small frosted "i" glyph in the top-right corner. Open: the
 * badge unfolds into the credit pill.
 *
 * The credit is the Outlet name — feeds carry no photographer field.
 *
 * Shared by the Story page hero (ImageCredit.astro wraps this), the
 * Edition's StoryHero and the StoryCard thumbnails. `compact` shrinks
 * the badge for small images (StoryCard's 128px thumbnail) so it never
 * crowds the picture.
 *
 * Sizing and touch targets: the visible pill is 24px (default) or 20px
 * (compact); the summary adds transparent padding (with matching negative
 * margins, so the layout does not move) that stretches the tappable zone
 * to 44px on heroes — Apple HIG's touch-target size — and 32px on
 * thumbnails, past WCAG 2.2 AA's 24px minimum without stealing half the
 * little image from the card link.
 *
 * Positioning: absolute top-right of the nearest positioned ancestor —
 * callers keep it OUT of the card's link (stretched-link pattern or a
 * positioned sibling) so toggling the badge never triggers navigation.
 */
const PILL =
  'flex items-center gap-0.5 rounded-full bg-white/55 text-current backdrop-blur-sm transition-colors hover:bg-white/80 dark:bg-black/35 dark:hover:bg-black/50';

export default function ImageCredit({
  name,
  compact = false,
}: {
  /** Outlet name, e.g. "Reuters". */
  name: string;
  /** Small-image variant (StoryCard thumbnails). */
  compact?: boolean;
}) {
  return (
    <details
      className="group pointer-events-auto absolute top-2 right-2 z-10 data-[compact]:top-1 data-[compact]:right-1"
      data-compact={compact ? '' : undefined}
    >
      <summary
        className={`flex max-w-[calc(100vw-2.5rem)] cursor-pointer list-none items-center rounded-full text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] dark:text-white dark:focus-visible:outline-white [&::-webkit-details-marker]:hidden ${
          compact ? 'p-1.5 -m-1.5' : 'p-2.5 -m-2.5'
        }`}
        aria-label={`Crédit photo : ${name}`}
      >
        <span className={PILL}>
          <span
            className={`flex shrink-0 items-center justify-center text-current ${
              compact ? 'h-5 w-5' : 'h-6 w-6'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              className={compact ? 'h-3 w-3' : 'h-[15px] w-[15px]'}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M12 11v5"></path>
              <path d="M12 7.5h.01"></path>
            </svg>
          </span>
          <span
            className={`hidden whitespace-nowrap font-normal tracking-normal text-current group-open:block ${
              compact ? 'pr-2 text-[11px]' : 'pr-3 text-[13px]'
            }`}
          >
            Photo : {name}
          </span>
        </span>
      </summary>
    </details>
  );
}
