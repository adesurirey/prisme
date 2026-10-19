import type { Story } from '@prisme/domain';
import { rankStories } from '@prisme/domain';
import { isLive } from './liveness.ts';
import { parisDayKey } from './paris-day.ts';

export { rankStories };

/**
 * The dated Edition assembly (ADR-0026): every Story whose Ingestion window
 * is open — `[founding, founding + 24h]` from its founding Article — ranked
 * by the ADR-0009 key, uncapped, with a sharp exit at the window close. The
 * pre-0026 pool was day-based (today's Stories, and yesterday's until 06:00
 * Paris, ADR-0022); the window rule lets an evening Story keep collecting
 * its overnight cycle in one Story without ever sitting on la Une beyond 24
 * hours of age. No backfill: closed Stories are the archive pages' business.
 * A Story born right after midnight still ranks in (issue #75: it acquires
 * `everInEdition` and survives its freezing, as a deletion-rule guardrail).
 * Stories from a future day are dropped (defensive; the Grouping model
 * cannot create them — the guard protects only against inconsistent
 * hand-edited files, the window rule already excludes a future-dated
 * founding).
 */
export function assembleEdition(stories: Story[], now: Date): Story[] {
  const today = parisDayKey(now.toISOString());
  const open = stories.filter((s) => s.storyDay <= today && isLive(s, now));
  return rankStories(open);
}
