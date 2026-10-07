import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Article, ArticleKind, Section } from '@prisme/domain';
import {
  type Classification,
  type DecisionModel,
  PROMPT_VERSION,
  WINNER,
} from './decision-model.ts';
import { runPool } from './pool.ts';

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
  return {
    winner: {
      gateway: WINNER.gateway,
      model: WINNER.model,
      promptVersion: PROMPT_VERSION,
    },
    entries: {},
  };
}

export async function loadCache(path: URL): Promise<ClassificationCache> {
  try {
    const cache = JSON.parse(
      await readFile(path, 'utf8'),
    ) as ClassificationCache;
    if (!cache.entries) return emptyCache();
    // Entries classified by another model or prompt are stale: reclassify.
    if (
      cache.winner?.model !== WINNER.model ||
      cache.winner?.promptVersion !== PROMPT_VERSION
    ) {
      console.warn(
        `Classification cache was built with ${cache.winner?.model ?? 'an unknown model'} ` +
          `(prompt ${cache.winner?.promptVersion ?? '?'}) — discarding it for re-classification.`,
      );
      return emptyCache();
    }
    return cache;
  } catch {
    return emptyCache();
  }
}

export async function saveCache(
  cache: ClassificationCache,
  path: URL,
): Promise<void> {
  await mkdir(dirname(path.pathname), { recursive: true });
  await writeFile(path, JSON.stringify(cache, null, 2) + '\n');
}

const CONCURRENCY = 4;

/**
 * Classify Articles whose id is not yet in the cache, merging results into it.
 * A failed or invalid classification leaves the Article out of the cache —
 * it is kept, unclassified, and retried on the next build (like a failed
 * feed: never dropped because the model hiccupped). A thrown error is
 * handled exactly like an invalid answer: logged, article unclassified,
 * build continues.
 */
export async function classifyNewArticles(
  articles: Article[],
  teasers: Map<string, string>,
  cache: ClassificationCache,
  model: DecisionModel | null,
): Promise<ClassificationCache> {
  const fresh = articles.filter((article) => cache.entries[article.id] == null);
  if (fresh.length === 0 || model == null) return cache;

  await runPool(fresh, CONCURRENCY, async (article) => {
    let classification: Classification | null = null;
    try {
      classification = await model.classify({
        headline: article.headline,
        teaser: teasers.get(article.id) ?? '',
      });
    } catch (reason) {
      console.warn(
        `Classification failed: ${article.id} — ${reason instanceof Error ? reason.message : reason}`,
      );
    }
    if (classification) {
      cache.entries[article.id] = {
        kind: classification.kind,
        // The Section answer is ignored for not_news (settled in #4).
        section:
          classification.kind === 'not_news' ? null : classification.section,
      };
    } else {
      console.warn(`Classification failed: ${article.id} — kept without kind.`);
    }
  });
  return cache;
}

/** The kind recorded for an Article, or undefined when unclassified. */
export function kindOf(
  article: Article,
  cache: ClassificationCache,
): ArticleKind | undefined {
  return cache.entries[article.id]?.kind;
}

/**
 * not_news Articles never reach the Edition (issue #4). Unclassified
 * Articles are kept: dropping them is reserved for a successful
 * classification.
 */
export function dropNotNews(
  articles: Article[],
  cache: ClassificationCache,
): Article[] {
  return articles.filter((article) => kindOf(article, cache) !== 'not_news');
}
