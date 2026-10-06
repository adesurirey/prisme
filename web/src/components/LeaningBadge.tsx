import type { Leaning } from '@prisme/domain';

const styles: Record<Leaning, string> = {
  gauche: 'bg-rose-100 text-rose-800 border-rose-200',
  centre: 'bg-amber-100 text-amber-800 border-amber-200',
  droite: 'bg-sky-100 text-sky-800 border-sky-200',
};

const labels: Record<Leaning, string> = {
  gauche: 'Gauche',
  centre: 'Centre',
  droite: 'Droite',
};

export default function LeaningBadge({ leaning }: { leaning: Leaning }) {
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-xs font-medium ${styles[leaning]}`}
    >
      {labels[leaning]}
    </span>
  );
}
