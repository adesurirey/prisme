import type { DecisionModel, MembershipChecker } from './decision-model.ts';
import {
  membershipModelFromEnv,
  winnerModelFromEnv,
} from './decision-model.ts';
import type { GroupingModel } from './gemini.ts';
import { groupingModelFromEnv } from './gemini.ts';
import type { SummaryModel } from './summarize.ts';
import { summariesModelFromEnv } from './summarize.ts';

/**
 * The fail-vs-degrade policy (ADR-0005, as amended in issue #40), in one
 * table. To answer "what happens when a model is unavailable", read this
 * file — nowhere else.
 *
 * - GEMINI_API_KEY missing → the build fails up front, before anything is
 *   collected or written: the old degrade-to-singletons path corrupted the
 *   archive permanently (membership is sticky, singletons never re-merge).
 *   Summaries share the key, so they are moot in this case.
 * - OPENROUTER_API_KEY missing → the Decision model degrades (Articles stay
 *   unclassified and are retried next build — a safe, retried degrade),
 *   while the Membership check fails when checks are pending: splitting a
 *   pending check would create the same one-Article Stories. That is why
 *   the fail is conditional, enforced by {@link missingMembershipChecker}
 *   at the gate rather than thrown here.
 * - Mid-build, when not a single call of a consumer answered, the build
 *   fails too ({@link isTotalFailure}): a silent total failure looks exactly
 *   like a slow day and is never retried.
 */

/** The declared always-failing Membership checker: every attempt throws. */
export function missingMembershipChecker(): MembershipChecker {
  return {
    label: 'none',
    async belongs() {
      throw new Error('Membership checker unavailable');
    },
  };
}

/** True when calls were attempted and not a single one answered. */
export function isTotalFailure(attempts: number, failures: number): boolean {
  return attempts > 0 && failures === attempts;
}

/**
 * The per-build Membership budget: PRISME_MAX_CHECKS=all lifts it (an
 * experiment lever), a number overrides the default (MAX_MEMBERSHIP_CHECKS),
 * junk is ignored.
 */
function maxChecksFromEnv(raw: string | undefined): number | undefined {
  if (raw == null) return undefined;
  if (raw === 'all') return Infinity;
  return Number.parseInt(raw, 10) || undefined;
}

export interface ModelPolicy {
  /** Live: a missing key already failed the build in resolveModels. */
  grouping: GroupingModel;
  /**
   * Live or the declared fail-when-pending adapter — never null: the gate
   * turns every attempt of the adapter into a failure, so the build fails
   * exactly when checks were pending.
   */
  membership: MembershipChecker;
  /** Degrades to null (Articles kept unclassified) when the key is absent. */
  decision: { model: DecisionModel | null; note?: string };
  /** Live: shares GEMINI_API_KEY with Grouping, which already failed the build. */
  summaries: SummaryModel;
  maxChecks: number | undefined;
}

/**
 * Resolve every model consumer from the environment. Total: when it
 * returns, fail consumers are guaranteed live and only degrade consumers
 * can be null. Throws up front for a missing GEMINI_API_KEY — before
 * anything is collected or written.
 */
export function resolveModels(): ModelPolicy {
  if (!process.env.GEMINI_API_KEY)
    throw new Error(
      'GEMINI_API_KEY is not set — Grouping would degrade to one-Article Stories; failing the build (ADR-0005, as amended).',
    );
  const grouping = groupingModelFromEnv()!;
  const summaries = summariesModelFromEnv()!;
  const openrouter = process.env.OPENROUTER_API_KEY;
  const decision = openrouter
    ? { model: winnerModelFromEnv()! }
    : {
        model: null,
        note: 'OPENROUTER_API_KEY not set — Articles are kept unclassified (no kind).',
      };
  const membership = openrouter
    ? membershipModelFromEnv()!
    : missingMembershipChecker();
  return {
    grouping,
    membership,
    decision,
    summaries,
    maxChecks: maxChecksFromEnv(process.env.PRISME_MAX_CHECKS),
  };
}
