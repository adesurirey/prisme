// Backtest (free, no API): replay the À la une sorts over the data/
// archive at hourly checkpoints and print the volatility/residence/
// overlap numbers the ranking constants need (spec #158's grading
// harness — the same measure-before-moving discipline that set the 6 h
// silence half-life). Rows: the production Top (in-window Coverage) and
// Nouveau (latest-first) orders; the pre-#158 silence-only grid (Le fil
// h ∈ {3, 6, 12} — h = 6 was the production Le fil); the double-decay
// Brûlant grid (founding half-lives τ ∈ {12, 18, 24, 48} h, silence at
// the production 6 h; the production τ joins the grid when it differs),
// the shipped production key (★) computed by the real rankStoriesFeed —
// whatever constants it carries. The ranked
// sorts are measured capped at RANKED_CAP (25), Nouveau uncapped; a cap
// column shows the length after the slice. Run: pnpm backtest:feed
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Story } from '@prisme/domain';
import {
  articlesInWindow,
  FEED_FOUNDING_HALF_LIFE_MS,
  FEED_HALF_LIFE_MS,
  foundingInstant,
  parseInstant,
  rankStoriesFeed,
  rankStoriesInWindow,
  rankStoriesLatestFirst,
  reportingOutletIds,
} from '@prisme/domain';
import { DAY_WINDOW_MS, LATEST_WINDOW_MS, RANKED_CAP } from './ranking.js';

const dir = join(import.meta.dirname, '../../data/stories');
const SILENCE_HALF_LIVES_H = [3, 6, 12]; // the pre-#158 Le fil grid
const PROD_TAU_H = FEED_FOUNDING_HALF_LIFE_MS / 3_600_000;
// The Brûlant grid: the measured τ values plus the production one, so
// the shipped key is always a graded row — and its ★ rank below runs
// the real rankStoriesFeed, so a constant change shows up here without
// touching this file.
const FOUNDING_HALF_LIVES_H = [...new Set([12, 18, 24, 48, PROD_TAU_H])].sort(
  (a, b) => a - b,
);
// The shipped key's ★ row label; the taste printout below reuses it.
const PROD_LABEL = `Brûlant τ=${PROD_TAU_H}h ★`;
const HOUR = 3_600_000;
const TOP = RANKED_CAP;
const GAP = 10 * HOUR; // the returning-visit gap the spec measures
const TOP_LABEL = 'Top (prod)';
const NOUVEAU_LABEL = `Nouveau ${LATEST_WINDOW_MS / HOUR}h`;

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

/** The pre-#158 silence-only key: Coverage in the day window ×
 * 2^(−silent hours / h), tie-broken newest desc, founding desc, id asc. */
function silenceKey(outlets: number, newest: number, h: number, t: number) {
  return outlets * 2 ** (-(t - newest) / (h * HOUR));
}

/** The Brûlant key at silence 6 h (production) and founding half-life
 * `tau`: Coverage × silence decay × founding decay, same tie-breaks. */
function brulantKey(
  outlets: number,
  newest: number,
  founding: number,
  tau: number,
  t: number,
) {
  return (
    outlets *
    2 ** (-(t - newest) / FEED_HALF_LIFE_MS) *
    2 ** (-(t - founding) / (tau * HOUR))
  );
}

/** One variant row: its label, whether the 25 cap slices it, and its
 * ranked Story ids at checkpoint `t` (uncapped — measures slice). */
interface Variant {
  label: string;
  capped: boolean;
  rank: (t: number) => string[];
}

const variants: Variant[] = [
  {
    label: TOP_LABEL,
    capped: true,
    rank: (t) => {
      const now = new Date(t);
      const pool = stories.filter(
        (s) => articlesInWindow(s.articles, DAY_WINDOW_MS, now).length > 0,
      );
      return rankStoriesInWindow(pool, DAY_WINDOW_MS, now).map((s) => s.id);
    },
  },
  {
    label: NOUVEAU_LABEL,
    capped: false,
    rank: (t) =>
      rankStoriesLatestFirst(
        stories.filter((s) => {
          const founding = foundingInstant(s);
          return (
            founding != null &&
            founding >= t - LATEST_WINDOW_MS &&
            founding <= t
          );
        }),
      ).map((s) => s.id),
  },
  ...SILENCE_HALF_LIVES_H.map((h) => {
    const rank = (t: number): string[] => {
      const now = new Date(t);
      return perStory(now)
        .sort(
          (a, b) =>
            silenceKey(b.outlets, b.newest, h, t) -
              silenceKey(a.outlets, a.newest, h, t) ||
            b.newest - a.newest ||
            b.founding - a.founding ||
            a.id.localeCompare(b.id),
        )
        .map((x) => x.id);
    };
    return { label: `Le fil h=${h}`, capped: true, rank };
  }),
  ...FOUNDING_HALF_LIVES_H.map((tau) => {
    const shipped = tau === PROD_TAU_H;
    const rank = (t: number): string[] => {
      const now = new Date(t);
      // The shipped row runs the production key itself — the graded
      // code is the code that builds the site.
      if (shipped) {
        const pool = stories.filter(
          (s) => articlesInWindow(s.articles, DAY_WINDOW_MS, now).length > 0,
        );
        return rankStoriesFeed(pool, DAY_WINDOW_MS, now).map((s) => s.id);
      }
      return perStory(now)
        .sort(
          (a, b) =>
            brulantKey(b.outlets, b.newest, b.founding, tau, t) -
              brulantKey(a.outlets, a.newest, a.founding, tau, t) ||
            b.newest - a.newest ||
            b.founding - a.founding ||
            a.id.localeCompare(b.id),
        )
        .map((x) => x.id);
    };
    return {
      label: shipped ? PROD_LABEL : `Brûlant τ=${tau}h`,
      capped: true,
      rank,
    };
  }),
];

/** The day-pool key terms per Story at `now` (pool members only). */
function perStory(now: Date) {
  return stories
    .map((s) => {
      const inWindow = articlesInWindow(s.articles, DAY_WINDOW_MS, now);
      if (inWindow.length === 0) return null;
      const newest = Math.max(
        ...inWindow.map((a) => parseInstant(a.publishedAt) ?? 0),
      );
      return {
        id: s.id,
        outlets: reportingOutletIds(inWindow).size,
        newest,
        founding: foundingInstant(s) ?? 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}

/** Rolling per-Statistic accumulator, keyed by label. */
const stats = new Map<
  string,
  {
    lengths: number[];
    cappedLengths: number[];
    top1Changes: number;
    steps: number;
    top3Runs: number[]; // longest top-3 residence per Story, in hours
    churn: number[];
    newAtGap: number[];
    overlapTop: number[];
    overlapNouveau: number[];
    distinctTop: Set<string>;
  }
>();
const stat = (label: string) => {
  let s = stats.get(label);
  if (s == null) {
    s = {
      lengths: [],
      cappedLengths: [],
      top1Changes: 0,
      steps: 0,
      top3Runs: [],
      churn: [],
      newAtGap: [],
      overlapTop: [],
      overlapNouveau: [],
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

let previous: Map<string, string[]> | undefined;
// The per-checkpoint rankings, for the 10 h-gap measure.
const byCheckpoint = new Map<number, Map<string, string[]>>();
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
  const feeds = new Map(variants.map((v) => [v.label, v.rank(t)]));
  byCheckpoint.set(t, feeds);
  for (const { label, capped } of variants) {
    const s = stat(label);
    const ids = feeds.get(label)!;
    const top = ids.slice(0, TOP);
    s.lengths.push(ids.length);
    s.cappedLengths.push(capped ? top.length : Number.NaN);
    s.distinctTop = new Set([...s.distinctTop, ...top]);
    if (previous != null) {
      s.steps++;
      const prevIds = previous.get(label)!;
      if (prevIds[0] !== ids[0]) s.top1Changes++;
      const prevTop = new Set(prevIds.slice(0, TOP));
      const churn = top.filter((id) => !prevTop.has(id)).length;
      s.churn.push((churn / TOP) * 100);
    }
    const atGap = byCheckpoint.get(t - GAP)?.get(label);
    if (atGap != null) {
      const before = new Set(atGap.slice(0, TOP));
      s.newAtGap.push(top.filter((id) => !before.has(id)).length);
    }
    bump(label, ids, 1);
    bump(label, ids, 2);
    bump(label, ids, 3);
  }
  // Each variant's overlap with the two anchor orders (top-25).
  const topTop = feeds.get(TOP_LABEL)!.slice(0, TOP);
  const nouveauAll = new Set(feeds.get(NOUVEAU_LABEL)!);
  for (const { label } of variants) {
    if (label === TOP_LABEL || label === NOUVEAU_LABEL) continue;
    const s = stat(label);
    const top = feeds.get(label)!.slice(0, TOP);
    s.overlapTop.push(top.filter((id) => topTop.includes(id)).length);
    s.overlapNouveau.push(top.filter((id) => nouveauAll.has(id)).length);
  }
  previous = feeds;
}

// Cut the top-3 run counters into longest-residence-per-Story lists.
for (const [label, runs] of currentRuns) {
  stat(label).top3Runs = [...runs.values()];
}

const fmt = (xs: number[]) => median(xs).toFixed(1);
const fmtOpt = (xs: number[]) =>
  xs.length === 0 ? '—' : median(xs).toFixed(1);
console.log(
  `${checkpoints.length} hourly checkpoints over ${new Date(first).toISOString().slice(0, 10)} → ${new Date(last).toISOString().slice(0, 10)}; ` +
    `cap = ${RANKED_CAP}, visit gap = ${GAP / HOUR} h, ★ = the shipped production key\n`,
);
console.log(
  '                      len(med)  len@cap  top1chg%  top3res med/max(h)  churn@25%(1h)  new@10h/25  ov.top@25  ov.nouveau@25  distinct@25',
);
for (const { label } of variants) {
  const s = stats.get(label)!;
  const top3 = `${median(s.top3Runs)} / ${Math.max(...s.top3Runs, 0)}`;
  const lenAtCap = Number.isNaN(median(s.cappedLengths))
    ? '—'
    : median(s.cappedLengths).toFixed(0);
  console.log(
    `${label.padEnd(22)}${fmt(s.lengths).padStart(9)}${lenAtCap.padStart(9)}${((s.top1Changes / Math.max(s.steps, 1)) * 100).toFixed(0).padStart(10)}${top3.padStart(17)}${fmt(s.churn).padStart(15)}${fmt(s.newAtGap).padStart(12)}${fmtOpt(s.overlapTop).padStart(11)}${fmtOpt(s.overlapNouveau).padStart(15)}${s.distinctTop.size.toString().padStart(13)}`,
  );
}

// A taste of the shipped key: last day's top 8 at two hours — outlets,
// silence, founding age (the two clocks side by side).
const lastDay = new Date(last);
for (const hour of [8, 20]) {
  const t = Date.UTC(
    lastDay.getUTCFullYear(),
    lastDay.getUTCMonth(),
    lastDay.getUTCDate(),
    hour,
  );
  if (t >= last) continue;
  const ids = byCheckpoint.get(t)?.get(PROD_LABEL);
  if (ids == null) continue;
  const now = new Date(t);
  console.log(
    `\n${PROD_LABEL} at ${new Date(t).toISOString().slice(11, 16)} UTC`,
  );
  for (const id of ids.slice(0, 8)) {
    const s = stories.find((x) => x.id === id)!;
    const inWindow = articlesInWindow(s.articles, DAY_WINDOW_MS, now);
    const outlets = reportingOutletIds(inWindow).size;
    const newest = Math.max(
      ...inWindow.map((a) => parseInstant(a.publishedAt) ?? 0),
    );
    const founding = foundingInstant(s) ?? t;
    console.log(
      `  ${outlets} outlets, silent ${((t - newest) / HOUR).toFixed(1)}h, founded ${((t - founding) / HOUR).toFixed(1)}h ago — ${s.title}`,
    );
  }
}
