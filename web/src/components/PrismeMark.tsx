import type { CSSProperties } from 'react';
import prismeMarkAsset from '../assets/brand/prisme-mark.svg?raw';

/**
 * The Prisme mark — the E at the wordmark's angle (+20°, top leans left;
 * docs/research/logo/recette-finale.md). Brand icon of the site:
 * Comparaison button, anywhere the product signs itself. Monochrome by
 * design: it inherits `currentColor`, so it flips with the active
 * button/theme. Derived from the generated asset
 * src/assets/brand/prisme-mark.svg (the single source; regenerating it via
 * web/scripts/generate-brand-svg.py updates this component and favicon.ts
 * alike — no path copy lives here).
 */

const viewBox = prismeMarkAsset.match(/viewBox="([^"]+)"/)![1];
const path = prismeMarkAsset.match(/ d="([^"]+)"/)![1];

export default function PrismeMark({
  className = 'h-3.5 w-auto',
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox={viewBox}
      aria-hidden="true"
      className={className}
      style={{ display: 'block' } as CSSProperties}
    >
      <path fill="currentColor" d={path} />
    </svg>
  );
}
