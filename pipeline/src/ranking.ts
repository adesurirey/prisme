import { rankStories } from '@prisme/domain';

export { rankStories };

/**
 * The Edition ranking (issue #37, ADR-0009 as amended by ADR-0011) lives in
 * @prisme/domain — the archive pages (issue #99, ADR-0017) reuse the same
 * key per Story day. The Edition keeps the top EDITION_SIZE Stories.
 */
export const EDITION_SIZE = 20;
