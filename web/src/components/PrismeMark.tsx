import type { CSSProperties } from 'react';

/**
 * The Prisme mark — the P at the wordmark's angle (+20°, top leans left;
 * docs/research/logo/recette-finale.md). Brand icon of the site:
 * Comparaison button, anywhere the product signs itself. Monochrome by
 * design: it inherits `currentColor`, so it flips with the active
 * button/theme. Path is the exact Inter Extra Bold glyph, same skew matrix
 * as the wordmark's first letter (web/scripts/generate-brand-svg.py);
 * same geometry as web/src/favicon.ts.
 */
export default function PrismeMark({
  className = 'h-3.5 w-auto',
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="-426.2 -1490 1379.2 1490"
      aria-hidden="true"
      className={className}
      style={{ display: 'block' } as CSSProperties}
    >
      <path
        fill="currentColor"
        d="M116.2 0 -426.2 -1490H184.2Q352.1 -1490 497.4 -1425Q642.7 -1360 750.8 -1243.8Q859 -1127.7 914.6 -975Q970.5 -821.4 945.1 -707Q919.7 -592.5 818.7 -528.9Q717.7 -465.3 546.7 -465.3H168.3L66.8 -744H380.8Q463.8 -744 509.3 -773.1Q554.7 -802.2 564.2 -854.1Q573.6 -906 548.5 -975Q522.8 -1045.5 475.9 -1096.7Q428.9 -1148 362.6 -1175.8Q296.3 -1203.7 213 -1203.7H30.7L468.8 0Z"
      />
    </svg>
  );
}
