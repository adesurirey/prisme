/**
 * The ADR-0027 growth gate, shared by the two watermark-gated AI passes —
 * Summaries (summarize.ts) and retitles (grouping.ts): a pass re-fires on a
 * Story only when its Article count grew at least 25 % since that pass's
 * last run, so a multi-day Story is not re-synthesized hourly for +1
 * Article. A Story the pass has never seen passes (births always do);
 * staleness of at most 25 % of the Articles is the accepted cost (ADR-0027).
 */
export function grewAtLeast(seen: number | undefined, count: number): boolean {
  if (seen == null) return true;
  return (count - seen) / seen >= 0.25;
}
