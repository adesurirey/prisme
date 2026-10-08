/**
 * Grouping-model client (issue #5): assigns new Articles to live Stories or
 * starts new ones, from Story titles + Sections and Article headline + teaser
 * only — never the article page (ADR-0003). One structured-output call per
 * build against Google's Generative Language API (free tier; see ADR-0005).
 *
 * 2.5 Flash-Lite is legacy-restricted for new projects (Google docs), so the
 * pinned model is the current Flash-Lite generation. A malformed response or
 * a retryable failure is retried once, then null: the caller degrades to
 * one-Article Stories (ADR-0005 — the build never fails on the free tier).
 */
import type { Section } from '@prisme/domain';
import { RETRYABLE_STATUS } from './http.ts';

/** The production grouping model, pinned for traceability. */
export const GROUPING = {
  gateway: 'google',
  model: 'gemini-3.5-flash-lite',
  label: 'Flash-Lite',
} as const;

export interface GroupingModel {
  label: string;
  model: string;
  /** One call per build; null after retry means degraded (ADR-0005). */
  group(input: {
    stories: GroupingInputStory[];
    articles: GroupingInputArticle[];
  }): Promise<GroupingProposal | null>;
}

/** One live Story as fed to the Grouping model: title and Section only. */
export interface GroupingInputStory {
  id: string;
  title: string;
  section?: Section;
}

/** One new Article as fed to the Grouping model: headline, teaser, Section. */
export interface GroupingInputArticle {
  id: string;
  headline: string;
  teaser: string;
  section?: Section;
}

/** What the model proposes: merges into existing Stories and new Stories. */
export interface GroupingProposal {
  newStories: { key: string; title: string }[];
  assignments: {
    articleId: string;
    storyId?: string;
    newStoryKey?: string;
    confidence: number;
  }[];
  /** Better neutral titles, only for Stories that gained Articles (Q6). */
  titleUpdates: { storyId: string; title: string }[];
}

/** JSON Schema for the structured output (generationConfig.responseFormat).
 * Exported for the grouping benchmark (issue #41). */
export const GROUPING_SCHEMA = {
  type: 'object',
  properties: {
    newStories: {
      type: 'array',
      items: {
        type: 'object',
        properties: { key: { type: 'string' }, title: { type: 'string' } },
        required: ['key', 'title'],
      },
    },
    assignments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          articleId: { type: 'string' },
          storyId: { type: 'string' },
          newStoryKey: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['articleId'],
      },
    },
    titleUpdates: {
      type: 'array',
      items: {
        type: 'object',
        properties: { storyId: { type: 'string' }, title: { type: 'string' } },
        required: ['storyId', 'title'],
      },
    },
  },
  required: ['newStories', 'assignments'],
} as const;

/**
 * Extract and validate the proposal. Invalid items are dropped (the caller
 * splits their Articles); a structurally broken response returns null —
 * the caller retries once, then degrades.
 */
export function parseGroupingResponse(text: string): GroupingProposal | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (data == null || typeof data !== 'object') return null;
  const { newStories, assignments, titleUpdates } = data as Record<
    string,
    unknown
  >;
  if (!Array.isArray(newStories) || !Array.isArray(assignments)) return null;

  const stories = newStories
    .filter(
      (story): story is { key: string; title: string } =>
        story != null &&
        typeof story === 'object' &&
        typeof (story as Record<string, unknown>).key === 'string' &&
        (story as Record<string, unknown>).key !== '' &&
        typeof (story as Record<string, unknown>).title === 'string' &&
        (story as Record<string, unknown>).title !== '',
    )
    .map(({ key, title }) => ({ key, title }));

  const parsedAssignments = assignments.flatMap((a) => {
    if (a == null || typeof a !== 'object') return [];
    const { articleId, storyId, newStoryKey, confidence } = a as Record<
      string,
      unknown
    >;
    if (typeof articleId !== 'string' || articleId === '') return [];
    const c =
      typeof confidence === 'number' && Number.isFinite(confidence)
        ? confidence
        : 0;
    return [
      {
        articleId,
        ...(typeof storyId === 'string' && storyId !== '' ? { storyId } : {}),
        ...(typeof newStoryKey === 'string' && newStoryKey !== ''
          ? { newStoryKey }
          : {}),
        confidence: Math.min(1, Math.max(0, c)),
      },
    ];
  });

  const updates = Array.isArray(titleUpdates)
    ? titleUpdates.flatMap((u) => {
        if (u == null || typeof u !== 'object') return [];
        const { storyId, title } = u as Record<string, unknown>;
        if (typeof storyId !== 'string' || storyId === '') return [];
        if (typeof title !== 'string' || title === '') return [];
        return [{ storyId, title }];
      })
    : [];

  return {
    newStories: stories,
    assignments: parsedAssignments,
    titleUpdates: updates,
  };
}

const SECTION_LABELS_FR: Record<Section, string> = {
  politics: 'Politique',
  world: 'International',
  economy: 'Économie',
  society: 'Société',
  sport: 'Sport',
  culture: 'Culture',
  science: 'Sciences/Tech',
  misc: 'Faits divers',
  other: 'Autre',
};

/** The prompt: Story titles + Sections, Article headlines + teasers, nothing else (ADR-0003).
 * Exported for the grouping benchmark (issue #41). */
export function groupingPrompt(input: {
  stories: GroupingInputStory[];
  articles: GroupingInputArticle[];
}): string {
  const storyLines = input.stories.map(
    (s) =>
      `- [${s.id}] ${s.title}${s.section ? ` (${SECTION_LABELS_FR[s.section]})` : ''}`,
  );
  const articleLines = input.articles.map((a) => {
    const teaser = a.teaser ? ` — ${a.teaser}` : '';
    return `- [${a.id}] ${a.headline}${teaser}${a.section ? ` (${SECTION_LABELS_FR[a.section]})` : ''}`;
  });
  return [
    'Tu regroupes des articles de presse par événement ou sujet (une « story »).',
    '',
    'Stories existantes :',
    ...storyLines,
    '',
    'Nouveaux articles :',
    ...articleLines,
    '',
    'Consignes :',
    '- Pour chaque nouvel article, ajoute une entrée dans « assignments » : soit « storyId » (une story existante), soit « newStoryKey » (une story à créer), avec « confidence » entre 0 et 1.',
    '- Un article qui ne va avec rien obtient sa propre nouvelle story.',
    "- Une story correspond à un événement ou une affaire précise, jamais à un thème. N'utilise jamais de titre générique (« perspectives économiques… », « actualité politique… ») : un thème n'est pas une story.",
    '- Ne regroupe que ce qui rapporte le même événement ou la même affaire précise : un thème commun ou un protagoniste commun ne suffit pas.',
    "- Chaque nouvelle story a une « key » courte unique (lettres et chiffres) et un « title » : un titre neutre en français décrivant l'événement, sans copier le titre d'un outlet ni reprendre sa formulation.",
    '- « titleUpdates » (optionnel) : uniquement pour des stories qui reçoivent de nouveaux articles, et uniquement si un meilleur titre neutre existe ; sinon laisse une story inchangée.',
  ].join('\n');
}

const RETRYABLE = RETRYABLE_STATUS;

/** USD per 1M input tokens, OpenRouter's paid price for the pinned model —
 * the free tier costs nothing, the figure prices a build for the decision
 * rule (< $0.50/build, issue #41). */
export const GROUPING_PAID_PRICE_PER_MTOK = 0.3;

function geminiGroupingModel(
  apiKey: string,
  model: string = GROUPING.model,
  label: string = GROUPING.label,
): GroupingModel {
  return {
    label,
    model,
    async group(input) {
      const body = {
        contents: [{ parts: [{ text: groupingPrompt(input) }] }],
        generationConfig: {
          // v1beta generateContent: JSON output via responseMimeType + full
          // JSON Schema in responseJsonSchema (responseFormat.text is only
          // accepted on the Interactions API).
          responseMimeType: 'application/json',
          responseJsonSchema: GROUPING_SCHEMA,
          // The default output cap would truncate large builds — the first
          // build after a reset assigns several hundred Articles in one call.
          maxOutputTokens: 65_536,
        },
      };
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'x-goog-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(60_000),
          });
          if (!response.ok) {
            const text = await response.text();
            if (RETRYABLE.has(response.status) && attempt === 1) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }
            // 401/403 and the like are config errors: fail fast, no retry.
            const error = new Error(
              `${label} HTTP ${response.status}: ${text.slice(0, 200)}`,
            );
            (error as Error & { fatal?: boolean }).fatal = true;
            throw error;
          }
          const data = (await response.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const text = (data.candidates?.[0]?.content?.parts ?? [])
            .map((part) => part.text ?? '')
            .join('');
          const parsed = parseGroupingResponse(text);
          if (!parsed) {
            if (attempt === 1) {
              console.warn(
                `${label}: unparseable response (chars=${text.length}), retrying once`,
              );
              continue;
            }
            // Silent null = the caller's degraded path with no log line: say
            // why here, or a full-singleton build is undiagnosable.
            console.warn(
              `${label}: unparseable response after retry (chars=${text.length}) — degrading to one-Article Stories`,
            );
            return null;
          }
          return parsed;
        } catch (error) {
          const e = error as Error & { fatal?: boolean };
          if (attempt === 2 || e.fatal) {
            if (e instanceof Error && !e.message.startsWith(label)) {
              throw new Error(`${label} ${e.message}`);
            }
            throw error;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      return null;
    },
  };
}

/**
 * The production grouping model, from GEMINI_API_KEY. Null when the key is
 * absent — the caller degrades to one-Article Stories (never fails the build).
 */
export function groupingModelFromEnv(): GroupingModel | null {
  if (!process.env.GEMINI_API_KEY) return null;
  return geminiGroupingModel(process.env.GEMINI_API_KEY);
}
