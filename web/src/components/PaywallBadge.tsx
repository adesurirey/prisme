import type { Paywall } from '@prisme/domain';

const labels: Record<Paywall, string | null> = {
  none: null,
  partial: 'Partiellement payant',
  full: 'Abonnement',
};

/**
 * The Outlet's paywall notice. 'text' (default): the plain meta line used on
 * the media ranking page, showing every paywall level. 'chip': a scrim over
 * the Article card's image, invisible until the card is hovered or focused —
 * and only for full paywalls: on a card the user is about to click through,
 * "partiellement payant" is noise; only "Abonnement" justifies the chip.
 * On touch devices there is no hover, so on mobile screens the chip stays
 * always visible; from the md breakpoint up it reverts to hover/focus-only.
 */
export default function PaywallBadge({
  paywall,
  variant = 'text',
}: {
  paywall: Paywall;
  variant?: 'text' | 'chip';
}) {
  const label = labels[paywall];
  if (!label) return null;
  if (variant === 'chip') {
    if (paywall !== 'full') return null;
    return (
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-md bg-canvas/85 px-1.5 py-1 text-center text-[10px] leading-tight text-ink opacity-100 backdrop-blur-sm transition-opacity duration-150 ease-out md:opacity-0 md:group-hover/article:opacity-100 md:group-focus-within/article:opacity-100"
        role="note"
      >
        {label}
      </span>
    );
  }
  return <span className="text-[13px] text-muted">{label}</span>;
}
