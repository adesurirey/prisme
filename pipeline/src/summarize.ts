/**
 * Summaries model (issue #7, ADR-0006): per-Coverage-group bullet-point
 * Summaries and a Differences paragraph for each live Edition Story that
 * gained Articles, from headlines + teasers only — never the article page
 * (ADR-0003). Articles carry their granular Leaning band (issue #46), so the
 * model can account for the composition of a group and note within-group
 * nuance; the output stays keyed on the three Coverage groups. One
 * structured-output call per changed Story against Google's Generative
 * Language API (free tier, shared with the Grouping model).
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

/** Prompt version, for traceability in Story files (ADR-0006). Bump on any prompt/schema change. */
export const SUMMARIES_PROMPT_VERSION = 'sum-2';

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
  previousSummaries?: StorySummaries;
  previousDifferences?: string;
  /** Only the Articles beyond summarizedArticleCount — the new headlines. */
  newArticles: SummaryInputArticle[];
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
  differences: string;
}

const LEANINGS = ['gauche', 'centre', 'droite'] as const;

/**
 * Extract and validate the response: per-Leaning bullet lists (only
 * non-empty strings kept) and a non-empty Differences paragraph. A
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
  if (
    summaries == null ||
    typeof summaries !== 'object' ||
    typeof differences !== 'string'
  )
    return null;
  const trimmed = differences.trim();
  if (trimmed === '') return null;

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
  return { summaries: result, differences: trimmed };
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
    differences: { type: 'string' },
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
 * The prompt: previous Summaries + Differences, new headlines + teasers with
 * Outlet tags, nothing else (ADR-0003). The version appears in the text so a
 * prompt change without a version bump cannot pass review unnoticed.
 */
export function summariesPrompt(input: SummaryInput): string {
  const {
    story,
    previousSummaries,
    previousDifferences,
    newArticles,
    coveredLeanings,
  } = input;
  const section = story.section ? ` (${SECTION_LABELS[story.section]})` : '';
  const lines: string[] = [
    `Version du prompt : ${SUMMARIES_PROMPT_VERSION}.`,
    '',
    `Sujet : « ${story.title} »${section}.`,
    '',
  ];

  if (previousSummaries || previousDifferences) {
    lines.push(
      'Résumés et différences déjà publiés (le sujet évolue, tu les mets à jour) :',
    );
    if (previousSummaries) {
      for (const leaning of LEANINGS) {
        const bullets = previousSummaries[leaning];
        if (bullets?.length) {
          lines.push(
            `- ${LEANING_LABELS_FR[leaning]} : ${bullets.join(' | ')}`,
          );
        }
      }
    }
    if (previousDifferences)
      lines.push(`- Différences : ${previousDifferences}`);
    lines.push('');
  }

  lines.push(
    'Nouveaux articles :',
    ...newArticles.map((a) => {
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
    "- Pour chaque camp couvert, écris « summaries.<camp> » : un tableau de 2 à 5 puces courtes en français, factuelles, qui résument ce que les médias de ce camp rapportent du sujet. Les camps regroupent les bandes : le camp gauche comprend les médias classés « centre gauche », le camp droite comprend les médias classés « centre droit ». Reformule : ne recopie jamais la formulation d'un titre ou d'un teaser. Ne nomme aucun média dans les résumés ; tu peux en revanche signaler une nuance interne au camp (par exemple entre « gauche » et « centre gauche ») sans désigner de titre.",
    '- Les tribunes éclairent le positionnement de leur camp mais restent des prises de position, pas des faits établis.',
    "- Écris « differences » : un seul paragraphe court en français qui compare comment les camps cadrent, accentuent ou laissent de côté des parties du sujet — y compris les divergences à l'intérieur d'un même camp (par exemple entre « droite » et « centre droit »). Tu peux citer un média à l'appui d'un contraste concret. Décris sans trancher : dis qui met l'accent sur quoi, jamais qui a raison.",
    "- Si un seul camp couvre le sujet : son résumé le présente, et « differences » décrit sa lecture et dit sans détour qu'il n'y a rien à comparer — ne rien inventer.",
  );
  return lines.join('\n');
}

export async function updateSummaries(input: {
  /** Live Edition Stories as working copies — mutated in place on success. */
  stories: Story[];
  teasers: Map<string, string>;
  outletById: Map<string, Outlet>;
  model?: SummaryModel;
  promptVersion: string;
}): Promise<{ changed: Set<string>; calls: number }> {
  const { stories, teasers, outletById, model, promptVersion } = input;
  const changed = new Set<string>();
  let calls = 0;
  if (model == null) return { changed, calls };

  for (const story of stories) {
    const seen = story.summarizedArticleCount ?? 0;
    // Articles are append-only and sorted newest first (ADR-0006): the
    // unseen ones are the first `length - seen` entries.
    const newCount = story.articles.length - seen;
    if (newCount <= 0) continue;

    // Only Leanings with Coverage are summarized (ADR-0011: an all-Opinion
    // Story now has Coverage, so it is summarized like any other).
    const counts = coverageCounts(story.articles, outletById);
    const coveredLeanings = LEANINGS.filter((l) => counts[l] > 0);
    if (coveredLeanings.length === 0) continue;

    const newArticles: SummaryInputArticle[] = [];
    for (const article of story.articles.slice(0, newCount)) {
      const outlet = outletById.get(article.outletId);
      if (outlet == null) continue; // unknown Outlet: no Leaning to tag, ignored like in Coverage
      newArticles.push({
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
      previousSummaries: story.summaries,
      previousDifferences: story.differences,
      newArticles,
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

/** JSON-schema client against Google's free tier, same posture as the Grouping model. */
export function summariesModelFromEnv(): SummaryModel | undefined {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return undefined;
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
