/**
 * Decision-model client (issue #4): classifies an Article's Kind and Section
 * from its headline + teaser only — never the article page (ADR-0003).
 *
 * Jev (jevmodel.net) and Cloudflare Clef-flash share the same typed-questions
 * API shape: POST a state + questions schema, get per-option probabilities.
 * One request carries both questions (settled in the #4 grilling). An
 * out-of-list answer or malformed response → one retry → else null, treated
 * like a failed feed (kept, not dropped).
 *
 * The benchmark (docs/research/decision-model-benchmark.md) picked
 * Clef-flash; see winnerModelFromEnv().
 */
import { ARTICLE_KINDS, SECTIONS, type ArticleKind, type Section } from '@prisme/domain';

export type { ArticleKind, Section };

const KIND_CRITERIA: Record<ArticleKind, string> = {
  news: "Un fait d'actualité est rapporté : événement, déclaration, chiffre, résultat, enquête, reportage",
  opinion: "Prise de position : éditorial, tribune, chronique, analyse argumentée par un auteur",
  live: "Couverture en direct d'un événement en cours (live blog, « en direct »)",
  not_news:
    "Aucun fait d'actualité : horoscope, astro, météo, jeux/quiz/mots croisés/sudoku, recette de cuisine, programme TV, bons plans/shopping/concours, guide ou tutoriel, sommaire ou récapitulatif d'émissions (invités, débats à venir, rediffusion)",
};

const SECTION_CRITERIA: Record<Section, string> = {
  politics: 'Politique française, institutions, élections, lois',
  world: 'International : actualité étrangère, diplomatie, conflits',
  economy: 'Économie : entreprises, marchés, emploi, consommation',
  society: 'Société : éducation, santé, justice, immigration, famille, religion, débats de société',
  sport: 'Sport',
  culture: 'Culture : cinéma, musique, livres, arts, people, médias',
  science: 'Sciences et tech : science, technologie, IA, espace, environnement',
  misc: 'Faits divers : crimes, accidents, affaires judiciaires',
  other: "Actualité qui n'entre dans aucune rubrique ci-dessus",
};

/** Prompt version, for benchmark traceability. */
export const PROMPT_VERSION = 2;

/** The two typed questions sent in every request; keys reused in the answers. */
export const QUESTIONS = {
  kind: {
    type: 'choice',
    instructions:
      'Quel est le type de cet article ? Juge uniquement à partir du titre et du chapô fournis.',
    criteria: KIND_CRITERIA,
  },
  section: {
    type: 'choice',
    instructions:
      "À quelle rubrique cette information appartient-elle ? Réponds même si la pièce n'est pas de l'actualité ; la réponse sera ignorée dans ce cas.",
    criteria: SECTION_CRITERIA,
  },
} as const;

export interface Classification {
  kind: ArticleKind;
  section: Section;
  kindProbabilities?: Record<string, number>;
  sectionProbabilities?: Record<string, number>;
  inputTokens: number;
  elapsedMs: number;
  /** USD, when the provider reports it (OpenRouter usage.cost). */
  costUsd?: number;
}

export interface DecisionModel {
  label: string;
  classify(state: { headline: string; teaser: string }): Promise<Classification | null>;
}

/** Raw per-question answer as returned by both providers. */
interface ChoiceAnswer {
  type: string;
  choice: string;
  probabilities?: Record<string, number>;
  confidence?: number;
}

/**
 * Extract and validate the two answers. Returns null when an answer is
 * missing or out-of-list — the caller retries once, then gives up.
 */
export function parseAnswers(
  answers: unknown,
): { kind: ArticleKind; section: Section; kindProbabilities?: Record<string, number>; sectionProbabilities?: Record<string, number> } | null {
  if (answers == null || typeof answers !== 'object') return null;
  const { kind, section } = answers as Record<string, unknown>;
  const kindAnswer = choiceOf(kind);
  const sectionAnswer = choiceOf(section);
  if (!kindAnswer || !ARTICLE_KINDS.includes(kindAnswer.choice as ArticleKind)) return null;
  if (!sectionAnswer || !SECTIONS.includes(sectionAnswer.choice as Section)) return null;
  return {
    kind: kindAnswer.choice as ArticleKind,
    section: sectionAnswer.choice as Section,
    kindProbabilities: kindAnswer.probabilities,
    sectionProbabilities: sectionAnswer.probabilities,
  };
}

function choiceOf(answer: unknown): ChoiceAnswer | null {
  if (answer == null || typeof answer !== 'object') return null;
  const a = answer as Record<string, unknown>;
  if (typeof a.choice !== 'string') return null;
  return a as unknown as ChoiceAnswer;
}

const RETRYABLE = new Set([429, 500, 502, 503, 504, 529]);

/**
 * Shared call logic: build the request, one retry on retryable errors or
 * invalid output, then null (degraded: keep the Article without a kind).
 * Latency is measured across attempts, as the consumer experiences it.
 */
async function callModel(
  label: string,
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
  state: { headline: string; teaser: string },
): Promise<Classification | null> {
  const stateText = state.teaser ? `${state.headline}\n${state.teaser}` : state.headline;
  const started = Date.now();
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, state: stateText }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        const text = await response.text();
        if (RETRYABLE.has(response.status) && attempt === 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        // 401/422 and the like are config errors: fail fast, no retry.
        const error = new Error(`${label} HTTP ${response.status}: ${text.slice(0, 200)}`);
        (error as Error & { fatal?: boolean }).fatal = true;
        throw error;
      }
      const data = (await response.json()) as {
        answers?: unknown;
        usage?: { input_tokens?: number; cost?: number };
      };
      const parsed = parseAnswers(data.answers);
      if (!parsed) {
        if (attempt === 1) continue;
        return null;
      }
      return {
        ...parsed,
        inputTokens: data.usage?.input_tokens ?? 0,
        costUsd: typeof data.usage?.cost === 'number' ? data.usage.cost : undefined,
        elapsedMs: Date.now() - started,
      };
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
}

export function jevModel(apiKey: string): DecisionModel {
  return {
    label: 'Jev',
    classify(state) {
      return callModel(
        'Jev',
        'https://jevmodel.net/v1/systemone',
        apiKey,
        { model: 'jev-latest', questions: QUESTIONS },
        state,
      );
    },
  };
}

export function clefFlashModel(apiKey: string, accountId: string): DecisionModel {
  return {
    label: 'Clef-flash',
    classify(state) {
      return callModel(
        'Clef-flash',
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/cloudflare/clef-flash`,
        apiKey,
        { model: 'clef-flash', questions: QUESTIONS },
        state,
      );
    },
  };
}

/**
 * Both models through OpenRouter's System One gateway, which preserves the
 * same typed-questions body (https://openrouter.ai/api/alpha/decisions).
 * Routing both models through one gateway keeps the benchmark fair: same
 * serving path, same request shape, one key. Pinned ids for reproducibility.
 */
export const OPENROUTER_MODELS = {
  jev: 'typesafe/jev-1.13',
  clefFlash: 'cloudflare/clef-flash',
} as const;

/** The benchmark winner, served via OpenRouter with a pinned model id. */
export const WINNER = {
  gateway: 'openrouter',
  model: OPENROUTER_MODELS.clefFlash,
  label: 'Clef-flash',
} as const;

export function openRouterModel(apiKey: string, id: string, label: string): DecisionModel {
  return {
    label,
    classify(state) {
      return callModel(
        label,
        'https://openrouter.ai/api/alpha/decisions',
        apiKey,
        { model: id, questions: QUESTIONS },
        state,
      );
    },
  };
}

/**
 * The production decision model: the benchmark winner via OPENROUTER_API_KEY.
 * Null when the key is absent — the caller degrades gracefully (Articles kept
 * unclassified, never dropped).
 */
export function winnerModelFromEnv(): DecisionModel | null {
  if (!process.env.OPENROUTER_API_KEY) return null;
  return openRouterModel(process.env.OPENROUTER_API_KEY, WINNER.model, WINNER.label);
}