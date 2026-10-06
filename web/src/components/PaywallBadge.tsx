import type { Paywall } from '@prisme/domain';

const labels: Record<Paywall, string | null> = {
  none: null,
  partial: 'Partiellement payant',
  full: 'Abonnement',
};

export default function PaywallBadge({ paywall }: { paywall: Paywall }) {
  const label = labels[paywall];
  if (!label) return null;
  return <span className="text-[13px] text-faint">{label}</span>;
}