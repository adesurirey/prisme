import type {
  MembershipChecker,
  MembershipStoryRef,
} from './decision-model.ts';
import { isTotalFailure } from './policy.ts';

/**
 * The Membership gate: one module owning everything around the Membership
 * check (GLOSSARY) — the dedup ledger of (Article, Story) pairs and the
 * attempt/failure counters behind the total-failure rule (ADR-0005, as
 * amended). Which pairs to check stays with the caller (grouping prioritizes
 * guard seeds first, then merge pairs); the gate only records truthfully.
 * There is no per-build budget (ADR-0012): the ledger bounds every pair to
 * one check, so the number of checks is finite by construction.
 *
 * Verdicts are a tri-state. `failed` covers both a thrown check and an
 * unparseable model answer: either way the model answered nothing usable,
 * and either way it counts toward `allAttemptsFailed` while a `no` does not
 * (a refusal is a real answer; a failure is not).
 *
 * The refusal cache (issue #148): the constructor takes the prior build's
 * refusals — pair keys already refused — and a prior 'no' answers an
 * identical pair without spending a check, without counting toward
 * checks used and without counting toward the total-failure rule (a
 * cached answer is not an attempt). Only merge-question 'no's recorded
 * this build are exposed for persistence ({@link refusals}); 'yes'
 * verdicts (the Article joins — stickiness makes them moot) and 'failed'
 * verdicts (an error is not an answer) are never persisted, and birth-guard
 * verdicts never enter the set at all — a guard 'no' belongs to one bunch
 * and a larger bunch later may legitimately flip it (issue #140's class).
 */
export type MembershipVerdict = 'yes' | 'no' | 'failed';

/** The target half of a pair key `${articleId}|${target}` — the composite
 * key the gate records and the refusal cache persists (issue #148). */
export function targetOfPairKey(key: string): string {
  return key.slice(key.indexOf('|') + 1);
}

export class MembershipGate {
  readonly #checker: MembershipChecker;
  readonly #priorRefusals: ReadonlySet<string>;
  #checksUsed = 0;
  #attempts = 0;
  #failures = 0;
  #priorAnswers = 0;
  readonly #verdicts = new Map<string, MembershipVerdict>();
  readonly #askRefusals = new Set<string>();

  constructor(input: {
    checker: MembershipChecker;
    /** Prior build's merge refusals (issue #148): pair keys
     * `${articleId}|${target}`, pruned to live entries by the caller. */
    priorRefusals?: ReadonlySet<string>;
  }) {
    this.#checker = input.checker;
    this.#priorRefusals = input.priorRefusals ?? new Set();
  }

  /** Checks issued this build (spends included failures and refusals). */
  get checksUsed(): number {
    return this.#checksUsed;
  }

  /**
   * True when checks were attempted and not a single one answered — the
   * checker down, or missing while checks were pending. The caller decides
   * what to do with it (grouping fails the build); the gate only reports.
   */
  get allAttemptsFailed(): boolean {
    return isTotalFailure(this.#attempts, this.#failures);
  }

  /** The recorded verdict for a pair, or undefined when never asked. */
  verdict(articleId: string, target: string): MembershipVerdict | undefined {
    return this.#verdicts.get(`${articleId}|${target}`);
  }

  /** Pairs answered from the prior build's refusals — checks not spent
   * (issue #148). */
  get priorAnswers(): number {
    return this.#priorAnswers;
  }

  /** Merge-question 'no' verdicts recorded this build (issue #148): pair
   * keys `${articleId}|${target}`, for the caller to persist. `key:`
   * targets (checks against a proposed new Story) are included — the
   * caller filters them before persisting, owning the `key:` convention.
   * Birth-guard verdicts never appear here. */
  refusals(): ReadonlySet<string> {
    return this.#askRefusals;
  }

  /**
   * Ask the checker about one (Article, Story) pair and record the verdict.
   * Asking for an already-asked pair returns the cached verdict and issues
   * no new check; a pair refused by a prior build is answered from the
   * refusal cache the same way — no check, no attempt (issue #148).
   */
  async ask(input: {
    target: string;
    story: MembershipStoryRef;
    article: { id: string; headline: string };
    teaser: string;
    label: string;
  }): Promise<MembershipVerdict> {
    const key = `${input.article.id}|${input.target}`;
    const cached = this.#verdicts.get(key);
    if (cached != null) return cached;

    // A prior build's definitive refusal (issue #148): answered from the
    // cache — no check, no attempt, no failure, and not re-recorded (the
    // ledger entry keeps its original instant and TTL).
    if (this.#priorRefusals.has(key)) {
      this.#priorAnswers++;
      this.#verdicts.set(key, 'no');
      return 'no';
    }

    this.#checksUsed++;
    this.#attempts++;
    let verdict: MembershipVerdict;
    try {
      verdict = await this.#checker.belongs(input.story, {
        headline: input.article.headline,
        teaser: input.teaser,
      });
      if (verdict === 'failed') this.#failures++;
    } catch (reason) {
      this.#failures++;
      console.warn(
        `${input.label}: ${reason instanceof Error ? reason.message : reason}`,
      );
      verdict = 'failed';
    }
    this.#verdicts.set(key, verdict);
    if (verdict === 'no') this.#askRefusals.add(key);
    return verdict;
  }

  /**
   * Ask the birth-guard question for one (proposed bunch, candidate Story)
   * pair (ADR-0030) and record the verdict under the bunch's seed Article
   * id — so the materialization loop's seed-vs-absorber verdict is the
   * guard verdict, and every further member is checked individually
   * against the absorber by the ordinary merge pairs. Asking for an
   * already-asked pair returns the cached verdict and issues no new check.
   */
  async absorbs(input: {
    target: string;
    story: MembershipStoryRef;
    bunch: MembershipStoryRef;
    seedId: string;
    label: string;
  }): Promise<MembershipVerdict> {
    const key = `${input.seedId}|${input.target}`;
    const cached = this.#verdicts.get(key);
    if (cached != null) return cached;

    this.#checksUsed++;
    this.#attempts++;
    let verdict: MembershipVerdict;
    try {
      verdict = await this.#checker.absorbs(input.story, input.bunch);
      if (verdict === 'failed') this.#failures++;
    } catch (reason) {
      this.#failures++;
      console.warn(
        `${input.label}: ${reason instanceof Error ? reason.message : reason}`,
      );
      verdict = 'failed';
    }
    this.#verdicts.set(key, verdict);
    return verdict;
  }
}
