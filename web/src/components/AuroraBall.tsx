import type { CSSProperties } from 'react';

/**
 * The aurora ball — Prisme's mark: a glossy 3D sphere carrying the three
 * Leaning colors (centre gold → gauche red → droite blue) with a top-left
 * specular highlight and a bottom-right rim shadow. Colors come from the
 * --aurora-* theme tokens (global.css), so one rendering serves light and
 * dark. The favicon (Base.astro) ships the same mark as a data URI — see
 * favicon.ts, which mirrors this SVG.
 */
export default function AuroraBall({
  className = 'size-3',
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
      style={{ display: 'block' } as CSSProperties}
    >
      <defs>
        <linearGradient id="aurora-ball-s" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--aurora-centre)' }} />
          <stop offset="0.5" style={{ stopColor: 'var(--aurora-gauche)' }} />
          <stop offset="1" style={{ stopColor: 'var(--aurora-droite)' }} />
        </linearGradient>
        <radialGradient id="aurora-ball-h" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" style={{ stopColor: '#ffffff', stopOpacity: 0.9 }} />
          <stop offset="1" style={{ stopColor: '#ffffff', stopOpacity: 0 }} />
        </radialGradient>
        <radialGradient id="aurora-ball-d" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.7" style={{ stopColor: '#000000', stopOpacity: 0 }} />
          <stop
            offset="1"
            style={{ stopColor: '#000000', stopOpacity: 0.25 }}
          />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#aurora-ball-s)" />
      <circle cx="16" cy="16" r="15" fill="url(#aurora-ball-d)" />
      <ellipse cx="11" cy="9.5" rx="6.5" ry="5" fill="url(#aurora-ball-h)" />
    </svg>
  );
}
