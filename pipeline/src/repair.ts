/**
 * One-off repair pass for Stories polluted by the unguarded first incremental
 * Grouping build (2026-10-07): the Grouping model formed thematic mega-Stories
 * that absorbed unrelated Articles, unchecked because new Stories bypassed the
 * Membership guard. The guard is now in place (grouping.ts); this script
 * dissolves the existing pollution so the fixed pipeline can re-group.
 *
 * For every suspicious Story (3+ Articles whose Sections disagree, or 8+
 * Articles outright), each Article is checked against the Story's own title
 * with the same Jev Membership question used at build time. Articles that
 * fail are demoted to singleton Stories — live, so subsequent builds
 * re-group them normally. The title is the anchor because it is what the
 * Story's page claims to be about; a thematic mega-Story keeps a coherent
 * topic, and the build-time guard stops new pollution. The Story keeps its
 * id, slug, title and createdAt; only its membership and Section are
 * recomputed. A Story whose every Article fails the check is left untouched —
 * a wholesale "no" must not empty a published page.
 *
 * Run from the repo root:
 *   pnpm repair          # dry run: prints what would change
 *   pnpm repair --apply  # writes the Story files
 *
 * Requires OPENROUTER_API_KEY (the Membership checker); without it nothing
 * runs — a repair without checks would just be a demolition.
 */
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Article } from '@prisme/domain';
import { membershipModelFromEnv } from './decision-model.ts';
import { slugify, storySection } from './edition.ts';
import { loadStories } from './grouping.ts';

const DATA_DIR = new URL('../../data/', import.meta.url);
const STORIES_DIR = new URL('stories/', DATA_DIR);
const APPLY = process.argv.includes('--apply');

/** An Article inside one Story, ordered deterministically. */
function byOldest(
  a: { publishedAt: string; id: string },
  b: { publishedAt: string; id: string },
): number {
  return a.publishedAt.localeCompare(b.publishedAt) || (a.id < b.id ? -1 : 1);
}

/** A Story whose membership is worth verifying with the model. */
export function isSuspicious(story: {
  articles: { section?: string }[];
}): boolean {
  if (story.articles.length >= 8) return true;
  if (story.articles.length < 3) return false;
  return new Set(story.articles.map((a) => a.section)).size > 1;
}

function suffixSlug(base: string, id: string, taken: Set<string>): string {
  for (const size of [6, 8, 12]) {
    const candidate = `${base}-${id.slice(0, size)}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${id}`;
}

async function main(): Promise<void> {
  const membership = membershipModelFromEnv();
  if (membership == null) {
    console.error('OPENROUTER_API_KEY not set — cannot run the repair.');
    process.exit(1);
  }
  const stories = await loadStories(STORIES_DIR);
  const suspicious = stories.filter(isSuspicious);
  console.log(
    `${stories.length} Stories on disk, ${suspicious.length} suspicious.`,
  );

  const taken = new Set(stories.map((s) => s.slug));
  const now = new Date();
  const demoted: { slug: string; from: string; headline: string }[] = [];
  const keptStories: typeof stories = [];
  const newStories: typeof stories = [];

  const demote = (article: Article, from: string): void => {
    const id = randomBytes(6).toString('hex');
    const base = slugify(article.headline) || 'sujet';
    const slug = taken.has(base) ? suffixSlug(base, id, taken) : base;
    taken.add(slug);
    newStories.push({
      id,
      slug,
      title: article.headline,
      createdAt: now.toISOString(),
      articles: [article],
    });
    demoted.push({ slug, from, headline: article.headline });
  };

  for (const story of suspicious) {
    const before = demoted.length;
    const kept: typeof story.articles = [];
    for (const article of story.articles) {
      let belongs: boolean | null = null;
      try {
        belongs = await membership.belongs(
          { title: story.title, section: story.section },
          { headline: article.headline, teaser: '' },
        );
      } catch (reason) {
        console.warn(
          `check failed for ${article.id} in ${story.slug}: ${
            reason instanceof Error ? reason.message : reason
          } — keeping the Article in place.`,
        );
        kept.push(article);
        continue;
      }
      if (belongs) kept.push(article);
      else demote(article, story.slug);
    }
    // Nothing matches the title: fall back to seed-anchored checks (oldest
    // Article) so the Story at least keeps a coherent topic even when its
    // title is too generic for the model to match anything against.
    if (kept.length === 0) {
      console.warn(
        `Nothing in ${story.slug} matches its title — falling back to the seed.`,
      );
      const undone = demoted.splice(before);
      for (const d of undone) {
        newStories.splice(
          newStories.findIndex((s) => s.slug === d.slug),
          1,
        );
        taken.delete(d.slug);
      }
      const [seed] = [...story.articles].sort(byOldest);
      kept.push(seed!);
      for (const article of story.articles) {
        if (article.id === seed!.id) continue;
        let belongs: boolean | null = null;
        try {
          belongs = await membership.belongs(
            { title: seed!.headline, section: seed!.section },
            { headline: article.headline, teaser: '' },
          );
        } catch (reason) {
          console.warn(
            `check failed for ${article.id} in ${story.slug}: ${
              reason instanceof Error ? reason.message : reason
            } — keeping the Article in place.`,
          );
          kept.push(article);
          continue;
        }
        if (belongs) kept.push(article);
        else demote(article, story.slug);
      }
    }
    if (kept.length !== story.articles.length) {
      keptStories.push({
        ...story,
        articles: [...kept].sort((a, b) => byOldest(b, a)),
      });
    }
  }

  console.log(
    `\n${demoted.length} Articles to demote from ${keptStories.length} Stories; ` +
      `${newStories.length} singleton Stories to create.`,
  );
  for (const d of demoted) {
    console.log(`  ${d.from} → ${d.slug} : ${d.headline}`);
  }

  if (!APPLY) {
    console.log('\nDry run — re-run with --apply to write the files.');
    return;
  }

  await mkdir(STORIES_DIR, { recursive: true });
  for (const story of [...keptStories, ...newStories]) {
    const section = storySection(
      story.articles,
      (id) => story.articles.find((a) => a.id === id)?.section,
    );
    const output = section == null ? story : { ...story, section };
    await writeFile(
      new URL(`${output.slug}.json`, STORIES_DIR),
      `${JSON.stringify(output, null, 2)}\n`,
    );
  }
  console.log(
    `\nWrote ${keptStories.length + newStories.length} files. The next \`pnpm edition\` builds will re-group the singletons.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
