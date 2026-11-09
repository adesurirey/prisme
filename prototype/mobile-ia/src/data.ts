/*
 * PROTOTYPE (throwaway, issue #173) — fixture accessors over a snapshot
 * of data/edition.json + data/outlets.json (the artifact ADR-0043 will
 * publish). No fetching: the question here is layout, not data.
 */
import { GROUPS, type Group } from './tokens';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const editionJson: any = require('../assets/edition.json');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const outletsJson: any = require('../assets/outlets.json');

export type Article = {
  id: string;
  outletId: string;
  headline: string;
  url: string;
  publishedAt: string;
  imageUrl?: string;
  kind: string;
  frontPage?: boolean;
  datedAtCollection?: boolean;
};

export type Story = {
  id: string;
  slug: string;
  title: string;
  storyDay: string;
  section: string;
  articles: Article[];
  summaries: Partial<Record<Group, string[]>>;
  differences: string[];
};

export const builtAt: string = editionJson.builtAt;

export const SORTS = [
  {
    key: 'nouveau',
    label: 'Nouveau',
    hint: 'Fondées dans les 24 h, récentes d’abord',
    stories: editionJson.latestStories as Story[],
  },
  {
    key: 'brulant',
    label: 'Brûlant',
    hint: 'La couverture, refroidie par le temps',
    stories: editionJson.feedStories as Story[],
  },
  {
    key: 'top',
    label: 'Top',
    hint: 'Où pèse la presse, sans l’âge',
    stories: editionJson.stories as Story[],
  },
] as const;

export type SortKey = (typeof SORTS)[number]['key'];

export function sortOf(key: string) {
  return SORTS.find((s) => s.key === key) ?? SORTS[1];
}

type Outlet = { id: string; name: string; leaning: string; paywall?: string };
const outlets: Outlet[] = outletsJson;
const outletById = new Map(outlets.map((o) => [o.id, o]));

export function leaningOf(id: string): string {
  return outletById.get(id)?.leaning ?? 'centre';
}

export function groupOf(leaning: string): Group {
  if (leaning === 'gauche' || leaning === 'centre-gauche') return 'gauche';
  if (leaning === 'droite' || leaning === 'centre-droite') return 'droite';
  return 'centre';
}

export function outletName(id: string): string {
  return outletById.get(id)?.name ?? id;
}

export function coverageOf(story: Story) {
  const perGroup: Record<Group, Set<string>> = {
    gauche: new Set(),
    centre: new Set(),
    droite: new Set(),
  };
  const all = new Set<string>();
  for (const a of story.articles) {
    const o = outletById.get(a.outletId);
    if (!o) continue;
    perGroup[groupOf(o.leaning)].add(o.id);
    all.add(o.id);
  }
  return {
    counts: {
      gauche: perGroup.gauche.size,
      centre: perGroup.centre.size,
      droite: perGroup.droite.size,
    },
    total: all.size,
    // Outlets grouped per Coverage group, for the story page's article list.
    articlesPerGroup: Object.fromEntries(
      GROUPS.map((g) => [
        g,
        story.articles.filter((a) => {
          const o = outletById.get(a.outletId);
          return o != null && groupOf(o.leaning) === g;
        }),
      ]),
    ) as Record<Group, Article[]>,
  };
}

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return 'à l’instant';
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

export function heroImageOf(story: Story): string | undefined {
  for (const a of story.articles) if (a.imageUrl) return a.imageUrl;
  return undefined;
}
