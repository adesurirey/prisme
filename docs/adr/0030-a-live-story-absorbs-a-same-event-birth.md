# A live Story absorbs a same-event birth

Date: 2026-10-24 · Extends ADR-0015 (birth minimum) and ADR-0018 (fact-matching); amends the seed guard of issue #36

## Context

The seed guard (#36) Membership-checked only a proposed new Story's **seed** — its newest Article — against the **two most headline-similar** live Stories. On 2026-10-24, 05:01Z, both layers of that narrowing failed at once (issue #140):

- The Grouping model proposed a new Story for the first day-of coverage of the manifestations — a bunch of four Articles whose fact («un dispositif de sécurité massif déployé») was the direct continuation of the live Story «Laurent Nuñez mobilise 70 000 forces de l'ordre» (born 2026-10-23, window open until 10:01Z). The twin was born, absorbed 26 liveblogs, and its retitle passes minted a paraphrase of the survivor's title — two adjacent edition slots, one fact, two orphan Topics. Merged by hand in `a3546360`.
- Replay of the exact `tokens()`/`overlap()` candidate rule against the live set at the birth instant: the survivor ranked **4th of 12** qualifying candidates (0.231), behind three same-subject different-fact Stories of the same news cycle (0.357, 0.333, 0.250). The top-2 cap spent both checks on near-misses the checker correctly refused. The survivor was never asked — there was no «defensible refusal» of the seed; the seed's check never targeted the twin at all.
- Checking more members does not fix it: per-member top-2 ranks the survivor 4th/4th/6th (seed/courrier/rfi), and the union of the members' top-2s excludes it — the same three crowders win every member's list. **On a hot news cycle, same-subject different-fact Stories reliably outscore the same-fact twin**: the courrier headline restating the survivor's fact shares exactly one content token («manifestations») — the match is semantic, not lexical. No top-k lexical selection can carry the twin; the prefilter can only bound *unrelated* Stories away.
- The seed-level question was also wrong even when it runs: a legitimately narrow seed (the métro-closures Article) can be correctly refused on its own while the bunch it anchors is the live Story's chain.

The domain rule was already written (GLOSSARY: a Story is «a precise news event, or the directly connected chain of developments on one»; an Episode succeeds when «the Ingestion window closed, or the new development is a distinct fact»): while a Story is live, same-event chain coverage joins her. The Oct-24 birth was a domain violation the guard should have prevented — this ADR makes the guard able to.

## Decision

- **Candidates are unbounded**: a proposed new Story's whole claimed bunch is checked against **every** live Story sharing at least one content token with any bunch headline (`canJoin`-filtered on the seed). `MAX_SEED_CANDIDATES` is deleted; overlap only orders the asking and keeps unrelated Stories away. The Membership model decides.
- **The question is bunch-level belongs**: one check per candidate, `absorbs(story, bunch)` — the ADR-0018 fact/chain judgement with a two-sided payload (the candidate's digest, candidate-relative like `memberDigest`, vs the bunch's headlines). Not `sameSubject`: a genuinely distinct fact may still birth in parallel while a same-event chain may not — theming a live Story would swallow legitimate Episodes.
- **A yes retargets the key** through the existing mechanics: the proposed Story is dropped, its seed joins the absorber on the bunch verdict, and every further member is checked individually against her — narrow members are refused, stay Unassigned, and retry next build (ADR-0015). The within-build earlier-seed checks of #36 are unchanged.
- **The checks are pooled** (`pool.ts`, 8 in flight): candidate checks are independent, and a birth can face dozens of qualifying Stories — archive replay measured median 11, p90 20, max 36 per birth on the healthy archive (+115–599 checks/day ≈ $0.005/day at ADR-0012 pricing; worst healthy build +220). Sequential awaits would have added minutes; a fragmentation episode (one 2026-10-06 birth faced 696 qualifying singletons) hours. The ADR-0012 warning at 2000 checks stays the pathology signal — nothing is capped.

## Considered Options

- Check every member against its own top-2 candidates (the original #140 direction): rejected — replay-proven insufficient on the very incident that motivated it (survivor rank 4/4/6; never in any top-2).
- Raise the cap to 3–4: rejected — a magic number tuned on one morning; the crowding is structural, not a constant short by one.
- Use `sameSubject` for guard checks: rejected — it would also absorb distinct-fact parallel births, which the ruling explicitly allows.
- Let the duplicate be born and reconcile after the fact: deferred — the Episode/threading side of this case is #141; prevention at birth is cheaper than healing and matches the domain rule.

## Consequences

- A live Story ingests her own event's chain even when the Grouping model proposes it as a new Story and the bunch's seed is a narrow sub-fact: the incident's outcome (three chain Articles joining, one portrait retrying) becomes the built-in behavior.
- Births cost a dozen-plus checks instead of at most two — cents per day, seconds per build pooled. The degenerate regime (fragmented archive) costs more checks but trips the ADR-0012 warning rather than degrading.
- The MembershipChecker interface gains `absorbs`; the verdict ledger records the bunch check under the seed's id, so the seed's join needs no second ask.
- The Title pass's sibling blindness (the paraphrase symptom) is deliberately left unaddressed — `5d010230` anchors retitles on the founding event; observe before adding context to the pass.
