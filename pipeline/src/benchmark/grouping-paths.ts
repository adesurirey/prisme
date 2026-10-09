/**
 * Shared location for the grouping benchmark's recorded output
 * (.benchmark/grouping/ — gitignored, headlines and titles only, ADR-0003).
 */
export const GROUPING_DIR = new URL(
  '../../../.benchmark/grouping/',
  import.meta.url,
);
export const RESULTS_DIR = new URL('results/', GROUPING_DIR);
export const LABELS_DIR = new URL('labels/', GROUPING_DIR);
