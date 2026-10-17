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

/** One live Story as fed to the Grouping model: title, Section, and its
 * latest member headlines (ADR-0018). */
export interface GroupingInputStory {
  id: string;
  title: string;
  section?: Section;
  /** The Story's latest member headlines, newest first (ADR-0018): what
   * the Story already reports, so a distinct sub-fact is visible to the
   * model instead of merging into the first on-topic title it sees. */
  latestHeadlines?: string[];
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
 * leaves their Articles unassigned); a structurally broken response returns
 * null — the caller retries once, then throws (the build fails).
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
 * Title style rules are sourced in ADR-0013 — named actor + concrete fact,
 * symmetric qualification fidelity (no escalation, no dilution), systematic
 * `titleUpdates`; don't loosen them without revisiting that decision.
 * Exported for the grouping benchmark (issue #41). */
export function groupingPrompt(input: {
  stories: GroupingInputStory[];
  articles: GroupingInputArticle[];
}): string {
  const storyLines = input.stories.map((s) => {
    const latest = (s.latestHeadlines ?? []).map((h) => `« ${h} »`).join(' ; ');
    return `- [${s.id}] ${s.title}${
      s.section ? ` (${SECTION_LABELS_FR[s.section]})` : ''
    }${latest ? ` — derniers titres joints : ${latest}` : ''}`;
  });
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
    "- Une story naît toujours d'au moins deux articles (ADR-0015) : si un article ne va avec rien, laisse-le sans entrée dans « assignments » — ne crée jamais une story pour un seul article ; il sera représenté au prochain build.",
    "- Une story correspond à un événement ou une affaire précise, jamais à un thème. N'utilise jamais de titre générique (« perspectives économiques… », « actualité politique… ») : un thème n'est pas une story.",
    "- Les derniers articles déjà joints à chaque story existante te sont donnés : ils disent ce que la story raconte déjà. Un article qui rapporte un fait distinct de ces titres ne fusionne pas dans la story, même s'il relève du même thème : s'il a un jumeau dans le lot (même fait), regroupe-les sous un « newStoryKey » ; s'il est seul, laisse-le sans entrée — il sera représenté au prochain build.",
    "- Au sein d'un même événement d'envergure, des faits distincts (volet judiciaire, volet politique, journée à venir) donnent des stories distinctes ; ne les fond jamais dans la story-mère au seul motif qu'ils touchent au même sujet.",
    '- Ne regroupe que ce qui rapporte le même événement ou la même affaire précise : un thème commun ou un protagoniste commun ne suffit pas.',
    "- Chaque nouvelle story a une « key » courte unique (lettres et chiffres) et un « title » : un titre neutre en français décrivant l'événement. La qualification de l'événement vient des titres du groupe : n'utilise aucun mot de qualification qu'aucun titre source n'emploie (si tous les titres disent « attaque » ou « frappe », n'écris pas « attentat »), et n'affaiblis pas la qualification que les sources partagent (« frappes meurtrières sur un aéroport » ne devient pas « des frappes sur un aéroport »). Ne reprends pas la structure des titres d'outlets (format « citation » : …, accroches, préfixes), mais les faits qu'ils rapportent — noms, lieux, chiffres, conséquences — viennent des titres du groupe : ce que plusieurs titres affirment doit apparaître dans le titre, noms propres compris (personnes, lieux, sigles). Un titre neutre n'est pas un titre vague. Style du titre : un acteur nommé, un verbe d'action, un complément concret (chiffre, lieu, enjeu) — jamais le style nominal sans verbe (« Condamnation de… », « Attribution du… », « Préparatifs face à… »). Interdits : commencer par une citation entre guillemets, le format « citation » : … repris des outlets, les préfixes de type « À la une ». Aucun mot rhétorique ou jugement de valeur : la neutralité porte sur la position, pas sur la forme.",
    "- « titleUpdates » (optionnel) : uniquement pour des stories qui reçoivent de nouveaux articles, et uniquement si un meilleur titre existe ; un tel titre respecte le même style que ci-dessus et se formule d'après l'ensemble des titres des articles du groupe. Sinon laisse la story inchangée.",
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
      const prompt = groupingPrompt(input);
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
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
            candidates?: {
              content?: { parts?: { text?: string }[] };
              finishReason?: string;
            }[];
            usageMetadata?: {
              promptTokenCount?: number;
              candidatesTokenCount?: number;
              thoughtsTokenCount?: number;
              totalTokenCount?: number;
            };
            promptFeedback?: { blockReason?: string };
          };
          // Token accounting per build, straight from the API's own numbers:
          // prompt size (teasers exist only here — ADR-0003 — so this is the
          // only place it can ever be measured) and output size (the build's
          // real ceiling is maxOutputTokens: 65 536 on the output side).
          const usage = data.usageMetadata;
          const usageParts = [
            `prompt ${prompt.length} chars`,
            usage?.promptTokenCount != null
              ? `${usage.promptTokenCount} input tokens`
              : null,
            usage?.candidatesTokenCount != null
              ? `${usage.candidatesTokenCount} output tokens`
              : null,
            usage?.thoughtsTokenCount != null
              ? `${usage.thoughtsTokenCount} thinking tokens`
              : null,
          ].filter((p) => p != null);
          console.log(`${label}: ${usageParts.join(' / ')}`);
          // A truncated response (MAX_TOKENS) yields incomplete JSON — log
          // the finish reason so the unparseable-retry below has a cause.
          const finishReason = data.candidates?.[0]?.finishReason;
          if (finishReason != null && finishReason !== 'STOP')
            console.warn(`${label}: finishReason=${finishReason}`);
          // A safety-blocked prompt returns 200 with no candidate at all.
          const blockReason = data.promptFeedback?.blockReason;
          if (blockReason != null)
            console.warn(
              `${label}: prompt blocked (blockReason=${blockReason})`,
            );
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
