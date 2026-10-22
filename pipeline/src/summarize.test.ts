import type { Article, Outlet, Story } from '@prisme/domain';
import { describe, expect, it, vi } from 'vitest';
import {
  geminiSummariesModel,
  parseSummaryResponse,
  SUMMARIES_PROMPT_VERSION,
  type SummaryInput,
  type SummaryModel,
  summariesPrompt,
  updateSummaries,
} from './summarize.ts';

const outlets: Outlet[] = [
  {
    id: 'lemonde',
    name: 'Le Monde',
    leaning: 'centre',
    paywall: 'partial',
    site: 'https://lemonde.fr',
    feeds: { latest: 'x' },
    reach: {
      value: 1000000,
      unit: 'visits',
      source: 'test',
      asOf: '2026-08',
    },
  },
  {
    id: 'franceinfo',
    name: 'franceinfo',
    leaning: 'centre-gauche',
    paywall: 'none',
    site: 'https://francetvinfo.fr',
    feeds: { latest: 'x' },
    reach: {
      value: 1000000,
      unit: 'visits',
      source: 'test',
      asOf: '2026-08',
    },
  },
  {
    id: 'figaro',
    name: 'Le Figaro',
    leaning: 'droite',
    paywall: 'none',
    site: 'https://lefigaro.fr',
    feeds: { latest: 'x' },
    reach: {
      value: 1000000,
      unit: 'visits',
      source: 'test',
      asOf: '2026-08',
    },
  },
  {
    id: 'liberation',
    name: 'Libération',
    leaning: 'gauche',
    paywall: 'partial',
    site: 'https://liberation.fr',
    feeds: { latest: 'x' },
    reach: {
      value: 1000000,
      unit: 'visits',
      source: 'test',
      asOf: '2026-08',
    },
  },
];
const outletById = new Map(outlets.map((o) => [o.id, o]));

function article(
  id: string,
  outletId: string,
  overrides: Partial<Article> = {},
): Article {
  return {
    id,
    outletId,
    headline: `Titre ${id}`,
    url: `https://exemple.fr/${id}`,
    publishedAt: '2026-10-06T10:00:00Z',
    frontPage: false,
    kind: 'news',
    ...overrides,
  };
}

function story(
  id: string,
  slug: string,
  articles: Article[],
  extra: Partial<Story> = {},
): Story {
  return {
    id,
    slug,
    title: `Sujet ${id}`,
    createdAt: '2026-10-06T08:00:00Z',
    storyDay: '2026-10-06',
    articles,
    ...extra,
  };
}

/** Records every call so tests can assert on the exact model input. */
function fakeModel(
  response: {
    summaries: Record<string, unknown>;
    differences: string[];
  } | null,
  calls: { input: SummaryInput }[] = [],
): SummaryModel {
  return {
    label: 'Test',
    model: 'test-model',
    async summarize(input) {
      calls.push({ input });
      return response == null
        ? null
        : (JSON.parse(JSON.stringify(response)) as never);
    },
  };
}

const GOOD_RESPONSE = {
  summaries: {
    gauche: ['Lu à gauche'],
    centre: ['Lu au centre'],
    droite: ['Lu à droite'],
  },
  differences: ['La droite insiste sur X.'],
};

describe('parseSummaryResponse', () => {
  it('parses per-Leaning Summaries and Differences', () => {
    const text = JSON.stringify({
      summaries: {
        gauche: ['Bullet un', 'Bullet deux'],
        centre: ['Bullet trois'],
        droite: [],
      },
      differences: ['La droite insiste sur X, la gauche sur Y.'],
    });
    expect(parseSummaryResponse(text)).toEqual({
      summaries: {
        gauche: ['Bullet un', 'Bullet deux'],
        centre: ['Bullet trois'],
        droite: [],
      },
      differences: ['La droite insiste sur X, la gauche sur Y.'],
    });
  });

  it('returns null on malformed JSON', () => {
    expect(parseSummaryResponse('not json')).toBeNull();
  });

  it('returns null when Summaries or Differences are missing or the wrong shape', () => {
    expect(
      parseSummaryResponse(JSON.stringify({ differences: ['x'] })),
    ).toBeNull();
    expect(parseSummaryResponse(JSON.stringify({ summaries: {} }))).toBeNull();
    expect(
      parseSummaryResponse(
        JSON.stringify({
          summaries: { gauche: 'not an array' },
          differences: ['x'],
        }),
      ),
    ).toBeNull();
    expect(
      parseSummaryResponse(
        JSON.stringify({ summaries: { gauche: ['ok'] }, differences: 42 }),
      ),
    ).toBeNull();
    expect(
      parseSummaryResponse(
        JSON.stringify({ summaries: { gauche: ['ok'] }, differences: 'x' }),
      ),
    ).toBeNull();
    // All-empty bullets are as good as no Differences at all.
    expect(
      parseSummaryResponse(
        JSON.stringify({
          summaries: { gauche: ['ok'] },
          differences: ['', '  '],
        }),
      ),
    ).toBeNull();
  });

  it('keeps only non-empty string bullets and a non-empty Differences text', () => {
    const text = JSON.stringify({
      summaries: {
        gauche: ['ok', '', 42, null, 'autre'],
        centre: [],
        droite: [],
      },
      differences: ['  Texte.  '],
    });
    expect(parseSummaryResponse(text)).toEqual({
      summaries: { gauche: ['ok', 'autre'], centre: [], droite: [] },
      differences: ['Texte.'],
    });
  });

  it('keeps absent Leanings absent', () => {
    const text = JSON.stringify({
      summaries: { centre: ['seule'] },
      differences: ['x'],
    });
    expect(parseSummaryResponse(text)).toEqual({
      summaries: { centre: ['seule'] },
      differences: ['x'],
    });
  });
});

describe('updateSummaries', () => {
  it('summarizes an Edition Story that gained Articles, storing only covered Leanings', async () => {
    // Coverage: one Centre Outlet + one Droite Outlet; Gauche uncovered —
    // the model answered for all three, Gauche must be dropped.
    const s = story(
      's1',
      'sujet-1',
      [
        article('a2', 'figaro', { publishedAt: '2026-10-06T11:00:00Z' }),
        article('a1', 'lemonde', { publishedAt: '2026-10-06T09:00:00Z' }),
      ],
      {
        summarizedArticleCount: 1,
        summaries: { centre: ['Vieux résumé'] },
        differences: ['Ancienne lecture.'],
      },
    );
    const calls: { input: SummaryInput }[] = [];
    const outcome = await updateSummaries({
      stories: [s],
      now: new Date('2026-10-06T12:00:00Z'),
      teasers: new Map([['a2', 'Teaser deux']]),
      outletById,
      model: fakeModel(GOOD_RESPONSE, calls),
      promptVersion: SUMMARIES_PROMPT_VERSION,
    });
    expect(calls).toHaveLength(1);
    expect(s.summaries).toEqual({
      centre: ['Lu au centre'],
      droite: ['Lu à droite'],
    });
    expect(s.differences).toEqual(['La droite insiste sur X.']);
    expect(s.promptVersion).toBe(SUMMARIES_PROMPT_VERSION);
    expect(s.summarizedArticleCount).toBe(2);
    expect(outcome.changed).toEqual(new Set(['sujet-1']));
    expect(outcome.calls).toBe(1);
  });

  it('makes no model call for Stories that gained no Articles since the last run', async () => {
    const s = story('s1', 'sujet-1', [article('a1', 'lemonde')], {
      summarizedArticleCount: 1,
      summaries: { centre: ['Résumé'] },
      differences: ['Diff.'],
    });
    const calls: { input: SummaryInput }[] = [];
    const outcome = await updateSummaries({
      stories: [s],
      now: new Date('2026-10-06T12:00:00Z'),
      teasers: new Map(),
      outletById,
      model: fakeModel(GOOD_RESPONSE, calls),
      promptVersion: SUMMARIES_PROMPT_VERSION,
    });
    expect(calls).toHaveLength(0);
    expect(s.summaries).toEqual({ centre: ['Résumé'] });
    expect(outcome.changed.size).toBe(0);
    expect(outcome.calls).toBe(0);
  });

  it('leaves a Story untouched when the model fails, and never bumps its count', async () => {
    const s = story(
      's1',
      'sujet-1',
      [article('a1', 'lemonde'), article('a2', 'figaro')],
      {
        summarizedArticleCount: 1,
        summaries: { centre: ['Résumé'] },
        differences: ['Diff.'],
      },
    );
    const calls: { input: SummaryInput }[] = [];
    const outcome = await updateSummaries({
      stories: [s],
      now: new Date('2026-10-06T12:00:00Z'),
      teasers: new Map(),
      outletById,
      model: fakeModel(null, calls),
      promptVersion: SUMMARIES_PROMPT_VERSION,
    });
    expect(calls).toHaveLength(1);
    expect(s.summaries).toEqual({ centre: ['Résumé'] });
    expect(s.summarizedArticleCount).toBe(1);
    expect(outcome.changed.size).toBe(0);
  });

  it('feeds the model the WHOLE Article set — no delta, no previous Summaries', async () => {
    const s = story(
      's1',
      'sujet-1',
      [
        article('a2', 'figaro', {
          publishedAt: '2026-10-06T11:00:00Z',
          frontPage: true,
        }),
        article('a1', 'lemonde', {
          publishedAt: '2026-10-06T09:00:00Z',
          kind: 'opinion',
        }),
        // Below the seen count: still fed — the synthesis covers the corpus.
        article('a0', 'lemonde', { publishedAt: '2026-10-06T08:00:00Z' }),
      ],
      {
        summarizedArticleCount: 2,
        summaries: { centre: ['Vieux'] },
        differences: ['Ancienne.'],
      },
    );
    const calls: { input: SummaryInput }[] = [];
    await updateSummaries({
      stories: [s],
      now: new Date('2026-10-06T12:00:00Z'),
      teasers: new Map([
        // Teasers exist only while an Article is still in the feeds' window:
        // a2 and a1 are still collected, a0 has rotated out.
        ['a2', 'Teaser deux'],
        ['a1', 'Teaser un'],
      ]),
      outletById,
      model: fakeModel(GOOD_RESPONSE, calls),
      promptVersion: SUMMARIES_PROMPT_VERSION,
    });
    expect(calls).toHaveLength(1);
    const { input } = calls[0];
    expect(input.story.title).toBe('Sujet s1');
    // The previous Summaries/Differences are never fed back: each call is a
    // fresh synthesis, so the output can never be a patch on the old text.
    expect(input).not.toHaveProperty('previousSummaries');
    expect(input).not.toHaveProperty('previousDifferences');
    expect(input.articles).toEqual([
      {
        headline: 'Titre a2',
        teaser: 'Teaser deux',
        outletName: 'Le Figaro',
        outletLeaning: 'droite',
        opinion: false,
        frontPage: true,
      },
      {
        headline: 'Titre a1',
        teaser: 'Teaser un',
        outletName: 'Le Monde',
        outletLeaning: 'centre',
        opinion: true,
        frontPage: false,
      },
      {
        headline: 'Titre a0',
        teaser: '',
        outletName: 'Le Monde',
        outletLeaning: 'centre',
        opinion: false,
        frontPage: false,
      },
    ]);
  });

  it('marks a Story with Summaries as changed even when it already had some (rewrite, not append)', async () => {
    const s = story(
      's1',
      'sujet-1',
      [article('a1', 'lemonde'), article('a2', 'figaro')],
      {
        summarizedArticleCount: 1,
        summaries: { centre: ['Vieux résumé'], droite: ['Vieux aussi'] },
        differences: ['Ancienne.'],
      },
    );
    const outcome = await updateSummaries({
      stories: [s],
      now: new Date('2026-10-06T12:00:00Z'),
      teasers: new Map(),
      outletById,
      model: fakeModel(GOOD_RESPONSE),
      promptVersion: SUMMARIES_PROMPT_VERSION,
    });
    expect(outcome.changed).toEqual(new Set(['sujet-1']));
    expect(s.summaries?.centre).toEqual(['Lu au centre']);
  });

  it('is a no-op without a model, without touching anything', async () => {
    const s = story('s1', 'sujet-1', [article('a1', 'lemonde')]);
    const outcome = await updateSummaries({
      stories: [s],
      now: new Date('2026-10-06T12:00:00Z'),
      teasers: new Map(),
      outletById,
      model: undefined,
      promptVersion: SUMMARIES_PROMPT_VERSION,
    });
    expect(outcome.calls).toBe(0);
    expect(outcome.changed.size).toBe(0);
    expect(s.summaries).toBeUndefined();
    expect(s.summarizedArticleCount).toBeUndefined();
  });

  it('stores Summaries only for Leanings with Coverage, even on a first run', async () => {
    const s = story('s1', 'sujet-1', [article('a1', 'lemonde')]);
    await updateSummaries({
      stories: [s],
      now: new Date('2026-10-06T12:00:00Z'),
      teasers: new Map(),
      outletById,
      model: fakeModel(GOOD_RESPONSE),
      promptVersion: SUMMARIES_PROMPT_VERSION,
    });
    expect(s.summaries).toEqual({ centre: ['Lu au centre'] });
  });
});

describe('updateSummaries — 25% growth gate (ADR-0027)', () => {
  it('summarizes a first-time Story (no watermark) over its whole Article set', async () => {
    const articles = [
      article('a1', 'lemonde', { publishedAt: '2026-10-06T09:00:00Z' }),
      article('a2', 'figaro', { publishedAt: '2026-10-06T11:00:00Z' }),
    ];
    const s = story('s1', 'sujet-1', articles); // no summarizedArticleCount
    const calls: { input: SummaryInput }[] = [];
    const outcome = await updateSummaries({
      stories: [s],
      now: new Date('2026-10-06T12:00:00Z'),
      teasers: new Map(),
      outletById,
      model: fakeModel(GOOD_RESPONSE, calls),
      promptVersion: SUMMARIES_PROMPT_VERSION,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].input.articles).toHaveLength(2);
    expect(s.summarizedArticleCount).toBe(2);
    expect(outcome.changed).toEqual(new Set(['sujet-1']));
  });

  it('keeps Summaries unchanged below 25% growth since the last pass', async () => {
    // 9 seen, 10 now: +1 = 12.5% growth — under the gate.
    const articles = Array.from({ length: 10 }, (_, i) =>
      article(`a${i}`, 'lemonde', {
        publishedAt: `2026-10-06T0${i}:00:00Z`,
      }),
    );
    const s = story('s1', 'sujet-1', articles, {
      summarizedArticleCount: 9,
      summaries: { centre: ['Résumé'] },
      differences: ['Diff.'],
    });
    const calls: { input: SummaryInput }[] = [];
    const outcome = await updateSummaries({
      stories: [s],
      now: new Date('2026-10-06T12:00:00Z'),
      teasers: new Map(),
      outletById,
      model: fakeModel(GOOD_RESPONSE, calls),
      promptVersion: SUMMARIES_PROMPT_VERSION,
    });
    expect(calls).toHaveLength(0);
    expect(s.summaries).toEqual({ centre: ['Résumé'] });
    expect(s.summarizedArticleCount).toBe(9);
    expect(outcome.changed.size).toBe(0);
    expect(outcome.calls).toBe(0);
  });

  it('re-summarizes at exactly 25% growth (the gate is « at least »)', async () => {
    // 8 seen, 10 now: +2 = 25% — the gate fires.
    const articles = Array.from({ length: 10 }, (_, i) =>
      article(`a${i}`, i % 2 === 0 ? 'lemonde' : 'figaro', {
        publishedAt: `2026-10-06T0${i}:00:00Z`,
      }),
    );
    const s = story('s1', 'sujet-1', articles, {
      summarizedArticleCount: 8,
      summaries: { centre: ['Vieux'] },
      differences: ['Ancienne.'],
    });
    const calls: { input: SummaryInput }[] = [];
    await updateSummaries({
      stories: [s],
      now: new Date('2026-10-06T12:00:00Z'),
      teasers: new Map(),
      outletById,
      model: fakeModel(GOOD_RESPONSE, calls),
      promptVersion: SUMMARIES_PROMPT_VERSION,
    });
    expect(calls).toHaveLength(1);
    expect(s.summaries).toEqual({
      centre: ['Lu au centre'],
      droite: ['Lu à droite'],
    });
    expect(s.summarizedArticleCount).toBe(10);
  });

  it('costs no call when a 100-Article Story gains one Article', async () => {
    const articles = Array.from({ length: 101 }, (_, i) =>
      article(`a${i}`, 'lemonde', {
        publishedAt: `2026-10-06T10:00:00Z`,
      }),
    );
    const s = story('s1', 'sujet-1', articles, {
      summarizedArticleCount: 100,
      summaries: { centre: ['Résumé'] },
      differences: ['Diff.'],
    });
    const calls: { input: SummaryInput }[] = [];
    const outcome = await updateSummaries({
      stories: [s],
      now: new Date('2026-10-06T12:00:00Z'),
      teasers: new Map(),
      outletById,
      model: fakeModel(GOOD_RESPONSE, calls),
      promptVersion: SUMMARIES_PROMPT_VERSION,
    });
    expect(calls).toHaveLength(0);
    expect(outcome.calls).toBe(0);
    expect(s.summaries).toEqual({ centre: ['Résumé'] });
  });

  it('spends the budget only on Stories passing the gate', async () => {
    // Under the gate: 9 seen, 10 now. Over it: never summarized.
    const gated = story(
      's-gated',
      'sujet-gated',
      Array.from({ length: 10 }, (_, i) =>
        article(`g${i}`, 'lemonde', { publishedAt: '2026-10-06T09:00:00Z' }),
      ),
      {
        summarizedArticleCount: 9,
        summaries: { centre: ['Résumé'] },
        differences: ['Diff.'],
      },
    );
    const firstTime = story('s-new', 'sujet-new', [
      article('n1', 'lemonde'),
      article('n2', 'figaro'),
    ]);
    const calls: { input: SummaryInput }[] = [];
    const outcome = await updateSummaries({
      stories: [gated, firstTime],
      now: new Date('2026-10-06T12:00:00Z'),
      teasers: new Map(),
      outletById,
      model: fakeModel(GOOD_RESPONSE, calls),
      promptVersion: SUMMARIES_PROMPT_VERSION,
      budget: 1,
    });
    expect(outcome.calls).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].input.story.id).toBe('s-new');
    expect(gated.summaries).toEqual({ centre: ['Résumé'] });
    expect(firstTime.summaries).toEqual({
      centre: ['Lu au centre'],
      droite: ['Lu à droite'],
    });
  });
});

describe('summariesPrompt', () => {
  it('carries the prompt version so a prompt change cannot be forgotten', () => {
    const prompt = summariesPrompt({
      story: { id: 's1', title: 'Sujet', section: 'politics' },
      articles: [],
      coveredLeanings: ['centre'],
    });
    expect(prompt).toContain(SUMMARIES_PROMPT_VERSION);
  });

  it('presents the whole corpus and never an update of previous output', () => {
    const prompt = summariesPrompt({
      story: { id: 's1', title: 'Sujet', section: undefined },
      articles: [],
      coveredLeanings: ['centre'],
    });
    expect(prompt).toContain('Articles du sujet');
    // The sum-1..sum-3 update framing invited chronicle-style patches.
    expect(prompt).not.toContain('déjà publiés');
    expect(prompt).not.toContain('mets à jour');
  });

  it('instructs honesty for a single-Leaning Story: describe, never invent contrasts', () => {
    const prompt = summariesPrompt({
      story: { id: 's1', title: 'Sujet', section: undefined },
      articles: [
        {
          headline: 'T',
          teaser: '',
          outletName: 'Le Monde',
          outletLeaning: 'centre',
          opinion: false,
          frontPage: false,
        },
      ],
      coveredLeanings: ['centre'],
    });
    expect(prompt).toContain('ne rien inventer');
  });

  it('forces one treatment bullet per covered camp and excludes relayed statements (sum-7)', () => {
    const prompt = summariesPrompt({
      story: { id: 's1', title: 'Sujet', section: undefined },
      articles: [
        {
          headline: 'T',
          teaser: '',
          outletName: 'Le Monde',
          outletLeaning: 'centre',
          opinion: false,
          frontPage: false,
        },
        {
          headline: 'T2',
          teaser: '',
          outletName: 'Le Figaro',
          outletLeaning: 'droite',
          opinion: false,
          frontPage: false,
        },
      ],
      coveredLeanings: ['centre', 'droite'],
    });
    // The comparison is structurally guaranteed: exactly one bullet per
    // covered camp, never more.
    expect(prompt).toContain('exactement une puce par camp couvert');
    expect(prompt).toContain('jamais plus');
    // The analysis targets the media treatment, never the political debate:
    // what a camp's media merely relay from other camps is not its treatment.
    expect(prompt).toContain(
      "n'attribue jamais à un camp un propos que ses médias ne font que relayer",
    );
    // Cold-analysis checklist: vocabulary, emphasis, hidden or ignored facts.
    expect(prompt).toContain("le vocabulaire qu'ils emploient");
    expect(prompt).toContain("ce qu'ils taisent ou passent sous silence");
    // Reformulation may not bleed into the facts: precise vocabulary stays,
    // striking source formulas are quoted, never abstracted away.
    expect(prompt).toContain('garde le vocabulaire précis des faits');
    expect(prompt).toContain(
      'Ne remplace jamais un mot précis par un terme générique',
    );
    expect(prompt).toContain('cite-la entre guillemets');
    // Intra-camp divergences live inside the camp's own bullet, not a
    // separate one.
    expect(prompt).toContain('une seconde phrase');
    expect(prompt).toContain('jamais une puce séparée');
  });

  it('folds centre-gauche Articles into the gauche group (issue #46)', async () => {
    const s = story('s1', 'sujet-1', [article('a1', 'franceinfo')]);
    const calls: { input: SummaryInput }[] = [];
    await updateSummaries({
      stories: [s],
      now: new Date('2026-10-06T12:00:00Z'),
      teasers: new Map(),
      outletById,
      model: fakeModel(GOOD_RESPONSE, calls),
      promptVersion: SUMMARIES_PROMPT_VERSION,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].input.coveredLeanings).toEqual(['gauche']);
    expect(s.summaries).toEqual({ gauche: ['Lu à gauche'] });
  });

  it('tags each Article with its Outlet and Leaning, so per-Leaning Summaries are attributable', () => {
    const prompt = summariesPrompt({
      story: { id: 's1', title: 'Sujet', section: undefined },
      articles: [
        {
          headline: 'T',
          teaser: 'Tea',
          outletName: 'Le Monde',
          outletLeaning: 'centre',
          opinion: false,
          frontPage: true,
        },
      ],
      coveredLeanings: ['centre'],
    });
    expect(prompt).toContain('[Le Monde, centre, à la une] T — Tea');
  });

  it('tags Articles with their granular band and spells out the group fold (issue #46)', () => {
    const prompt = summariesPrompt({
      story: { id: 's1', title: 'Sujet', section: undefined },
      articles: [
        {
          headline: 'T',
          teaser: '',
          outletName: 'franceinfo',
          outletLeaning: 'centre-gauche',
          opinion: false,
          frontPage: false,
        },
      ],
      coveredLeanings: ['gauche'],
    });
    // Granular band in the tag…
    expect(prompt).toContain('[franceinfo, centre gauche] T');
    // …and the fold into the three camps spelled out in the instructions.
    expect(prompt).toContain(
      'le camp gauche comprend les médias classés « centre gauche »',
    );
    expect(prompt).toContain(
      'le camp droite comprend les médias classés « centre droit »',
    );
  });
});

describe('updateSummaries — frozen Stories (ADR-0005/ADR-0006)', () => {
  it('makes zero calls and never mutates a frozen Story with a stale count', async () => {
    // A Story whose Summaries call once failed freezes with
    // summarizedArticleCount < articles.length; since ADR-0017 it sits in
    // the Edition input as backfill — every later build must leave its
    // file (and its Summaries fields) byte-identical.
    const s = story(
      's1',
      'sujet-1',
      [
        article('a1', 'lemonde', { publishedAt: '2026-10-05T10:00:00Z' }),
        article('a2', 'figaro', { publishedAt: '2026-10-05T11:00:00Z' }),
      ],
      {
        summarizedArticleCount: 1,
        summaries: { centre: ['Résumé'] },
        differences: ['Diff.'],
      },
    );
    const frozen = structuredClone(s);
    const calls: { input: SummaryInput }[] = [];
    const outcome = await updateSummaries({
      stories: [s],
      // Both Articles are older than 24h: the Story has frozen.
      now: new Date('2026-10-06T12:00:00Z'),
      teasers: new Map([['a2', 'Teaser deux']]),
      outletById,
      model: fakeModel(GOOD_RESPONSE, calls),
      promptVersion: SUMMARIES_PROMPT_VERSION,
    });
    expect(calls).toHaveLength(0);
    expect(s).toEqual(frozen);
    expect(outcome.changed.size).toBe(0);
    expect(outcome.calls).toBe(0);
  });
});

/**
 * The per-build Summaries budget (ADR-0022): at most the top-20 ranked
 * Stories among those that gained Articles gain a model call — the Gemini
 * free tier's RPD (500, shared with Grouping's ~24 calls/day) divides into
 * hourly builds as ~20 calls per build. Unchanged Stories cost zero; a
 * Story beyond the budget keeps its existing summary as-is until a later
 * build re-ranks it into the top-20.
 */
describe('geminiSummariesModel request body', () => {
  it('pins temperature to 0: a re-synthesis changes only when the Story does', async () => {
    let body: unknown;
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summaries: { centre: ['Lu au centre'] },
                      differences: ['Diff.'],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      } as unknown as Response;
    }) as typeof fetch;
    try {
      const model = geminiSummariesModel('test-key', 'test-model', 'Test');
      const parsed = await model.summarize({
        story: { id: 's1', title: 'Sujet' },
        articles: [],
        coveredLeanings: ['centre'],
      });
      expect(parsed).toEqual({
        summaries: { centre: ['Lu au centre'] },
        differences: ['Diff.'],
      });
      const generationConfig = (
        body as {
          generationConfig?: {
            temperature?: number;
            responseJsonSchema?: unknown;
          };
        }
      ).generationConfig;
      expect(generationConfig?.temperature).toBe(0);
      expect(generationConfig?.responseJsonSchema).toBeDefined();
    } finally {
      globalThis.fetch = realFetch;
      vi.restoreAllMocks();
    }
  });
});

describe('updateSummaries — per-build budget (ADR-0022)', () => {
  const now = new Date('2026-10-06T12:00:00Z');

  /** A live Story with one unseen Article and Coverage. */
  function changedStory(id: string, summarizedArticleCount = 0) {
    return story(id, `sujet-${id}`, [article(`a-${id}`, 'lemonde')], {
      summarizedArticleCount,
    });
  }

  it('summarizes only the first `budget` Stories in input order, skipping the rest untouched', async () => {
    const stories = [changedStory('a'), changedStory('b'), changedStory('c')];
    const calls: { input: SummaryInput }[] = [];
    const outcome = await updateSummaries({
      stories,
      now,
      teasers: new Map(),
      outletById,
      model: fakeModel(GOOD_RESPONSE, calls),
      promptVersion: SUMMARIES_PROMPT_VERSION,
      budget: 2,
    });
    expect(calls).toHaveLength(2);
    expect(outcome.calls).toBe(2);
    expect(stories[0]!.summaries).toBeDefined();
    expect(stories[1]!.summaries).toBeDefined();
    expect(stories[2]!.summaries).toBeUndefined();
    expect(stories[2]!.summarizedArticleCount).toBe(0);
    expect(outcome.changed).toEqual(new Set(['sujet-a', 'sujet-b']));
  });

  it('does not spend the budget on Stories with no unseen Articles', async () => {
    const unchanged = story('old', 'sujet-old', [article('a-old', 'lemonde')], {
      summarizedArticleCount: 1,
    });
    const first = changedStory('a');
    const second = changedStory('b');
    const calls: { input: SummaryInput }[] = [];
    await updateSummaries({
      stories: [unchanged, first, second],
      now,
      teasers: new Map(),
      outletById,
      model: fakeModel(GOOD_RESPONSE, calls),
      promptVersion: SUMMARIES_PROMPT_VERSION,
      budget: 2,
    });
    // `first` and `second` both summarize: the unchanged Story cost zero.
    expect(calls).toHaveLength(2);
  });

  it('summarizes every Story when the budget covers them (default: no budget)', async () => {
    const stories = [changedStory('a'), changedStory('b')];
    const calls: { input: SummaryInput }[] = [];
    await updateSummaries({
      stories,
      now,
      teasers: new Map(),
      outletById,
      model: fakeModel(GOOD_RESPONSE, calls),
      promptVersion: SUMMARIES_PROMPT_VERSION,
    });
    expect(calls).toHaveLength(2);
  });
});
