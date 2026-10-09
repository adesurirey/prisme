import type { Story } from './index.ts';

/**
 * What a valid Story file is, and how Story slugs are minted. The Story file
 * is the database (ADR-0002), so pipeline and site must agree on it — they
 * both parse through this module. Slugs follow the settled rule: the bare
 * slugified title when free, else a Story-id suffix; a within-build
 * collision is resolved deterministically from Story ids (the smallest id
 * keeps the bare slug). Slugs are fixed once a Story file exists and are
 * never reused (ADR-0005).
 */

/** The bare slugified title, or 'sujet' when nothing survives slugifying. */
export function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
}

/** The id-suffix fallback chain for one base slug, from the Story's own id. */
function suffixSlug(base: string, id: string, taken: Set<string>): string {
  for (const size of [6, 8, 12]) {
    const candidate = `${base}-${id.slice(0, size)}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${id}`;
}

/**
 * Pick a slug for a new Story: the bare slugified title when free, else a
 * Story-id suffix, extending the slice when even that is taken. This claim
 * is provisional — {@link reconcileSlugs} re-resolves within-build
 * collisions by the settled rule.
 */
export function slugFor(title: string, id: string, taken: Set<string>): string {
  const base = slugify(title) || 'sujet';
  if (!taken.has(base)) return base;
  return suffixSlug(base, id, taken);
}

/**
 * Resolve within-build slug collisions deterministically from Story ids
 * (never by ordering): among the Stories created this build that share a
 * base, the smallest Story id keeps the bare slug and the previous holder
 * falls back to a suffix from its own id. Both callers must keep both
 * Stories among the files they write.
 */
export function reconcileSlugs(created: Story[], taken: Set<string>): void {
  const byBase = new Map<string, Story[]>();
  for (const story of created) {
    const base = slugify(story.title) || 'sujet';
    const group = byBase.get(base);
    if (group) group.push(story);
    else byBase.set(base, [story]);
  }
  for (const [base, group] of byBase) {
    if (group.length < 2) continue;
    const holder = group.find((s) => s.slug === base);
    if (holder == null) continue; // an existing file owns the bare slug
    const smallest = group.reduce((a, b) => (a.id < b.id ? a : b));
    if (smallest === holder) continue;
    smallest.slug = base;
    holder.slug = suffixSlug(base, holder.id, taken);
  }
}

/**
 * Parse one raw Story file. Returns the Story, or null when the file is not
 * a well-formed Story file (id, slug, title as strings, articles as an
 * array) — the caller decides what a null means (skip with a warning).
 */
export function parseStoryFile(raw: unknown, name: string): Story | null {
  if (typeof raw !== 'object' || raw == null || Array.isArray(raw)) {
    console.warn(`Skipping malformed story file: ${name}`);
    return null;
  }
  const candidate = raw as Partial<Story>;
  if (
    typeof candidate.id === 'string' &&
    typeof candidate.slug === 'string' &&
    typeof candidate.title === 'string' &&
    Array.isArray(candidate.articles)
  ) {
    return candidate as Story;
  }
  console.warn(`Skipping malformed story file: ${name}`);
  return null;
}
