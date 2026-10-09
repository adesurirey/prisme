import type { Section } from '@prisme/domain';
import type { MembershipChecker } from './decision-model.ts';

/**
 * The Membership gate: one module owning everything around the Membership
 * check (GLOSSARY) — the shared per-build budget, the dedup ledger of
 * (Article, Story) pairs, and the attempt/failure counters behind the
 * total-failure rule (ADR-0005, as amended). Which pairs to check stays with
 * the caller (grouping prioritizes guard seeds first, then merge pairs);
 * the gate only enforces budget and records truthfully.
 *
 * Verdicts are a tri-state. `failed` covers both a thrown check and an
 * unparseable model answer: either way the model answered nothing usable,
 * and either way it counts toward `allAttemptsFailed` while a `no` does not
 * (a refusal is a real answer; a failure is not).
 */
export type MembershipVerdict = 'yes' | 'no' | 'failed';

export class MembershipGate {
  readonly #checker: MembershipChecker;
  readonly #budget: number;
  #checksUsed = 0;
  #attempts = 0;
  #failures = 0;
  readonly #verdicts = new Map<string, MembershipVerdict>();

  constructor(input: { checker: MembershipChecker; budget: number }) {
    this.#checker = input.checker;
    this.#budget = input.budget;
  }

  /** Checks still available this build. */
  get budgetLeft(): number {
    return this.#budget - this.#checksUsed;
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
    return this.#attempts > 0 && this.#failures === this.#attempts;
  }

  /** The recorded verdict for a pair, or undefined when never asked. */
  verdict(articleId: string, target: string): MembershipVerdict | undefined {
    return this.#verdicts.get(`${articleId}|${target}`);
  }

  /**
   * Ask the checker about one (Article, Story) pair and record the verdict.
   * Asking for an already-asked pair returns the cached verdict and issues
   * no new check. Throws when the budget is exhausted — callers slice their
   * pair lists with {@link budgetLeft} first.
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
    if (this.budgetLeft <= 0)
      throw new Error(
        `Membership check budget exhausted (${this.#budget} spent) — ${input.label}`,
      );

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
