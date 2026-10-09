import type { Article, Outlet, Story } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import {
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
  },
  {
    id: 'franceinfo',
    name: 'franceinfo',
    leaning: 'centre-gauche',
    paywall: 'none',
    site: 'https://francetvinfo.fr',
    feeds: { latest: 'x' },
  },
  {
    id: 'figaro',
    name: 'Le Figaro',
    leaning: 'droite',
    paywall: 'none',
    site: 'https://lefigaro.fr',
    feeds: { latest: 'x' },
  },
  {
    id: 'liberation',
    name: 'Libération',
    leaning: 'gauche',
    paywall: 'partial',
    site: 'https://liberation.fr',
    feeds: { latest: 'x' },
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
    articles,
    ...extra,
  };
}

/** Records every call so tests can assert on the exact model input. */
function fakeModel(
  response: { summaries: Record<string, unknown>; differences: string } | null,
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
  differences: 'La droite insiste sur X.',
};

describe('parseSummaryResponse', () => {
  it('parses per-Leaning Summaries and Differences', () => {
    const text = JSON.stringify({
      summaries: {
        gauche: ['Bullet un', 'Bullet deux'],
        centre: ['Bullet trois'],
        droite: [],
      },
      differences: 'La droite insiste sur X, la gauche sur Y.',
    });
    expect(parseSummaryResponse(text)).toEqual({
      summaries: {
        gauche: ['Bullet un', 'Bullet deux'],
        centre: ['Bullet trois'],
        droite: [],
      },
      differences: 'La droite insiste sur X, la gauche sur Y.',
    });
  });

  it('returns null on malformed JSON', () => {
    expect(parseSummaryResponse('not json')).toBeNull();
  });

  it('returns null when Summaries or Differences are missing or the wrong shape', () => {
    expect(
      parseSummaryResponse(JSON.stringify({ differences: 'x' })),
    ).toBeNull();
    expect(parseSummaryResponse(JSON.stringify({ summaries: {} }))).toBeNull();
    expect(
      parseSummaryResponse(
        JSON.stringify({
          summaries: { gauche: 'not an array' },
          differences: 'x',
        }),
      ),
    ).toBeNull();
    expect(
      parseSummaryResponse(
        JSON.stringify({ summaries: { gauche: ['ok'] }, differences: 42 }),
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
      differences: '  Texte.  ',
    });
    expect(parseSummaryResponse(text)).toEqual({
      summaries: { gauche: ['ok', 'autre'], centre: [], droite: [] },
      differences: 'Texte.',
    });
  });

  it('keeps absent Leanings absent', () => {
    const text = JSON.stringify({
      summaries: { centre: ['seule'] },
      differences: 'x',
    });
    expect(parseSummaryResponse(text)).toEqual({
      summaries: { centre: ['seule'] },
      differences: 'x',
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
        differences: 'Ancienne lecture.',
      },
    );
    const calls: { input: SummaryInput }[] = [];
    const outcome = await updateSummaries({
      stories: [s],
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
    expect(s.differences).toBe('La droite insiste sur X.');
    expect(s.promptVersion).toBe(SUMMARIES_PROMPT_VERSION);
    expect(s.summarizedArticleCount).toBe(2);
    expect(outcome.changed).toEqual(new Set(['sujet-1']));
    expect(outcome.calls).toBe(1);
  });

  it('makes no model call for Stories that gained no Articles since the last run', async () => {
    const s = story('s1', 'sujet-1', [article('a1', 'lemonde')], {
      summarizedArticleCount: 1,
      summaries: { centre: ['Résumé'] },
      differences: 'Diff.',
    });
    const calls: { input: SummaryInput }[] = [];
    const outcome = await updateSummaries({
      stories: [s],
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
        differences: 'Diff.',
      },
    );
    const calls: { input: SummaryInput }[] = [];
    const outcome = await updateSummaries({
      stories: [s],
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

  it('feeds the model only the new Articles, tagged, plus the previous Summaries and Differences', async () => {
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
        // Below the seen count: must NOT be in the input again.
        article('a0', 'lemonde', { publishedAt: '2026-10-06T08:00:00Z' }),
      ],
      {
        summarizedArticleCount: 2,
        summaries: { centre: ['Vieux'] },
        differences: 'Ancienne.',
      },
    );
    const calls: { input: SummaryInput }[] = [];
    await updateSummaries({
      stories: [s],
      teasers: new Map([['a2', 'Teaser deux']]),
      outletById,
      model: fakeModel(GOOD_RESPONSE, calls),
      promptVersion: SUMMARIES_PROMPT_VERSION,
    });
    expect(calls).toHaveLength(1);
    const { input } = calls[0];
    expect(input.story.title).toBe('Sujet s1');
    expect(input.previousSummaries).toEqual({ centre: ['Vieux'] });
    expect(input.previousDifferences).toBe('Ancienne.');
    expect(input.newArticles).toEqual([
      {
        headline: 'Titre a2',
        teaser: 'Teaser deux',
        outletName: 'Le Figaro',
        outletLeaning: 'droite',
        opinion: false,
        frontPage: true,
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
        differences: 'Ancienne.',
      },
    );
    const outcome = await updateSummaries({
      stories: [s],
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
      teasers: new Map(),
      outletById,
      model: fakeModel(GOOD_RESPONSE),
      promptVersion: SUMMARIES_PROMPT_VERSION,
    });
    expect(s.summaries).toEqual({ centre: ['Lu au centre'] });
  });
});

describe('summariesPrompt', () => {
  it('carries the prompt version so a prompt change cannot be forgotten', () => {
    const prompt = summariesPrompt({
      story: { id: 's1', title: 'Sujet', section: 'politics' },
      previousSummaries: undefined,
      previousDifferences: undefined,
      newArticles: [],
      coveredLeanings: ['centre'],
    });
    expect(prompt).toContain(SUMMARIES_PROMPT_VERSION);
  });

  it('instructs honesty for a single-Leaning Story: describe, never invent contrasts', () => {
    const prompt = summariesPrompt({
      story: { id: 's1', title: 'Sujet', section: undefined },
      previousSummaries: undefined,
      previousDifferences: undefined,
      newArticles: [
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

  it('folds centre-gauche Articles into the gauche group (issue #46)', async () => {
    const s = story('s1', 'sujet-1', [article('a1', 'franceinfo')]);
    const calls: { input: SummaryInput }[] = [];
    await updateSummaries({
      stories: [s],
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
      previousSummaries: undefined,
      previousDifferences: undefined,
      newArticles: [
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
      previousSummaries: undefined,
      previousDifferences: undefined,
      newArticles: [
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
