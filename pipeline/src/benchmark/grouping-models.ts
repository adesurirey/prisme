/**
 * Grouping-benchmark model adapters (issue #41). One call per fixture run —
 * the same shape the production Grouping call has (one structured-output
 * request carrying live Story titles and fresh Article headlines), with
 * usage (tokens, cost) captured for the metrics.
 *
 * Two gateways, matching the pipeline's own clients:
 * - `gemini/<model>` — Google Generative Language (GEMINI_API_KEY); the
 *   pinned baseline gemini-3.5-flash-lite runs on the free tier.
 * - `openrouter/<model>` — OpenRouter chat completions with structured
 *   outputs (OPENROUTER_API_KEY), the same account that serves Jev and
 *   Clef-flash. Candidates are picked from OpenRouter's model list.
 *
 * State sent to the models: Story titles + Article headlines (+ Sections),
 * no teasers — the fixture carries none (ADR-0003).
 */

import type {
  GroupingInputArticle,
  GroupingInputStory,
  GroupingProposal,
} from '../gemini.ts';
import {
  GROUPING,
  GROUPING_SCHEMA,
  groupingPrompt,
  parseGroupingResponse,
} from '../gemini.ts';

/** One grouping call with its usage. Null proposal = invalid/unparseable. */
export interface GroupingCall {
  proposal: GroupingProposal | null;
  inputTokens: number;
  outputTokens: number;
  /** USD; null when the gateway reports no cost (e.g. Google free tier). */
  costUsd: number | null;
  /** Why generation stopped — 'stop' when the JSON is complete. */
  finishReason?: string | null;
  /** First 400 chars of the raw response when it failed to parse. */
  rawSnippet?: string;
}

export interface BenchmarkGroupingModel {
  /** The spec that created it: <gateway>/<model>. */
  spec: string;
  label: string;
  group(input: {
    stories: GroupingInputStory[];
    articles: GroupingInputArticle[];
  }): Promise<GroupingCall>;
}

// Latency is part of the decision rule, and production aborts the grouping
// call at 60 s: a candidate that cannot answer one build call in 5 minutes
// is disqualified by that fact alone, so cap every call at 300 s — with the
// fail-fast below the worst case per candidate is 3 × 5 min, not 40.
const TIMEOUT_MS = 300_000;

function googleGroupingModel(
  model: string,
  apiKey: string,
): BenchmarkGroupingModel {
  const label = model === GROUPING.model ? GROUPING.label : model;
  return {
    spec: `gemini/${model}`,
    label,
    async group(input) {
      const body = {
        contents: [{ parts: [{ text: groupingPrompt(input) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: GROUPING_SCHEMA,
          // Same headroom as production: the from-empty fixture assigns
          // several hundred Articles in one call.
          maxOutputTokens: 65_536,
        },
      };
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `${label} HTTP ${response.status}: ${text.slice(0, 200)}`,
        );
      }
      const data = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
        };
      };
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .map((part) => part.text ?? '')
        .join('');
      return {
        proposal: parseGroupingResponse(text),
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        // Free tier; the paid price is applied in the report, not here.
        costUsd: null,
      };
    },
  };
}

function openRouterGroupingModel(
  id: string,
  apiKey: string,
): BenchmarkGroupingModel {
  const label = id;
  const call = async (
    body: Record<string, unknown>,
  ): Promise<{
    proposal: GroupingProposal | null;
    inputTokens: number;
    outputTokens: number;
    costUsd: number | null;
    finishReason?: string | null;
    rawSnippet?: string;
  }> => {
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      const text = await response.text();
      throw Object.assign(
        new Error(`${label} HTTP ${response.status}: ${text.slice(0, 200)}`),
        { status: response.status, text },
      );
    }
    const data = (await response.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        completion_tokens_details?: { reasoning_tokens?: number };
        cost?: number;
      };
    };
    const choice = data.choices?.[0];
    const raw = choice?.message?.content ?? '';
    // Some models wrap the JSON in junk — a bare `{}` prefix, channel
    // markers, or reasoning prose (all seen from gpt-6-luna): take the
    // first object that parses as a grouping proposal.
    const text =
      firstJsonObject(raw, (s) => parseGroupingResponse(s) != null) ?? raw;
    const proposal = parseGroupingResponse(text);
    const reasoningTokens =
      data.usage?.completion_tokens_details?.reasoning_tokens;
    if (reasoningTokens != null && reasoningTokens > 0) {
      console.warn(
        `${id}: ${reasoningTokens} hidden reasoning tokens (of ${data.usage?.completion_tokens ?? '?'} output)`,
      );
    }
    return {
      proposal,
      finishReason: choice?.finish_reason ?? null,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      costUsd: typeof data.usage?.cost === 'number' ? data.usage.cost : null,
      // Forensics for the unparseable-failure mode (issue #41): keep the
      // head AND tail of what the model actually sent — the head shows a
      // junk prefix, the tail shows whether the JSON was cut or complete.
      ...(proposal == null
        ? {
            rawSnippet: `${raw.slice(0, 200)} …[TAIL]… ${raw.slice(-300)}`,
          }
        : {}),
    };
  };
  return {
    spec: `openrouter/${id}`,
    label,
    async group(input) {
      const body = {
        model: id,
        messages: [{ role: 'user', content: groupingPrompt(input) }],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'grouping',
            // OpenAI-family structured outputs: strict mode forces the
            // generation to satisfy the schema until complete — the fix for
            // models that stop mid-JSON on long outputs (gpt-6-luna).
            strict: true,
            schema: strictGroupingSchema(),
          },
        },
        // Same headroom as production: without it the provider's default
        // output cap truncates the JSON mid-assignment (the from-empty
        // fixture needs tens of thousands of output tokens).
        max_tokens: 65_536,
        // Ask OpenRouter to report token counts and cost in the response.
        usage: { include: true },
        // Grouping is a mechanical structured-output task: no thinking
        // budget — a reasoning model burns latency and output tokens on it.
        reasoning: { enabled: false },
      };
      try {
        return await call(body);
      } catch (error) {
        // Some endpoints (e.g. z-ai/glm-5.3-flash) mandate reasoning and
        // reject `reasoning: { enabled: false }` with HTTP 400: retry once
        // without the field, so any OpenRouter model runs without
        // per-model config.
        const e = error as Error & { status?: number; text?: string };
        if (e.status === 400 && e.text != null && /reasoning/i.test(e.text)) {
          const { reasoning: _omitted, ...withoutReasoning } = body;
          return call(withoutReasoning);
        }
        throw error;
      }
    },
  };
}

/**
 * First JSON object in the text that the validator accepts. Some models
 * wrap the payload in junk — a bare `{}` prefix or channel prose
 * (gpt-6-luna) — so the naive first-{ … last-} slice returns two
 * concatenated objects and fails. Scan each '{' for a balanced object and
 * try it (strings-aware brace counting); a bare `{}` parses, so the
 * caller validates the shape, not just the syntax.
 */
export function firstJsonObject(
  text: string,
  accept: (candidate: string) => boolean = (s) => {
    try {
      JSON.parse(s);
      return true;
    } catch {
      return false;
    }
  },
): string | null {
  for (let start = text.indexOf('{'); start >= 0; ) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') inString = false;
      } else if (c === '"') {
        inString = true;
      } else if (c === '{') {
        depth++;
      } else if (c === '}' && --depth === 0) {
        const candidate = text.slice(start, i + 1);
        if (accept(candidate)) return candidate;
        break; // not acceptable here — try the next '{'
      }
    }
    start = text.indexOf('{', start + 1);
  }
  return null;
}

/**
 * Strict-mode variant of GROUPING_SCHEMA: OpenAI structured outputs
 * (strict: true) demand additionalProperties: false on every object and
 * every property in required — effectively-optional fields become
 * nullable instead. Emits the same data, so parseGroupingResponse reads
 * both variants unchanged.
 */
const strictGroupingSchema = (): Record<string, unknown> => {
  const nullable = (type: string) => ({ type: [type, 'null'] });
  return {
    type: 'object',
    properties: {
      newStories: {
        type: 'array',
        items: {
          type: 'object',
          properties: { key: { type: 'string' }, title: { type: 'string' } },
          required: ['key', 'title'],
          additionalProperties: false,
        },
      },
      assignments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            articleId: { type: 'string' },
            storyId: nullable('string'),
            newStoryKey: nullable('string'),
            confidence: nullable('number'),
          },
          required: ['articleId', 'storyId', 'newStoryKey', 'confidence'],
          additionalProperties: false,
        },
      },
      titleUpdates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            storyId: { type: 'string' },
            title: { type: 'string' },
          },
          required: ['storyId', 'title'],
          additionalProperties: false,
        },
      },
    },
    required: ['newStories', 'assignments', 'titleUpdates'],
    additionalProperties: false,
  };
};

/**
 * Build the benchmark model for a spec (`gemini/<model>` or
 * `openrouter/<model>`). Throws on an unknown gateway or a missing key —
 * keys come from the env only, never the repo.
 */
export function benchmarkGroupingModel(spec: string): BenchmarkGroupingModel {
  const slash = spec.indexOf('/');
  if (slash < 1) {
    throw new Error(`Model spec must be <gateway>/<model>, got: ${spec}`);
  }
  const gateway = spec.slice(0, slash);
  const model = spec.slice(slash + 1);
  if (gateway === 'gemini') {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not set — cannot run gemini specs.');
    }
    return googleGroupingModel(model, process.env.GEMINI_API_KEY);
  }
  if (gateway === 'openrouter') {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error(
        'OPENROUTER_API_KEY not set — cannot run openrouter specs.',
      );
    }
    return openRouterGroupingModel(model, process.env.OPENROUTER_API_KEY);
  }
  throw new Error(
    `Unknown gateway ${gateway} (supported: gemini, openrouter) in spec ${spec}`,
  );
}
