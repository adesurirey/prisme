/**
 * Title pass (ADR-0023): one structured-output call per build, after Grouping
 * resolution — the pass writes every Story title, so no other model output
 * ever names a title. Births get their title at creation (the slug derives
 * from it, ADR-0005); Stories that gained Articles may be re-titled while
 * live (the only retitling path — a frozen Story's title is immutable).
 * Inputs are headlines only, never the article page (ADR-0003).
 *
 * Same posture as the Grouping client: a malformed response or a retryable
 * failure is retried once — a 429 waits ~45 s first (per-minute free-tier
 * quotas reset on that timescale) — and then throws: a failed Title pass
 * fails the build, because a Story file without a title must never be
 * written.
 */

import { RATE_LIMIT_BACKOFF_MS, type Sleep } from './gemini.ts';
import { RETRYABLE_STATUS } from './http.ts';

/** The production Title pass model, pinned for traceability. Shares the
 * free-tier quota with Grouping and Summaries (RPD 500 — ADR-0022). */
export const TITLE_PASS = {
  gateway: 'google',
  model: 'gemini-3.5-flash-lite',
  label: 'Flash-Lite',
} as const;

/** One Story born this build, keyed by the Grouping proposal's key.
 * `episode` is the previous episode of the birth's confirmed Topic (ADR-0024):
 * topics resolve before this pass, so the context is only fed a Jev-judged
 * thread — a refused match is a new subject, and its title must not anchor
 * on the refused episode. `subject` is the thread's display label. */
export interface TitlePassBirth {
  key: string;
  headlines: string[];
  episode?: { title: string; storyDay: string; subject?: string };
}

/** An existing Story that grew at least 25% since its last title pass
 * (ADR-0027's retitle gate — the caller holds the watermark): full headline
 * history, so the title is framed from the whole group (ADR-0013). */
export interface TitlePassUpdate {
  storyId: string;
  title: string;
  /** The founding anchor: the Story's earliest member headline and its
   * day, labeled first in the update block — the founding event made
   * explicit instead of inferred from a headline pile that is mostly
   * newer (the Trappes retitle ratchet: three titles, each naming the
   * then-latest development). */
  founding?: { headline: string; day: string };
  headlines: string[];
}

export interface TitlePassInput {
  births: TitlePassBirth[];
  updates: TitlePassUpdate[];
}

export interface TitlePassModel {
  label: string;
  model: string;
  /** One call per build; throws on failure — the caller fails the build. */
  title(input: TitlePassInput): Promise<ParsedTitles>;
}

/** The pass's answer: a title for every birth key (the caller validates
 * completeness) and optional retitles for Stories that gained Articles. */
export interface ParsedTitles {
  titles: { key: string; title: string }[];
  titleUpdates: { storyId: string; title: string }[];
}

/** Extract and validate the answer. Entries without a usable key/storyId or
 * an empty title are dropped; a structurally broken response returns null —
 * the caller retries once, then throws (the build fails). */
export function parseTitleResponse(text: string): ParsedTitles | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (data == null || typeof data !== 'object') return null;
  const { titles, titleUpdates } = data as Record<string, unknown>;
  if (!Array.isArray(titles) || !Array.isArray(titleUpdates)) return null;

  const parsedTitles = titles.flatMap((t) => {
    if (t == null || typeof t !== 'object') return [];
    const { key, title } = t as Record<string, unknown>;
    if (typeof key !== 'string' || key === '') return [];
    if (typeof title !== 'string' || title.trim() === '') return [];
    return [{ key, title }];
  });
  const updates = titleUpdates.flatMap((u) => {
    if (u == null || typeof u !== 'object') return [];
    const { storyId, title } = u as Record<string, unknown>;
    if (typeof storyId !== 'string' || storyId === '') return [];
    if (typeof title !== 'string' || title.trim() === '') return [];
    return [{ storyId, title }];
  });
  return { titles: parsedTitles, titleUpdates: updates };
}

/** JSON Schema for the structured output (generationConfig.responseJsonSchema). */
export const TITLE_PASS_SCHEMA = {
  type: 'object',
  properties: {
    titles: {
      type: 'array',
      items: {
        type: 'object',
        properties: { key: { type: 'string' }, title: { type: 'string' } },
        required: ['key', 'title'],
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
  required: ['titles', 'titleUpdates'],
} as const;

/** The prompt: birth clusters and gaining Stories with their headlines,
 * nothing else (ADR-0003). The title rules live here and nowhere else —
 * migrated verbatim from the grouping prompt (ADR-0013). */
export function titlePassPrompt(input: TitlePassInput): string {
  const lines: string[] = [
    "Tu écris les titres des stories d'une édition de presse : un titre pour chaque story qui naît ce build, et un meilleur titre pour celles qui ont gagné des articles.",
    '',
  ];
  if (input.births.length > 0) {
    lines.push('Stories qui naissent :');
    for (const birth of input.births) {
      const episode = birth.episode
        ? ` (poursuit le sujet « ${birth.episode.subject ?? birth.episode.title} » — épisode « ${birth.episode.title} », ${birth.episode.storyDay})`
        : '';
      lines.push(`- [${birth.key}]${episode}`);
      for (const headline of birth.headlines) lines.push(`  - ${headline}`);
    }
    lines.push('');
  }
  if (input.updates.length > 0) {
    lines.push('Stories qui ont gagné des articles :');
    for (const update of input.updates) {
      lines.push(`- [${update.storyId}] Titre actuel : « ${update.title} »`);
      if (update.founding)
        lines.push(
          `  Événement fondateur (${update.founding.day}) : « ${update.founding.headline} »`,
        );
      for (const headline of update.headlines) lines.push(`  - ${headline}`);
    }
    lines.push('');
  }
  lines.push(
    'Consignes :',
    "- Pour chaque story qui naît, « titles » contient une entrée avec sa « key » et son « title » : un titre neutre en français décrivant l'événement. La qualification de l'événement vient des titres du groupe : n'utilise aucun mot de qualification qu'aucun titre source n'emploie (si tous les titres disent « attaque » ou « frappe », n'écris pas « attentat »), et n'affaiblis pas la qualification que les sources partagent (« frappes meurtrières sur un aéroport » ne devient pas « des frappes sur un aéroport »).",
    "- Le contenu du titre vient des titres du groupe : n'en reprends pas la structure (format « citation » : …, accroches, préfixes), mais les faits qu'ils rapportent — noms, lieux, chiffres, conséquences ; ce que plusieurs titres affirment doit apparaître dans le titre, noms propres compris (personnes, lieux, sigles). Un titre neutre n'est pas un titre vague.",
    "- Si la story poursuit un épisode antérieur (indiqué entre parenthèses), son titre porte le fait nouveau que les titres du groupe établissent : le lecteur qui a lu l'épisode précédent doit comprendre, depuis le titre seul, ce qui a changé. Ne reprends pas la structure du titre de l'épisode précédent.",
    "- Style du titre : un acteur nommé, un verbe d'action, un complément concret (chiffre, lieu, enjeu) — jamais le style nominal sans verbe (« Condamnation de… », « Attribution du… », « Préparatifs face à… »). Interdits : commencer par une citation entre guillemets, les préfixes de type « À la une ». Aucun mot rhétorique ou jugement de valeur : la neutralité porte sur la position, pas sur la forme.",
    "- « titleUpdates » : uniquement pour les stories qui ont gagné des articles, et uniquement si un meilleur titre existe ; un tel titre respecte le même style que ci-dessus et se formule d'après l'ensemble des titres du groupe. Sinon la story garde son titre.",
    "- Titre d'une story qui a grandi : le titre actuel nomme l'événement qui a fondé la story (rappelé en tête du bloc : « Événement fondateur ») — il en reste le sujet. Un développement ultérieur présent dans les titres du groupe (nouvel épisode, décision de justice, bilan, réaction) ne remplace pas cet événement ; au plus il le complète après deux points, et seulement si la plupart des titres l'établissent. Ne propose un nouveau titre que si le titre actuel est contredit par l'ensemble des titres ou leur reste étranger.",
  );
  return lines.join('\n');
}

/** Per-minute free-tier quotas reset on a 30–60 s timescale; other retryable
 * hiccups (5xx, network) keep the short retry pause. */
const PLAIN_RETRY_MS = 1_000;

export function geminiTitlePassModel(
  apiKey: string,
  sleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  model: string = TITLE_PASS.model,
  label: string = TITLE_PASS.label,
): TitlePassModel {
  return {
    label,
    model,
    async title(input) {
      const prompt = titlePassPrompt(input);
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: TITLE_PASS_SCHEMA,
          // A from-empty rebuild births hundreds of Stories in one call —
          // the same output scale the Grouping call already plans for.
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
            if (RETRYABLE_STATUS.has(response.status) && attempt === 1) {
              await sleep(
                response.status === 429
                  ? RATE_LIMIT_BACKOFF_MS
                  : PLAIN_RETRY_MS,
              );
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
            usageMetadata?: {
              promptTokenCount?: number;
              candidatesTokenCount?: number;
            };
          };
          const usage = data.usageMetadata;
          console.log(
            `${label} titles: prompt ${prompt.length} chars${
              usage?.promptTokenCount != null
                ? ` / ${usage.promptTokenCount} input tokens`
                : ''
            }${
              usage?.candidatesTokenCount != null
                ? ` / ${usage.candidatesTokenCount} output tokens`
                : ''
            }`,
          );
          const text = (data.candidates?.[0]?.content?.parts ?? [])
            .map((part) => part.text ?? '')
            .join('');
          const parsed = parseTitleResponse(text);
          if (!parsed) {
            if (attempt === 1) {
              console.warn(
                `${label} titles: unparseable response (chars=${text.length}), retrying once`,
              );
              continue;
            }
            throw new Error(
              `${label} titles: unparseable response after retry (chars=${text.length})`,
            );
          }
          return parsed;
        } catch (error) {
          const e = error as Error & { fatal?: boolean };
          if (attempt === 2 || e.fatal) {
            if (e instanceof Error && !e.message.startsWith(label)) {
              throw new Error(`${label} titles: ${e.message}`);
            }
            throw error;
          }
          await sleep(PLAIN_RETRY_MS);
        }
      }
      // Unreachable: both attempts either return or throw.
      throw new Error(`${label} titles: exhausted retries`);
    },
  };
}

/** The production Title pass model, from GEMINI_API_KEY. Null when the key
 * is absent — resolveModels has already failed the build for a missing key. */
export function titlePassModelFromEnv(): TitlePassModel | null {
  if (!process.env.GEMINI_API_KEY) return null;
  return geminiTitlePassModel(process.env.GEMINI_API_KEY);
}
