import type { Leaning, StorySummaries } from '@prisme/domain';
import { LEANING_LABELS, leaningOrder } from '@prisme/domain';
import { useState } from 'react';

/**
 * The Prism tabs (issue #7): one Leaning per tab, then Differences. Every
 * panel is rendered into the HTML at once — only visibility toggles — so the
 * content is indexable and readable without JavaScript. "Non couvert par …"
 * is derived from zero Coverage (ADR-0006: never stored, never invented).
 */
export default function PrismTabs(props: {
  counts: Record<Leaning, number>;
  summaries: StorySummaries | undefined;
  differences: string | undefined;
}) {
  const { counts, summaries, differences } = props;
  // Default tab: the first Leaning that covers the Story, else Gauche.
  const firstCovered = leaningOrder.find((l) => counts[l] > 0) ?? 'gauche';
  const [active, setActive] = useState<Leaning | 'differences'>(firstCovered);

  const tabs: { key: Leaning | 'differences'; label: string }[] = [
    ...leaningOrder.map((leaning) => ({
      key: leaning,
      label: LEANING_LABELS[leaning],
    })),
    { key: 'differences', label: 'Différences' },
  ];

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
        className="flex gap-1 border-b border-line"
      >
        {tabs.map(({ key, label }) => {
          const selected = active === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(key)}
              className={`px-3 py-1.5 text-[13px] transition-colors ${
                selected
                  ? 'border-b border-ink font-medium text-ink'
                  : 'border-b border-transparent text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {tabs.map(({ key }) => {
        const selected = active === key;
        return (
          <div key={key} role="tabpanel" hidden={!selected} className="pt-4">
            {key === 'differences' ? (
              differences ? (
                <p className="max-w-[36rem] text-[14px] leading-relaxed text-ink">
                  {differences}
                </p>
              ) : (
                <p className="text-[13px] text-muted">
                  Différences indisponibles.
                </p>
              )
            ) : counts[key] === 0 ? (
              <p className="text-[13px] text-muted">
                Non couvert par {LEANING_ARTICLES[key]}
              </p>
            ) : bullets(key) ? (
              <ul className="flex max-w-[36rem] list-disc flex-col gap-1.5 pl-5 text-[14px] leading-relaxed text-ink">
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
    </div>
  );
}
