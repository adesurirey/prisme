# Stories are born only from two or more Articles

> **Amended by ADR-0027** (2026-10-21): the minimum is now two Articles
> **and two distinct Outlets** — an Opinion piece counts toward the birth
> (ADR-0011). The model never sees Outlet ids, so the rule is enforced at
> the drop pass like the two-Article minimum; everything below otherwise
> stands.

Date: 2026-10-11 · Amends ADR-0005 (creation side); works with ADR-0012

## Context

A Story is created when the Grouping model proposes a `newStory` or when an
Article found no acceptable Story (`split()`). In both paths the Story is
born with a single Article — usually one outlet's headline, which becomes
the Story title verbatim. Two failure modes follow:

- **The outlet-styled title is permanent.** The slug is fixed at creation
  and the title rarely gets a `titleUpdate` (the instruction is optional),
  so a Story that grows from a singleton keeps one outlet's own
  formulation as its title — against the title style of ADR-0013, and
  giving one outlet undue credit. Observed: the
  `emeutes-lyceennes-ceux-qui-cassent…` Story, whose title was a single
  outlet's headline.
- **Singletons corrupt the archive under degradation.** The 2026-10-08
  builds showed one 429 creating 456 permanent one-Article Stories; the
  pre-#36 guard era produced 96–97% singleton archives (ADR-0012).

The product insight underneath the fix: an event covered by a single
outlet is exactly the case where the Edition should *not* speak with that
outlet's voice. Coverage by two or more outlets is what makes an event
Edition-worthy, and it is also what makes a neutral title derivable — the
Grouping model synthesizes a title from the group's headlines, not from
one outlet's.

## Decision

**A Story is created only with at least two Articles.** Enforced
structurally, not by prompt:

1. An Article that matches nothing, whose Membership check is refused or
   isolated-failed, or whose target Story is unknown or frozen stays
   **unassigned** (an "orphan"): it is written to no Story file. Because
   membership exists only by being inside a Story, the orphan is fresh
   again on the next build and gets another chance at a Story — the
   retry-ability the old split path destroyed (membership was sticky).
   The same ceiling as before applies: the orphan re-enters only while
   under 24 hours old and still present in its feed (LIVE_WINDOW_MS,
   ADR-0009 — unchanged). With singletons the ceiling was identical (a
   singleton freezes at the same 24h mark and is closed to merges), so
   nothing is lost against the old behavior.
2. A proposed `newStory` reduced to fewer than two joined members (its
   seed alone, after refusals) is dropped before it can publish; its
   members are orphaned. The seed guard (issue #36) keeps its role: a
   proposed singleton absorbed by the guard into an *existing* Story
   still merges there — that grows an existing Story, it does not birth
   one.
3. **Invariant tripwire**: after the drop pass, the build fails if any
   Story it created this build has fewer than two Articles. Defensive —
   the drop pass makes it unreachable — so that a future refactor cannot
   silently reintroduce singleton births (the class of corruption no
   check caught in 2026-10).
4. The Grouping prompt is aligned: an unmatched Article is left
   unassigned, never given its own Story; a new Story requires at least
   two Articles and a title synthesized from the group's headlines
   (ADR-0013 style), which the two-member minimum now guarantees.

The 24h window, the Membership gate's one-check-per-pair ledger
(ADR-0012), and the frozen-Story permanence rules (ADR-0005) are
unchanged.

## Consequences

- **The Edition only covers multi-outlet events.** A single-outlet
  exclusive — however newsworthy — never enters the Edition unless a
  second outlet picks it up within the window. Accepted as a permanent
  product property, coherent with "Leaning belongs to Outlets, the
  Edition shows consensus"; it also removes the case where one outlet's
  headline is the only voice an event has.
- **Stories are born with a neutral, synthesized title by construction.**
  The title is always derived from at least two headlines; the failure
  mode that motivated this ADR cannot recur.
- **The singleton-corruption saga retires**: there is no such thing as a
  new singleton to corrupt with. The seed guard's within-build
  twin-absorption becomes even more valuable — two same-event Articles
  proposed as separate one-member Stories are folded into one
  two-member Story instead of both being dropped.
- **The archive restarts clean.** The existing archive (built under the
  old policy, including Story pages with outlet-styled titles) must be
  wiped and rebuilt from scratch with `pnpm edition:wipe` before the next
  build ships this policy — no grandfathering; git history remains the
  record of the old archive. Until that wipe, existing one-Article Story
  files are grandfathered in place: the minimum governs births, not what
  the old policy already wrote.
- **Orphans cost recurring grouping tokens** (re-presented each build
  until grouped or expired) — accepted; the cost is bounded by the same
  24h window and is negligible against the Grouping call itself.
- On slow news days the live pool is thinner; ranking (EDITION_SIZE = 20)
  may fill the Edition from a smaller candidate set.
