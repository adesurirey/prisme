import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Article, Outlet } from '@prisme/domain';
import { outlets, parseStoryFile } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import type { ActivityWindow } from './story-activity.ts';
import {
  lifeActivityWindow,
  storyActivity,
  storyActivityBins,
} from './story-activity.ts';

/**
 * The binning behind the Story's coverage chronology (ADR-0032), moved
 * from web/src/story-activity.test.ts (issue #186): hour bins align to
 * clock hours, day bins to Paris midnights — never the build host's
 * timezone (same rule as paris-date/paris-day). The bins are pure and
 * clock-free, so the pipeline's embedded values equal what the old
 * web-build computation produced for the same Articles.
 */

let nextId = 0;
const article = (outletId: string, publishedAt: string): Article =>
  ({
    id: `a${nextId++}`,
    outletId,
    headline: 'x',
    url: 'https://example.com',
    publishedAt,
    frontPage: false,
  }) as unknown as Article;

const outlet = (id: string, leaning: Outlet['leaning']): Outlet =>
  ({
    id,
    name: id,
    leaning,
    paywall: 'none',
    site: '',
    feeds: {},
    reach: { value: 1, unit: 'visits', source: 'ACPM', asOf: '2026-08' },
  }) as Outlet;

const BY_ID = new Map(
  ['gauche', 'centre', 'droite', 'centre-gauche'].map((l) => [
    `out-${l}`,
    outlet(`out-${l}`, l as Outlet['leaning']),
  ]),
);

describe('storyActivity', () => {
  it('bins Articles per hour and per Coverage group, excluding out-of-window ones', () => {
    const window: ActivityWindow = {
      start: Date.parse('2026-10-22T15:00:00Z'),
      end: Date.parse('2026-10-23T14:23:45Z'),
      binMs: 3_600_000,
    };
    const articles = [
      // In-window: 16h45 UTC = bin 16:00.
      article('out-gauche', '2026-10-22T16:45:00Z'),
      article('out-centre', '2026-10-22T16:50:00Z'),
      article('out-droite', '2026-10-22T16:55:00Z'),
      // centre-gauche folds into gauche (coverageGroup).
      article('out-centre-gauche', '2026-10-22T16:58:00Z'),
      // Same hour, another droite Article — totals count Articles, not Outlets.
      article('out-droite', '2026-10-22T16:59:00Z'),
      // Before the window: excluded, never clamped into the first bin.
      article('out-gauche', '2026-10-22T14:59:00Z'),
      // After the window: excluded.
      article('out-droite', '2026-10-23T14:24:00Z'),
    ];
    const bins = storyActivity(articles, BY_ID, window);
    expect(bins).toHaveLength(24);
    const bin16 = bins.find(
      (b) => b.start === Date.parse('2026-10-22T16:00:00Z'),
    )!;
    expect(bin16.total).toBe(5);
    expect(bin16.counts).toEqual({ gauche: 2, centre: 1, droite: 2 });
    const empty = bins.find(
      (b) => b.start === Date.parse('2026-10-22T17:00:00Z'),
    )!;
    expect(empty.total).toBe(0);
    expect(empty.counts).toEqual({ gauche: 0, centre: 0, droite: 0 });
    // Nothing before the first bin, nothing after the window end.
    expect(bins[0]!.start).toBe(window.start);
    expect(bins.at(-1)!.end).toBeLessThanOrEqual(window.end + 3_600_000);
  });
});

describe('lifeActivityWindow', () => {
  it('bins a short life hourly, aligned to the clock hour of each end', () => {
    const articles = [
      article('out-gauche', '2026-10-22T09:50:00Z'),
      article('out-droite', '2026-10-23T08:10:00Z'),
    ];
    const window = lifeActivityWindow(articles)!;
    expect(window.binMs).toBe(3_600_000);
    expect(window.start).toBe(Date.parse('2026-10-22T09:00:00Z'));
    expect(window.end).toBe(Date.parse('2026-10-23T09:00:00Z'));
  });

  it('bins a life beyond 48 hours per Paris day', () => {
    const articles = [
      article('out-gauche', '2026-10-12T10:00:00Z'),
      article('out-droite', '2026-10-19T18:00:00Z'),
    ];
    const window = lifeActivityWindow(articles)!;
    expect(window.binMs).toBe(86_400_000);
    expect(window.start).toBe(Date.parse('2026-10-11T22:00:00Z'));
    expect(window.end).toBe(Date.parse('2026-10-19T22:00:00Z'));
  });

  it('is null for a Story without Articles', () => {
    expect(lifeActivityWindow([])).toBeNull();
  });

  it('never runs the hourly axis shorter than a day', () => {
    const at = (h: string) => `2026-10-22T1${h}:00:00Z`;
    // A Story that burst at 14:00Z with a single Article: the axis still
    // spans the 24 hours ending on its last full hour — the burst reads
    // at the right end, not as a one-bar stub.
    const fresh = lifeActivityWindow([{ publishedAt: at('4') } as Article]);
    expect(fresh).toEqual({
      start: Date.parse('2026-10-21T15:00:00Z'),
      end: Date.parse('2026-10-22T15:00:00Z'),
      binMs: 3_600_000,
    });
    // A life longer than a day keeps its own start: the axis only
    // extends, never trims.
    const older = lifeActivityWindow([
      { publishedAt: '2026-10-21T09:30:00Z' } as Article,
      { publishedAt: at('4') } as Article,
    ]);
    expect(older!.start).toBe(Date.parse('2026-10-21T09:00:00Z'));
  });
});

describe('storyActivityBins', () => {
  it('is the whole-life window binned in one call — what the pipeline embeds', () => {
    const articles = [
      article('out-gauche', '2026-10-22T09:50:00Z'),
      article('out-droite', '2026-10-22T16:10:00Z'),
    ];
    const window = lifeActivityWindow(articles)!;
    expect(storyActivityBins(articles, BY_ID)).toEqual(
      storyActivity(articles, BY_ID, window),
    );
  });

  it('is undefined for a Story without datable Articles — the field is omitted', () => {
    expect(storyActivityBins([], BY_ID)).toBeUndefined();
  });
});

describe('the committed fixture (issue #186 done-when)', () => {
  // web/test-data is the app-artifact specimen (ADR-0043): the fixture
  // Stories carry embedded bins, regenerated with this very module. This
  // pins the done-when — a fixture Story's embedded bins equal the
  // (old web-build) computation for the same Articles — and fails the day
  // someone edits the fixture Articles without regenerating the bins. The
  // cross-package read is deliberate: the fixture is the artifact's
  // specimen, and this is the test that keeps it honest.
  it('embeds bins equal to the computation for every fixture Story', async () => {
    const outletById = new Map(outlets.map((o) => [o.id, o]));
    const dir = path.join(import.meta.dirname, '../../web/test-data/stories');
    const names = (await readdir(dir)).filter((n) => n.endsWith('.json'));
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const story = parseStoryFile(
        JSON.parse(await readFile(path.join(dir, name), 'utf8')),
        name,
      );
      expect(story, name).not.toBeNull();
      expect(story!.activity, name).toEqual(
        storyActivityBins(story!.articles, outletById),
      );
    }
  });
});
