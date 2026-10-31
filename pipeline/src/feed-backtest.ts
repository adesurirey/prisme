// One-off backtest (free, no API): replay the proposed « Le fil » key over
// the data/ archive at hourly checkpoints — in-window Coverage, halved every
// `h` hours since the Story's newest in-window Article — for h ∈ {3, 6, 12},
// against the two live Editions (« Aujourd'hui », « En direct ») ranked by
// their production keys. Prints the volatility/residence/overlap numbers the
// half-life choice needs (the grading tool for Le fil's V0). Run:
// pnpm backtest:feed
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Story } from '@prisme/domain';
import {
  articlesInWindow,
  foundingInstant,
  parseInstant,
  rankStoriesInWindow,
  rankStoriesLatestFirst,
  reportingOutletIds,
} from '@prisme/domain';
import { DAY_WINDOW_MS, LATEST_WINDOW_MS } from './ranking.js';

const dir = join(import.meta.dirname, '../../data/stories');
const HALF_LIVES_H = [3, 6, 12];
const HOUR = 3_600_000;
const TOP = 20;

const stories: Story[] = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Story);

const instants = stories.flatMap((s) =>
  s.articles
    .map((a) => parseInstant(a.publishedAt))
    .filter((t): t is number => t != null),
);
const first = Math.min(...instants);
const last = Math.max(...instants);
// Hourly checkpoints, one day in (the day window needs a full past day).
const start = Math.ceil((first + DAY_WINDOW_MS) / HOUR) * HOUR;
const checkpoints: number[] = [];
for (let t = start; t <= last; t += HOUR) checkpoints.push(t);

/** The Le fil key: Coverage in the day window × 2^(−silent hours / h),
 * tie-broken newest desc, founding desc, id asc — fully deterministic. */
function feedKey(outlets: number, newest: number, h: number, t: number) {
  return outlets * 2 ** (-(t - newest) / (h * HOUR));
}

interface Ranking {
  ids: string[];
}

interface Feeds {
  day: Ranking;
  latest: Ranking;
  feed: Map<number, Ranking>;
}

function at(t: number): Feeds {
  const now = new Date(t);
  // Production membership for « Aujourd'hui » — Le fil re-ranks this pool.
  const pool = stories.filter(
    (s) => articlesInWindow(s.articles, DAY_WINDOW_MS, now).length > 0,
  );
  const day = rankStoriesInWindow(pool, DAY_WINDOW_MS, now).map((s) => s.id);
  const latest = rankStoriesLatestFirst(
    pool.filter((s) => {
      const founding = foundingInstant(s);
      return (
        founding != null && founding >= t - LATEST_WINDOW_MS && founding <= t
      );
    }),
  ).map((s) => s.id);
  const per = stories.map((s) => {
    const inWindow = articlesInWindow(s.articles, DAY_WINDOW_MS, now);
    if (inWindow.length === 0) return null;
    const newest = Math.max(
      ...inWindow.map((a) => parseInstant(a.publishedAt) ?? 0),
    );
    return {
      s,
      outlets: reportingOutletIds(inWindow).size,
      newest,
      founding: foundingInstant(s) ?? 0,
    };
  });
  const feed = new Map<number, Ranking>();
  for (const h of HALF_LIVES_H) {
    const ranked = per
      .filter((x): x is NonNullable<typeof x> => x != null)
      .sort(
        (a, b) =>
          feedKey(b.outlets, b.newest, h, t) -
            feedKey(a.outlets, a.newest, h, t) ||
          b.newest - a.newest ||
          b.founding - a.founding ||
          a.s.id.localeCompare(b.s.id),
      )
      .map((x) => x.s.id);
    feed.set(h, { ids: ranked });
  }
  return { day: { ids: day }, latest: { ids: latest }, feed };
}

/** Rolling per-Statistic accumulator, keyed by label. */
const stats = new Map<
  string,
  {
    lengths: number[];
    top1Changes: number;
    steps: number;
    top1Runs: number[];
    top3Runs: number[]; // longest top-3 residence per Story, in hours
    churn: number[];
    overlapDay: number[];
    overlapLatest: number[];
    distinctTop: Set<string>;
  }
>();
const stat = (label: string) => {
  let s = stats.get(label);
  if (s == null) {
    s = {
      lengths: [],
      top1Changes: 0,
      steps: 0,
      top1Runs: [],
      top3Runs: [],
      churn: [],
      overlapDay: [],
      overlapLatest: [],
      distinctTop: new Set(),
    };
    stats.set(label, s);
  }
  return s;
};

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

let previous: Feeds | undefined;
// Consecutive top-3 run per Story, per label, cut into longest runs.
const currentRuns = new Map<string, Map<string, number>>();
const bump = (label: string, ids: string[], rank: number) => {
  const runs = currentRuns.get(label) ?? new Map<string, number>();
  currentRuns.set(label, runs);
  const id = ids[rank - 1];
  if (id == null) return;
  runs.set(id, (runs.get(id) ?? 0) + 1);
};

for (const t of checkpoints) {
  const feeds = at(t);
  const labels: [string, string[]][] = [
    ['Aujourd’hui', feeds.day.ids],
    ['En direct', feeds.latest.ids],
    ...HALF_LIVES_H.map(
      (h) => [`Le fil h=${h}`, feeds.feed.get(h)!.ids] as [string, string[]],
    ),
  ];
  for (const [label, ids] of labels) {
    const s = stat(label);
    s.lengths.push(ids.length);
    s.distinctTop = new Set([...s.distinctTop, ...ids.slice(0, TOP)]);
    if (previous != null) {
      s.steps++;
      const prevIds = labelsPrev(previous, label);
      if (prevIds[0] !== ids[0]) s.top1Changes++;
      const prevTop = new Set(prevIds.slice(0, TOP));
      const churn = ids.slice(0, TOP).filter((id) => !prevTop.has(id)).length;
      s.churn.push((churn / TOP) * 100);
    }
    bump(label, ids, 1);
    bump(label, ids, 2);
    bump(label, ids, 3);
  }
  // Le fil's overlap with the two live Editions (top-20).
  for (const h of HALF_LIVES_H) {
    const s = stat(`Le fil h=${h}`);
    const top = feeds.feed.get(h)!.ids.slice(0, TOP);
    s.overlapDay.push(
      top.filter((id) => feeds.day.ids.slice(0, TOP).includes(id)).length,
    );
    s.overlapLatest.push(
      top.filter((id) => feeds.latest.ids.includes(id)).length,
    );
  }
  previous = feeds;
}

function labelsPrev(prev: Feeds, label: string): string[] {
  if (label === 'Aujourd’hui') return prev.day.ids;
  if (label === 'En direct') return prev.latest.ids;
  const h = Number(label.split('=')[1]);
  return prev.feed.get(h)!.ids;
}

// Cut the top-3 run counters into longest-residence-per-Story lists.
for (const [label, runs] of currentRuns) {
  stat(label).top3Runs = [...runs.values()];
}

const fmt = (xs: number[]) => median(xs).toFixed(1);
console.log(
  `${checkpoints.length} hourly checkpoints over ${new Date(first).toISOString().slice(0, 10)} → ${new Date(last).toISOString().slice(0, 10)}\n`,
);
console.log(
  '                    len(med)  top1chg%  top3res med/max(h)  churn@20%(med)  ov.day@20  ov.direct@20  distinct@20',
);
for (const label of [
  'Aujourd’hui',
  'En direct',
  ...HALF_LIVES_H.map((h) => `Le fil h=${h}`),
]) {
  const s = stats.get(label)!;
  const top3 = `${median(s.top3Runs)} / ${Math.max(...s.top3Runs, 0)}`;
  console.log(
    `${label.padEnd(20)}${fmt(s.lengths).padStart(9)}${((s.top1Changes / Math.max(s.steps, 1)) * 100).toFixed(0).padStart(10)}${top3.padStart(17)}${fmt(s.churn).padStart(15)}${fmt(s.overlapDay).padStart(11)}${fmt(s.overlapLatest).padStart(14)}${s.distinctTop.size.toString().padStart(13)}`,
  );
}

// A taste of the h=6 reading: last day's top 8 at four hours.
const lastDay = new Date(last);
for (const [label, hour] of [
  ['Le fil h=6', 8],
  ['Le fil h=6', 20],
] as [string, number][]) {
  const t = Date.UTC(
    lastDay.getUTCFullYear(),
    lastDay.getUTCMonth(),
    lastDay.getUTCDate(),
    hour,
  );
  if (t >= last) continue;
  const feeds = at(t);
  console.log(`\n${label} at ${new Date(t).toISOString().slice(11, 16)} UTC`);
  const now = new Date(t);
  for (const id of feeds.feed.get(6)!.ids.slice(0, 8)) {
    const s = stories.find((x) => x.id === id)!;
    const inWindow = articlesInWindow(s.articles, DAY_WINDOW_MS, now);
    const outlets = reportingOutletIds(inWindow).size;
    const newest = Math.max(
      ...inWindow.map((a) => parseInstant(a.publishedAt) ?? 0),
    );
    console.log(
      `  ${outlets} outlets, last ${((t - newest) / HOUR).toFixed(1)}h ago — ${s.title}`,
    );
  }
}
