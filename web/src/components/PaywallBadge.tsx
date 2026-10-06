import type { Paywall } from '@prisme/domain';

const labels: Record<Paywall, string | null> = {
  none: null,
  partial: 'Partiellement payant',
  full: 'Abonnement',
};

export default function PaywallBadge({ paywall }: { paywall: Paywall }) {
  const label = labels[paywall];
  if (!label) return null;
  return (
    <span className="inline-block rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
      {label}
    </span>
  );
}
