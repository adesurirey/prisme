import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Article, ArticleKind, Section } from '@prisme/domain';
import { WINNER, PROMPT_VERSION, type DecisionModel } from './decision-model.ts';

/**
 * Incremental classification (issue #4): only new Articles — ids absent from
 * the cache — are sent to the model; the rest reuse their stored kind and
 * section. The cache is `data/classifications.json`, committed on each build
 * (ADR-0002: the git repo is the database). It carries kinds and sections
 * only — never headline or teaser text (ADR-0003).
 */

export interface ClassificationCache {
  /** Which model and prompt produced the entries (traceability). */
  winner: { gateway: string; model: string; promptVersion: number };
  /** article id → kind and section (section null for not_news). */
  entries: Record<string, { kind: ArticleKind; section: Section | null }>;
}

export function emptyCache(): ClassificationCache {
  return { winner: { gateway: WINNER.gateway, model: WINNER.model, promptVersion: PROMPT_VERSION }, entries: {} };
}

export async function loadCache(path: URL): Promise<ClassificationCache> {
  try {
    const cache = JSON.parse(await readFile(path, 'utf8')) as ClassificationCache;
    return cache.entries ? cache : emptyCache();
  } catch {
    return emptyCache();
  }
}

export async function saveCache(cache: ClassificationCache, path: URL): Promise<void> {
  await mkdir(dirname(path.pathname), { recursive: true });
  await writeFile(path, JSON.stringify(cache, null, 2) + '\n');
}

const CONCURRENCY = 4;

/**
 * Classify Articles whose id is not yet in the cache, merging results into it.
 * A failed or invalid classification leaves the Article out of the cache —
 * it is kept, unclassified, and retried on the next build (like a failed
 * feed: never dropped because the model hiccupped).
 */
export async function classifyNewArticles(
  articles: Article[],
  teasers: Map<string, string>,
  cache: ClassificationCache,
  model: DecisionModel | null,
): Promise<ClassificationCache> {
  const fresh = articles.filter((article) => cache.entries[article.id] == null);
  if (fresh.length === 0 || model == null) return cache;

  let index = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (index < fresh.length) {
        const article = fresh[index++]!;
        const classification = await model.classify({
          headline: article.headline,
          teaser: teasers.get(article.id) ?? '',
        });
        if (classification) {
          cache.entries[article.id] = {
            kind: classification.kind,
            // The Section answer is ignored for not_news (settled in #4).
            section: classification.kind === 'not_news' ? null : classification.section,
          };
        } else {
          console.warn(`Classification failed: ${article.id} — kept without kind.`);
        }
      }
    }),
  );
  return cache;
}

/** The kind recorded for an Article, or undefined when unclassified. */
export function kindOf(article: Article, cache: ClassificationCache): ArticleKind | undefined {
  return cache.entries[article.id]?.kind;
}

/**
 * not_news Articles never reach the Edition (issue #4). Unclassified
 * Articles are kept: dropping them is reserved for a successful
 * classification.
 */
export function dropNotNews(articles: Article[], cache: ClassificationCache): Article[] {
  return articles.filter((article) => kindOf(article, cache) !== 'not_news');
}