import type { CSSProperties } from 'react';

/**
 * The Prisme mark — the upright P (docs/research/logo/recette-finale.md).
 * Brand icon of the site: Comparaison button, anywhere the product signs
 * itself. Monochrome by design: it inherits `currentColor`, so it flips
 * with the active button/theme. Path is the exact Inter Extra Bold glyph
 * (web/scripts/generate-brand-svg.py); same geometry as web/src/favicon.ts.
 */
export default function PrismeMark({
  className = 'h-3.5 w-auto',
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="116.2 -1490 1153.3 1490"
      aria-hidden="true"
      className={className}
      style={{ display: 'block' } as CSSProperties}
    >
      <path
        fill="currentColor"
        d="M116.2 0V-1490H726.5Q894.4 -1490 1016 -1425Q1137.6 -1360 1203.5 -1243.8Q1269.4 -1127.7 1269.4 -975Q1269.4 -821.4 1202.4 -707Q1135.4 -592.5 1011.2 -528.9Q887 -465.3 716.1 -465.3H337.6V-744H651.6Q734.6 -744 790.7 -773.1Q846.7 -802.2 875 -854.1Q903.4 -906 903.4 -975Q903.4 -1045.5 875 -1096.7Q846.7 -1148 790.6 -1175.8Q734.4 -1203.7 651.1 -1203.7H468.8V0Z"
      />
    </svg>
  );
}
