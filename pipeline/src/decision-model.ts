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
import {
  ARTICLE_KINDS,
  type ArticleKind,
  SECTION_LABELS,
  SECTIONS,
  type Section,
} from '@prisme/domain';
import { RETRYABLE_STATUS } from './http.ts';

export type { ArticleKind, Section };

const KIND_CRITERIA: Record<ArticleKind, string> = {
  news: "Un fait d'actualité est rapporté : événement, déclaration, chiffre, résultat, enquête, reportage. Sont aussi de l'info les expliquations journalistiques (« pourquoi », « qu'est-ce que », un article de type « analyse » signé par la rédaction), les reportages photo et diaporamas « en images », même sans événement daté du jour",
  opinion:
    "Prise de position d'auteur : un genre d'opinion explicite — éditorial, tribune, chronique, billet d'humeur, op-ed — où l'auteur défend sa propre thèse. Une analyse ou explication produite par la rédaction ou un journaliste reste de l'info tant qu'aucun genre d'opinion n'est identifiable",
  live: "Couverture en direct d'un événement en cours (live blog, « en direct »)",
  not_news:
    "Aucun fait d'actualité : horoscope, astro, météo, jeux/quiz/mots croisés/sudoku, recette de cuisine, programme TV, bons plans/shopping/concours, guide ou tutoriel, sommaire ou récapitulatif d'émissions (invités, débats à venir, rediffusion)",
};

const SECTION_CRITERIA: Record<Section, string> = {
  politics: 'Politique française, institutions, élections, lois',
  world: 'International : actualité étrangère, diplomatie, conflits',
  economy: 'Économie : entreprises, marchés, emploi, consommation',
  society:
    'Société : éducation, santé, justice, immigration, famille, religion, débats de société',
  sport: 'Sport',
  culture: 'Culture : cinéma, musique, livres, arts, people, médias',
  science: 'Sciences et tech : science, technologie, IA, espace, environnement',
  misc: 'Faits divers : crimes, accidents, affaires judiciaires',
  other: "Actualité qui n'entre dans aucune rubrique ci-dessus",
};

/** Prompt version, for benchmark traceability. */
export const PROMPT_VERSION = 3;

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
  /** Null when the kind is not_news (the section answer is ignored) or invalid. */
  section: Section | null;
  kindProbabilities?: Record<string, number>;
  sectionProbabilities?: Record<string, number>;
  inputTokens: number;
  elapsedMs: number;
  /** USD, when the provider reports it (OpenRouter usage.cost). */
  costUsd?: number;
}

export interface DecisionModel {
  label: string;
  /** USD per input token — used when the API reports no cost of its own. */
  costPerInputToken: number;
  classify(state: {
    headline: string;
    teaser: string;
  }): Promise<Classification | null>;
}

/** Raw per-question answer as returned by both providers. */
interface ChoiceAnswer {
  type: string;
  choice: string;
  probabilities?: Record<string, number>;
  confidence?: number;
}

/**
 * The Membership check (issue #5): a single yes/no question asking whether an
 * Article the Grouping model matched with low confidence really belongs to
 * that Story. Asked to Jev through the same OpenRouter System One gateway as
 * the benchmark — no extra key beyond OPENROUTER_API_KEY.
 */
export const MEMBERSHIP_QUESTION = {
  belongs: {
    type: 'choice',
    instructions:
      "Cet article rapporte-t-il le même événement ou le même sujet que cette story ? Juge uniquement à partir du titre de la story et du titre et chapô de l'article fournis.",
    criteria: {
      yes: "C'est le même événement ou le même sujet : l'article peut rejoindre la story",
      no: "Événement ou sujet différent : l'article ne doit pas rejoindre la story",
    },
  },
} as const;

/** true = belongs; false = does not; null = invalid answer (treated as “no”). */
export function parseMembershipAnswer(answers: unknown): boolean | null {
  if (answers == null || typeof answers !== 'object') return null;
  const answer = choiceOf((answers as Record<string, unknown>).belongs);
  if (!answer) return null;
  if (answer.choice === 'yes') return true;
  if (answer.choice === 'no') return false;
  return null;
}

/**
 * Extract and validate the two answers. Returns null when an answer is
 * missing or out-of-list — the caller retries once, then gives up.
 */
export function parseAnswers(answers: unknown): {
  kind: ArticleKind;
  section: Section | null;
  kindProbabilities?: Record<string, number>;
  sectionProbabilities?: Record<string, number>;
} | null {
  if (answers == null || typeof answers !== 'object') return null;
  const { kind: kindField, section: sectionField } = answers as Record<
    string,
    unknown
  >;
  const kindAnswer = choiceOf(kindField);
  if (!kindAnswer || !ARTICLE_KINDS.includes(kindAnswer.choice as ArticleKind))
    return null;
  const kind = kindAnswer.choice as ArticleKind;
  const sectionAnswer = choiceOf(sectionField);
  const validSection =
    sectionAnswer && SECTIONS.includes(sectionAnswer.choice as Section)
      ? (sectionAnswer.choice as Section)
      : null;
  // The section answer is ignored for not_news (settled in the #4 grilling):
  // an invalid section only fails the answer when the kind is a news kind.
  if (kind !== 'not_news' && validSection == null) return null;
  return {
    kind,
    section: kind === 'not_news' ? null : validSection,
    kindProbabilities: kindAnswer.probabilities,
    sectionProbabilities: sectionAnswer?.probabilities,
  };
}

function choiceOf(answer: unknown): ChoiceAnswer | null {
  if (answer == null || typeof answer !== 'object') return null;
  const a = answer as Record<string, unknown>;
  if (typeof a.choice !== 'string') return null;
  return a as unknown as ChoiceAnswer;
}

const RETRYABLE = RETRYABLE_STATUS;

/**
 * Shared call logic: build the request, one retry on retryable errors or
 * invalid output, then null (degraded). `parse` extracts the typed answers;
 * classification uses parseAnswers, the Membership check uses
 * parseMembershipAnswer. Latency is measured across attempts, as the
 * consumer experiences it.
 */
async function callTyped<T>(
  label: string,
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
  state: { headline: string; teaser: string },
  parse: (answers: unknown) => T | null,
): Promise<
  (T & { inputTokens: number; elapsedMs: number; costUsd?: number }) | null
> {
  const stateText = state.teaser
    ? `${state.headline}\n${state.teaser}`
    : state.headline;
  const started = Date.now();
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
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
        const error = new Error(
          `${label} HTTP ${response.status}: ${text.slice(0, 200)}`,
        );
        (error as Error & { fatal?: boolean }).fatal = true;
        throw error;
      }
      const data = (await response.json()) as {
        answers?: unknown;
        usage?: { input_tokens?: number; cost?: number };
      };
      const parsed = parse(data.answers);
      if (!parsed) {
        if (attempt === 1) continue;
        return null;
      }
      return {
        ...parsed,
        inputTokens: data.usage?.input_tokens ?? 0,
        costUsd:
          typeof data.usage?.cost === 'number' ? data.usage.cost : undefined,
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
    costPerInputToken: COST_PER_INPUT_TOKEN[OPENROUTER_MODELS.jev],
    classify(state) {
      return callTyped(
        'Jev',
        'https://jevmodel.net/v1/systemone',
        apiKey,
        { model: 'jev-latest', questions: QUESTIONS },
        state,
        parseAnswers,
      );
    },
  };
}

export function clefFlashModel(
  apiKey: string,
  accountId: string,
): DecisionModel {
  return {
    label: 'Clef-flash',
    costPerInputToken: COST_PER_INPUT_TOKEN[OPENROUTER_MODELS.clefFlash],
    classify(state) {
      return callTyped(
        'Clef-flash',
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/cloudflare/clef-flash`,
        apiKey,
        { model: 'clef-flash', questions: QUESTIONS },
        state,
        parseAnswers,
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

/** USD per input token, keyed by model id (output is free for both models). */
export const COST_PER_INPUT_TOKEN: Record<string, number> = {
  [OPENROUTER_MODELS.jev]: 0.042e-6,
  [OPENROUTER_MODELS.clefFlash]: 0.09e-6,
};

/**
 * The production model, served via OpenRouter with a pinned model id: Jev
 * since prompt v3 — the only model with zero news→opinion misses on the
 * benchmark (issue #17), the misclassification that empties a Story's
 * Coverage and article count. Clef-flash keeps higher not_news precision but
 * still misreads 7/85 news as opinion on v3.
 */
export const WINNER = {
  gateway: 'openrouter',
  model: OPENROUTER_MODELS.jev,
  label: 'Jev',
} as const;

export function openRouterModel(
  apiKey: string,
  id: string,
  label: string,
): DecisionModel {
  return {
    label,
    costPerInputToken: COST_PER_INPUT_TOKEN[id] ?? 0,
    classify(state) {
      return callTyped(
        label,
        'https://openrouter.ai/api/alpha/decisions',
        apiKey,
        { model: id, questions: QUESTIONS },
        state,
        parseAnswers,
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
  return openRouterModel(
    process.env.OPENROUTER_API_KEY,
    WINNER.model,
    WINNER.label,
  );
}

/** yes = belongs; no = does not; failed = the model answered nothing usable (or the check threw). */
export type MembershipAnswer = 'yes' | 'no' | 'failed';

/** The Membership check (issue #5): Jev answers yes/no about one (Article, Story) pair. */
export interface MembershipChecker {
  label: string;
  belongs(
    story: { title: string; section?: Section },
    article: { headline: string; teaser: string },
  ): Promise<MembershipAnswer>;
}

function membershipModel(apiKey: string): MembershipChecker {
  return {
    label: 'Jev',
    async belongs(story, article) {
      const section = story.section
        ? ` (${SECTION_LABELS[story.section]})`
        : '';
      const headline = `Article : ${article.headline}`;
      const teaser = article.teaser ? `\n${article.teaser}` : '';
      return callTyped(
        'Jev',
        'https://openrouter.ai/api/alpha/decisions',
        apiKey,
        { model: OPENROUTER_MODELS.jev, questions: MEMBERSHIP_QUESTION },
        { headline: `Story : ${story.title}${section}\n${headline}`, teaser },
        (answers) => {
          const belongs = parseMembershipAnswer(answers);
          return belongs == null ? null : { belongs };
        },
      ).then((r) =>
        r == null ? 'failed' : r.belongs ? ('yes' as const) : ('no' as const),
      );
    },
  };
}

/**
 * The production Membership checker: Jev via OPENROUTER_API_KEY (ADR-0005).
 * Null when the key is absent — low-confidence matches then split.
 */
export function membershipModelFromEnv(): MembershipChecker | null {
  if (!process.env.OPENROUTER_API_KEY) return null;
  return membershipModel(process.env.OPENROUTER_API_KEY);
}
