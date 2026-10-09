import type { Section } from '@prisme/domain';
import type { MembershipChecker } from './decision-model.ts';
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
 */
export type MembershipVerdict = 'yes' | 'no' | 'failed';

export class MembershipGate {
  readonly #checker: MembershipChecker;
  #checksUsed = 0;
  #attempts = 0;
  #failures = 0;
  readonly #verdicts = new Map<string, MembershipVerdict>();

  constructor(input: { checker: MembershipChecker }) {
    this.#checker = input.checker;
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

  /**
   * Ask the checker about one (Article, Story) pair and record the verdict.
   * Asking for an already-asked pair returns the cached verdict and issues
   * no new check.
   */
  async ask(input: {
    target: string;
    story: { title: string; section?: Section };
    article: { id: string; headline: string };
    teaser: string;
    label: string;
  }): Promise<MembershipVerdict> {
    const key = `${input.article.id}|${input.target}`;
    const cached = this.#verdicts.get(key);
    if (cached != null) return cached;

    this.#checksUsed++;
    this.#attempts++;
    let verdict: MembershipVerdict;
    try {
      verdict = await this.#checker.belongs(
        { title: input.story.title, section: input.story.section },
        { headline: input.article.headline, teaser: input.teaser },
      );
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
