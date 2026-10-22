/**
 * Summaries model (issue #7, ADR-0006): per-Coverage-group bullet-point
 * Summaries and Differences bullet points for each live Edition Story that
 * gained Articles, from headlines + teasers only — never the article page
 * (ADR-0003). Articles carry their granular Leaning band (issue #46), so the
 * model can account for the composition of a group and note within-group
 * nuance; the output stays keyed on the three Coverage groups. One
 * structured-output call per changed Story against Google's Generative
 * Language API (free tier, shared with the Grouping model).
 *
 * Each call re-synthesizes from the Story's WHOLE Article set (prompt
 * sum-7): the previous Summaries are never fed back, so the model cannot
 * patch or append to them. Incremental updating (sum-1..sum-3) made each
 * call append a bullet about the latest development to the previous text —
 * the Summary read as a chronicle of successive states instead of a
 * snapshot of the Story. Feeding all Articles (headlines are stored in the
 * Story file; teasers survive only while the Article is still in the feeds'
 * window) keeps every Summary an accurate picture of the current Story,
 * whichever camp's Articles arrived when.
 *
 * Summaries are written into the Story file only while the Story is Live
 * (ADR-0005: frozen files are never edited); unchanged Stories make no call.
 */
import type {
  CoverageGroup,
  Leaning,
  Outlet,
  Section,
  Story,
  StorySummaries,
} from '@prisme/domain';
import { coverageCounts, SECTION_LABELS } from '@prisme/domain';
import { RETRYABLE_STATUS } from './http.ts';
import { isLive } from './liveness.ts';

/** Prompt version, for traceability in Story files (ADR-0006). Bump on any prompt/schema change. */
export const SUMMARIES_PROMPT_VERSION = 'sum-7';

/**
 * The per-build Summaries budget (ADR-0022): at most the top-20 ranked
 * Stories among those that gained Articles gain a model call. Derived from
 * the measured Gemini free-tier quotas (2026-10-17): RPD 500 is the binding
 * constraint, Grouping makes ~24 calls/day, leaving ~476 calls for Summaries
 * across ~24 hourly builds — ~20 per build. Stories beyond the budget keep
 * their existing summary until a later build re-ranks them into the top-20;
 * nothing is hidden from readers for budget reasons.
 */
export const SUMMARIES_BUDGET = 20;

/** The production Summaries model, pinned for traceability. */
export const SUMMARIES = {
  gateway: 'google',
  model: 'gemini-3.5-flash-lite',
  label: 'Flash-Lite',
} as const;

/** One new Article as fed to the Summaries model: headline, teaser, Outlet tags. */
export interface SummaryInputArticle {
  headline: string;
  teaser: string;
  outletName: string;
  outletLeaning: Leaning;
  opinion: boolean;
  frontPage: boolean;
}

/** Everything the Summaries model sees for one Story, and nothing else. */
export interface SummaryInput {
  story: { id: string; title: string; section?: Section };
  /** The Story's WHOLE Article set — the model re-synthesizes from scratch. */
  articles: SummaryInputArticle[];
  /** Leanings with Coverage: the model summarizes these, and only these. */
  coveredLeanings: CoverageGroup[];
}

export interface SummaryModel {
  label: string;
  model: string;
  /** One call per changed Story; null after retry means no Summaries this build (ADR-0006). */
  summarize(input: SummaryInput): Promise<ParsedSummaries | null>;
}

/** Extraction and validation of the Summaries model's answer. */
export interface ParsedSummaries {
  summaries: StorySummaries;
  differences: string[];
}

const LEANINGS = ['gauche', 'centre', 'droite'] as const;

/**
 * Extract and validate the response: per-Leaning bullet lists (only
 * non-empty strings kept) and a non-empty Differences bullet list. A
 * structurally broken response returns null — the caller retries once, then
 * leaves the Story without Summaries (ADR-0006 accepted loss).
 */
export function parseSummaryResponse(text: string): ParsedSummaries | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (data == null || typeof data !== 'object') return null;
  const { summaries, differences } = data as Record<string, unknown>;
  if (summaries == null || typeof summaries !== 'object') return null;
  if (!Array.isArray(differences)) return null;
  const keptDifferences = differences
    .filter((d): d is string => typeof d === 'string')
    .map((d) => d.trim())
    .filter((d) => d !== '');
  if (keptDifferences.length === 0) return null;

  const result: ParsedSummaries['summaries'] = {};
  for (const leaning of LEANINGS) {
    const bullets = (summaries as Record<string, unknown>)[leaning];
    if (bullets === undefined) continue;
    if (!Array.isArray(bullets)) return null;
    const kept = bullets.filter(
      (b): b is string => typeof b === 'string' && b.trim() !== '',
    );
    result[leaning] = kept;
  }
  return { summaries: result, differences: keptDifferences };
}

/** JSON Schema for the structured output (generationConfig.responseJsonSchema). */
const SUMMARIES_SCHEMA = {
  type: 'object',
  properties: {
    summaries: {
      type: 'object',
      properties: {
        gauche: { type: 'array', items: { type: 'string' } },
        centre: { type: 'array', items: { type: 'string' } },
        droite: { type: 'array', items: { type: 'string' } },
      },
    },
    differences: { type: 'array', items: { type: 'string' } },
  },
  required: ['summaries', 'differences'],
} as const;

/**
 * French Leaning-band labels for the prompt, lowercase: Articles carry their
 * granular band (issue #46), Summaries stay keyed on the three Coverage
 * groups, whose fold the instructions spell out.
 */
const LEANING_LABELS_FR: Record<Leaning, string> = {
  gauche: 'gauche',
  'centre-gauche': 'centre gauche',
  centre: 'centre',
  'centre-droite': 'centre droit',
  droite: 'droite',
};

/**
 * The prompt: the Story's whole Article set — headlines + teasers with
 * Outlet tags, nothing else (ADR-0003) — and never the previous Summaries,
 * so every call is a fresh synthesis of the current Story (prompt sum-7).
 * sum-7 keeps sum-6's « differences » — a cold, media-level comparison:
 * exactly one treatment bullet per covered camp (angle, vocabulary, hidden
 * or ignored facts), within-camp divergences between bands carried inside
 * that camp's own bullet — and what a camp's media merely relay from other
 * camps never counts as that camp's treatment. The version appears in the
 * text so a prompt change without a version bump cannot pass review
 * unnoticed. Since sum-7, the anti-formula-copying rule no longer bleeds
 * into the facts: the model keeps the sources' precise vocabulary (proper
 * names, exact categories, figures, places) and quotes striking formulas
 * instead of paraphrasing them into generic abstractions — reader feedback
 * showed « ancien actif » where the sources said « retraité ».
 */
export function summariesPrompt(input: SummaryInput): string {
  const { story, articles, coveredLeanings } = input;
  const section = story.section ? ` (${SECTION_LABELS[story.section]})` : '';
  const lines: string[] = [
    `Version du prompt : ${SUMMARIES_PROMPT_VERSION}.`,
    '',
    `Sujet : « ${story.title} »${section}.`,
    '',
  ];

  lines.push(
    'Articles du sujet :',
    ...articles.map((a) => {
      const teaser = a.teaser ? ` — ${a.teaser}` : '';
      const tags = [
        a.outletName,
        LEANING_LABELS_FR[a.outletLeaning],
        a.opinion ? 'tribune' : null,
        a.frontPage ? 'à la une' : null,
      ]
        .filter(Boolean)
        .join(', ');
      return `- [${tags}] ${a.headline}${teaser}`;
    }),
    '',
    `Tu couvres uniquement : ${coveredLeanings.map((l) => LEANING_LABELS_FR[l]).join(', ')}.`,
    '',
    'Consignes :',
    "- Pour chaque camp couvert, écris « summaries.<camp> » : un tableau de 2 à 5 puces courtes en français, factuelles, qui résument ce que les médias de ce camp rapportent du sujet. Les camps regroupent les bandes : le camp gauche comprend les médias classés « centre gauche », le camp droite comprend les médias classés « centre droit ». Reformule les phrases — ne recopie jamais la formulation d'un titre ou d'un teaser — mais garde le vocabulaire précis des faits : noms propres, catégories exactes, chiffres, lieux. Ne remplace jamais un mot précis par un terme générique ou abstrait (« ancien actif » pour « retraité », « le dirigeant américain » pour « Trump ») ; si une formule des sources est marquante, cite-la entre guillemets plutôt que de la paraphraser. Par défaut, parle pour le camp tout entier sans nommer de média ; nomme un média seulement quand c'est nécessaire à l'exactitude : pour signaler une nuance interne au camp (par exemple entre « gauche » et « centre gauche ») ou pour attribuer une information que tous les médias du camp ne rapportent pas.",
    '- Les tribunes éclairent le positionnement de leur camp mais restent des prises de position, pas des faits établis.',
    "- Écris « differences » : un tableau en français d'exactement une puce par camp couvert, dans l'ordre gauche, centre, droite. Analyse froidement le traitement du sujet par les médias de chaque camp — pas le débat politique entre camps : la puce décrit l'angle choisi par ces médias, le vocabulaire qu'ils emploient, ce qu'ils mettent en avant, ce qu'ils taisent ou passent sous silence.",
    "- Ne compte comme traitement d'un camp que ce que ses propres médias écrivent du sujet. Ce qu'un média rapporte des propos, accusations ou réactions d'autres camps (déclarations politiques, communiqués, réactions d'élus) n'est pas le traitement de son camp : ignore-le dans sa puce — et n'attribue jamais à un camp un propos que ses médias ne font que relayer.",
    "- Rédige les puces de camp sur le même gabarit — une phrase courte et factuelle par défaut — pour qu'elles se lisent côte à côte et fassent ressortir les écarts. Une puce de camp dit comment les médias du camp racontent le sujet, pas ce qu'ils racontent de plus : ne répète pas le contenu de « summaries.<camp> ».",
    "- Si un camp est divisé entre ses bandes (par exemple entre « droite » et « centre droit »), fais porter la nuance par sa propre puce : ajoute une seconde phrase qui distingue les traitements des bandes, jamais une puce séparée. « differences » compte exactement une puce par camp couvert, jamais plus. Tu peux citer un média à l'appui d'une nuance concrète. Décris sans trancher : dis quel média met l'accent sur quoi, jamais qui a raison.",
    "- Si un seul camp couvre le sujet : « differences » est la puce de ce camp — le traitement du sujet par ses médias, y compris, dans la même puce, s'il y en a, ses divergences internes entre bandes (par exemple entre « gauche » et « centre gauche »). S'il n'y a vraiment rien à comparer, dis-le sans détour — ne rien inventer.",
  );
  return lines.join('\n');
}

export async function updateSummaries(input: {
  /** Edition Stories as working copies — mutated in place on success. */
  stories: Story[];
  /** Build instant — the liveness check (ADR-0009): frozen Stories are skipped. */
  now: Date;
  teasers: Map<string, string>;
  outletById: Map<string, Outlet>;
  model?: SummaryModel;
  promptVersion: string;
  /**
   * Maximum Stories summarized this build (ADR-0022). Input order is rank
   * order — `run.ts` passes the ranked Edition. Undefined/omitted means no
   * budget (the benchmark and side-by-side scripts rely on that).
   */
  budget?: number;
}): Promise<{ changed: Set<string>; calls: number }> {
  const { stories, now, teasers, outletById, model, promptVersion, budget } =
    input;
  const changed = new Set<string>();
  let calls = 0;
  if (model == null) return { changed, calls };

  for (const story of stories) {
    // Frozen Stories are never edited (ADR-0005): a frozen Story may carry
    // a stale summarizedArticleCount (its Summaries call once failed — the
    // isolate-and-retry-later path). Liveness, the same check as
    // frontpage.ts/edition-history.ts, gates the loop.
    if (!isLive(story, now)) continue;
    // ADR-0027: a Story re-enters the Summaries budget only when it has
    // never been summarized or grew at least 25% since its last pass —
    // the watermark counter carries the gate. When it fires, the pass
    // re-synthesizes from the whole Article set (below), never a delta.
    const seen = story.summarizedArticleCount;
    if (seen != null) {
      const growth = (story.articles.length - seen) / seen;
      if (growth < 0.25) continue;
    }

    // Only Leanings with Coverage are summarized (ADR-0011: an all-Opinion
    // Story now has Coverage, so it is summarized like any other).
    const counts = coverageCounts(story.articles, outletById);
    const coveredLeanings = LEANINGS.filter((l) => counts[l] > 0);
    if (coveredLeanings.length === 0) continue;

    // The budget (ADR-0022) counts actual model calls: Stories below the
    // growth gate or with no Coverage cost zero and never consume it.
    if (budget != null && calls >= budget) continue;

    // The whole Article set, not a delta: the model re-synthesizes from
    // scratch (prompt sum-7). Headlines are stored in the Story file;
    // teasers exist only while the Article is still in the feeds' window.
    const articles: SummaryInputArticle[] = [];
    for (const article of story.articles) {
      const outlet = outletById.get(article.outletId);
      if (outlet == null) continue; // unknown Outlet: no Leaning to tag, ignored like in Coverage
      articles.push({
        headline: article.headline,
        teaser: teasers.get(article.id) ?? '',
        outletName: outlet.name,
        outletLeaning: outlet.leaning,
        opinion: article.kind === 'opinion',
        frontPage: article.frontPage,
      });
    }

    const summaryInput: SummaryInput = {
      story: { id: story.id, title: story.title, section: story.section },
      articles,
      coveredLeanings,
    };

    calls += 1;
    let parsed: ParsedSummaries | null = null;
    try {
      parsed = await model.summarize(summaryInput);
    } catch (reason) {
      // A thrown error is a failed run (ADR-0006): leave the Story untouched.
      console.warn(
        `Summaries failed for ${story.slug}: ${reason instanceof Error ? reason.message : reason}`,
      );
    }
    if (parsed == null) continue;

    // Store only covered Leanings — never model output for an uncovered one.
    const summaries: StorySummaries = {};
    for (const leaning of coveredLeanings) {
      const bullets = parsed.summaries[leaning];
      if (bullets?.length) summaries[leaning] = bullets;
    }
    story.summaries = summaries;
    story.differences = parsed.differences;
    story.promptVersion = promptVersion;
    story.summarizedArticleCount = story.articles.length;
    changed.add(story.slug);
  }
  return { changed, calls };
}

/**
 * JSON-schema client against Google's free tier, same posture as the Grouping
 * model. resolveModels only calls it when the key is set (a missing key
 * already failed the build) — the non-null assertion carries that guarantee.
 */
export function summariesModelFromEnv(): SummaryModel {
  const apiKey = process.env.GEMINI_API_KEY!;
  return geminiSummariesModel(apiKey, SUMMARIES.model, SUMMARIES.label);
}

/** The Summaries client against one pinned model id (the side-by-side passes Flash). */
export function geminiSummariesModel(
  apiKey: string,
  model: string,
  label: string,
): SummaryModel {
  return {
    label,
    model,
    async summarize(input) {
      const body = {
        contents: [{ parts: [{ text: summariesPrompt(input) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: SUMMARIES_SCHEMA,
          maxOutputTokens: 8_192,
          // Pinned: a re-synthesis should change only when the Story does,
          // not on sampling noise between builds.
          temperature: 0,
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
          const parsed = parseSummaryResponse(text);
          if (!parsed) {
            if (attempt === 1) continue;
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
