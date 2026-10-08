import type { Leaning, StorySummaries } from '@prisme/domain';
import { LEANING_LABELS, leaningOrder } from '@prisme/domain';
import { useState } from 'react';
import AuroraBall from './AuroraBall';

/**
 * The Prism tabs (issue #7), restyled as a segmented control: one Leaning
 * per segment — the active one filled with the Leaning's color, the only
 * place color is used besides the dots — and Comparaison as a separate
 * outlined button, because it is Prisme's cross-Leaning synthesis, not one
 * Leaning's coverage. Both toggle the same panel. Every panel is rendered
 * into the HTML at once — only visibility toggles — so the content is
 * indexable and readable without JavaScript. "Non couvert par …" is derived
 * from zero Coverage (ADR-0006: never stored, never invented).
 */
export default function PrismTabs(props: {
  counts: Record<Leaning, number>;
  summaries: StorySummaries | undefined;
  differences: string | undefined;
}) {
  const { counts, summaries, differences } = props;
  // Default tab: Centre when it has a summary, else the first Leaning that
  // covers the Story, else Gauche.
  const hasSummary = (l: Leaning): boolean => (summaries?.[l]?.length ?? 0) > 0;
  const defaultTab = hasSummary('centre')
    ? 'centre'
    : (leaningOrder.find((l) => counts[l] > 0) ?? 'gauche');
  const [active, setActive] = useState<Leaning | 'comparaison'>(defaultTab);

  /** French articles for the "Non couvert par …" line (issue #7 wording). */
  const LEANING_ARTICLES: Record<Leaning, string> = {
    gauche: 'la gauche',
    centre: 'le centre',
    droite: 'la droite',
  };

  const bullets = (leaning: Leaning): string[] | undefined => {
    const stored = summaries?.[leaning];
    return stored && stored.length > 0 ? stored : undefined;
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Le sujet par tendance"
        className="flex flex-wrap items-center gap-2.5"
      >
        {/* Segmented control: one Leaning per segment. */}
        <div className="flex rounded-lg bg-hover p-0.5">
          {leaningOrder.map((leaning) => {
            const selected = active === leaning;
            return (
              <button
                key={leaning}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(leaning)}
                className={`rounded-md px-3.5 py-1 text-[14px] transition-colors cursor-pointer ${
                  selected
                    ? 'font-medium text-white'
                    : 'text-muted hover:text-ink'
                }`}
                style={
                  selected ? { background: `var(--${leaning})` } : undefined
                }
              >
                {LEANING_LABELS[leaning]}
              </button>
            );
          })}
        </div>
        {/* Comparaison: Prisme's own synthesis, styled apart with the
            favicon's aurora dot as its mark. */}
        <button
          type="button"
          role="tab"
          aria-selected={active === 'comparaison'}
          onClick={() => setActive('comparaison')}
          className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-1.5 text-[14px] transition-colors cursor-pointer ${
            active === 'comparaison'
              ? 'border-ink bg-ink text-canvas'
              : 'border-line text-muted hover:border-line-strong hover:text-ink'
          }`}
        >
          {/* The aurora ball — Prisme's mark. */}
          <AuroraBall className="size-3" />
          Comparaison
        </button>
      </div>
      {(['gauche', 'centre', 'droite', 'comparaison'] as const).map((key) => {
        const selected = active === key;
        return (
          <div key={key} role="tabpanel" hidden={!selected} className="pt-4">
            {key === 'comparaison' ? (
              differences ? (
                <p className="text-[16px] leading-relaxed text-ink">
                  {differences}
                </p>
              ) : (
                <p className="text-[13px] text-muted">
                  Comparaison indisponible.
                </p>
              )
            ) : counts[key] === 0 ? (
              <p className="text-[13px] text-muted">
                Non couvert par {LEANING_ARTICLES[key]}
              </p>
            ) : bullets(key) ? (
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[16px] leading-relaxed text-ink">
                {bullets(key)!.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">Résumé indisponible.</p>
            )}
          </div>
        );
      })}
      {/* Attribution: the Summaries and Comparaison are Prisme's synthesis. */}
      <p className="mt-6 text-[12px] text-faint">
        Synthèse générée par Prisme IA
      </p>
    </div>
  );
}
