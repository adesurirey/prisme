import type { TopicRegistry } from '@prisme/domain';
import { slugFor } from '@prisme/domain';
import type { ConfirmedTopic } from './grouping.ts';

/**
 * The Topic registry's one rule (ADR-0024): an entry is written once, when
 * its thread reaches two Episodes. This module owns everything around that
 * write — the merge of the Topics confirmed this build, the dedupe by
 * topicId, and the minting of each new Topic's public slug from its label:
 * `slugFor` over the slugs the registry already uses, so the registry's own
 * namespace never collides and never touches a Story slug. The suffix
 * source is the topicId (the founding Story's id) — immutable, so the
 * minting is deterministic no matter when a Topic is confirmed.
 */
export function mergeTopicRegistry(
  registry: TopicRegistry,
  confirmed: ConfirmedTopic[],
): { registry: TopicRegistry; added: number } {
  const known = new Set(registry.topics.map((t) => t.topicId));
  const taken = new Set(registry.topics.map((t) => t.slug));
  const topics = [...registry.topics];
  let added = 0;
  for (const entry of confirmed) {
    if (known.has(entry.topicId)) continue;
    known.add(entry.topicId);
    const slug = slugFor(entry.label, entry.topicId, taken);
    taken.add(slug);
    topics.push({ ...entry, slug });
    added++;
  }
  return { registry: { topics }, added };
}
