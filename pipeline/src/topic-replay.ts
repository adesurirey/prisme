// The topic replay (paid — calls the live Membership model): walk the data/
// archive day by day through the production topic resolution (resolveTopics),
// and print every check with its verdict, so a human can grade the
// mechanism — and compare Membership models (docs/research/
// topics-model-comparison.md). Raw transcripts land in .benchmark/topics/.
// Run: pnpm replay:topics
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Story } from '@prisme/domain';
import type {
  MembershipChecker,
  MembershipStoryRef,
} from './decision-model.js';
import {
  membershipModelFromEnv,
  membershipModelFromOpenRouter,
  OPENROUTER_MODELS,
} from './decision-model.js';
import { resolveTopics } from './grouping.js';
import { mergeTopicRegistry } from './topic-registry.js';

const dir = join(import.meta.dirname, '../../data/stories');
// The checker under test: TOPIC_CHECKER=clef-flash (default Jev) — the
// model-comparison switch of docs/research/topics-model-comparison.md.
// Clef-flash travels the same OpenRouter gateway as Jev, one key.
const membership =
  process.env.TOPIC_CHECKER === 'clef-flash'
    ? membershipModelFromOpenRouter(
        process.env.OPENROUTER_API_KEY!,
        'Clef-flash',
        OPENROUTER_MODELS.clefFlash,
      )
    : membershipModelFromEnv();
if (membership == null)
  throw new Error(
    `no membership model for TOPIC_CHECKER=${process.env.TOPIC_CHECKER ?? 'jev'} — missing OPENROUTER_API_KEY?`,
  );

/** A logging proxy over the live checker: every question and verdict goes
 * to the transcript, so raw runs stay comparable across models. A failed
 * verdict is not caught — resolveTopics throws on it, the production
 * posture. */
function loggingProxy(
  checker: MembershipChecker,
  counters: { yes: number; no: number },
  log: (line: string) => void,
): MembershipChecker {
  const ref = (r: MembershipStoryRef) =>
    `« ${r.title} » +${r.headlines.length} headline(s)`;
  return {
    label: checker.label,
    async belongs(story, article) {
      const verdict = await checker.belongs(story, article);
      log(
        `belongs ${verdict?.toUpperCase() ?? 'FAILED'}  ${ref(story)}  <- ${article.headline}`,
      );
      return verdict;
    },
    async sameSubject(episodes, birth) {
      const verdict = await checker.sameSubject(episodes, birth);
      if (verdict === 'yes') counters.yes++;
      if (verdict === 'no') counters.no++;
      log(
        `sameSubject ${verdict?.toUpperCase() ?? 'FAILED'}  ${episodes
          .map((e) => ref(e))
          .join(' | ')}  <- ${ref(birth)}`,
      );
      return verdict;
    },
  };
}

const files: Story[] = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Story)
  .sort(
    (a, b) =>
      a.storyDay.localeCompare(b.storyDay) ||
      a.createdAt.localeCompare(b.createdAt),
  );

// One archive Story is one replayed birth, walking through the production
// resolution against everything already on disk (its own day included —
// earlier build hours wrote it).
const seen: Story[] = [];
let registry = {
  topics: [] as Parameters<typeof mergeTopicRegistry>[0]['topics'],
};
const lines: string[] = [];
const counters = { yes: 0, no: 0 };
const log = (line: string) => lines.push(line);

for (const story of files) {
  const { topics: confirmedTopics } = await resolveTopics({
    births: [story],
    existing: seen,
    membership: loggingProxy(membership, counters, log),
  });
  const confirmed = confirmedTopics[0];
  if (confirmed != null) {
    const { registry: merged, added } = mergeTopicRegistry(registry, [
      confirmed,
    ]);
    registry = merged;
    if (added > 0)
      lines.push(
        `CONFIRMED « ${confirmed.label} » (${confirmed.storyDay}) via ${confirmed.topicId}`,
      );
  }
  seen.push(story);
}

// Chain sizes straight from the replayed state: how many archived Stories
// ended up carrying each topic's key.
const chains = new Map<string, number>();
for (const story of seen) {
  if (story.topicId == null) continue;
  chains.set(story.topicId, (chains.get(story.topicId) ?? 0) + 1);
}

const summary = [
  `replay: ${files.length} archived Stories, checker: ${membership.label}`,
  `checks: ${counters.yes + counters.no} (yes ${counters.yes}, no ${counters.no})`,
  `confirmed topics: ${registry.topics.length}`,
  '',
  ...lines,
  '',
  '=== registry ===',
  ...registry.topics.map(
    (t) =>
      `/sujets/${t.slug}  « ${t.label} »  — ${chains.get(t.topicId) ?? '?'} épisodes (fondé ${t.storyDay})\n    ${t.title}`,
  ),
];
const outDir = join(import.meta.dirname, '../../.benchmark/topics');
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
const outFile = join(outDir, `${membership.label}-${stamp}.txt`);
writeFileSync(outFile, summary.join('\n'));
console.log(summary.join('\n'));
console.log(`\nraw transcript: ${outFile}`);
