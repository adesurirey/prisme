/**
 * Grouping-model client (issue #5): assigns new Articles to live Stories or
 * starts new ones, from Story titles + Sections and Article headline + teaser
 * only — never the article page (ADR-0003). One structured-output call per
 * build against Google's Generative Language API (free tier; see ADR-0005).
 *
 * 2.5 Flash-Lite is legacy-restricted for new projects (Google docs), so the
 * pinned model is the current Flash-Lite generation. A malformed response or
 * a retryable failure is retried once — a 429 waits ~45 s first, because
 * per-minute free-tier quotas reset on that timescale (issue #40) — and then
 * throws: a failed Grouping call fails the build (ADR-0005, as amended),
 * because the old degrade-to-singletons path corrupted the archive
 * permanently (456 singletons from one 429 on 2026-10-08).
 */
import type { Section } from '@prisme/domain';
import { RETRYABLE_STATUS } from './http.ts';

/** The production grouping model, pinned for traceability. */
export const GROUPING = {
  gateway: 'google',
  model: 'gemini-3.5-flash-lite',
  label: 'Flash-Lite',
  /** USD per 1M input tokens, OpenRouter's paid price for this model —
   * the free tier costs nothing, the figure prices a build for the
   * decision rule (< $0.50/build, issue #41). Travels with the pin: a new
   * pinned model brings its own price. */
  paidPricePerMTok: 0.3,
} as const;

export interface GroupingModel {
  label: string;
  model: string;
  /** One call per build; throws on failure — the caller fails the build. */
  group(input: {
    stories: GroupingInputStory[];
    articles: GroupingInputArticle[];
  }): Promise<GroupingProposal>;
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
 * the caller retries once, then throws (the build fails).
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
    "- Chaque nouvelle story a une « key » courte unique (lettres et chiffres) et un « title » : un titre neutre en français décrivant l'événement, sans copier le titre d'un outlet ni reprendre sa formulation. Style du titre : un acteur nommé, un verbe d'action, un complément concret (chiffre, lieu, enjeu) — jamais le style nominal sans verbe (« Condamnation de… », « Attribution du… », « Préparatifs face à… »). Interdits : commencer par une citation entre guillemets, le format « citation » : … repris des outlets, les préfixes de type « À la une ». Aucun mot rhétorique ou jugement de valeur : la neutralité porte sur la position, pas sur la forme. Une phrase de 40 à 110 caractères qui conserve les noms propres (personnes, lieux, sigles).",
    "- « titleUpdates » : pour chaque story existante qui reçoit de nouveaux articles, propose un titre respectant le même style, formulé d'après l'ensemble des titres des articles du groupe : retiens le fait le plus précis et le plus récent que le groupe établit, pas seulement celui du premier article. Laisse le titre inchangé uniquement s'il suit déjà ce style.",
  ].join('\n');
}

const RETRYABLE = RETRYABLE_STATUS;

/**
 * Per-minute free-tier quotas (429) reset on a 30–60 s timescale, so the
 * single retry waits long enough to absorb one before giving up (issue #40).
 * Grouping makes one call per build — the wait is affordable.
 */
export const RATE_LIMIT_BACKOFF_MS = 45_000;
/** Other retryable hiccups (5xx, network) keep the short retry pause. */
const PLAIN_RETRY_MS = 1_000;

/** Injectable for tests; production sleeps for real. */
export type Sleep = (ms: number) => Promise<void>;
const defaultSleep: Sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function geminiGroupingModel(
  apiKey: string,
  sleep: Sleep = defaultSleep,
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
              await sleep(
                response.status === 429
                  ? RATE_LIMIT_BACKOFF_MS
                  : PLAIN_RETRY_MS,
              );
              continue;
            }
            // 401/403 and the like are config errors: fail fast, no retry.
            // Anything still failing after the retry throws: a failed
            // Grouping call fails the build (ADR-0005, as amended).
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
            // Unparseable after the retry fails the build (ADR-0005, as
            // amended): a silent degrade once corrupted the archive with
            // singletons that never re-merge.
            throw new Error(
              `${label}: unparseable response after retry (chars=${text.length})`,
            );
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
          // A network hiccup gets the same one retry as a 5xx.
          await sleep(PLAIN_RETRY_MS);
        }
      }
      // Unreachable: both attempts either return or throw.
      throw new Error(`${label}: exhausted retries`);
    },
  };
}

/**
 * The production grouping model, from GEMINI_API_KEY. Null when the key is
 * absent — the caller fails the build (ADR-0005, as amended: a degraded
 * grouping corrupts the archive with singletons that never re-merge).
 */
export function groupingModelFromEnv(): GroupingModel | null {
  if (!process.env.GEMINI_API_KEY) return null;
  return geminiGroupingModel(process.env.GEMINI_API_KEY);
}
