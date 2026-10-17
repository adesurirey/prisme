import { describe, expect, it } from 'vitest';
import type { ConfirmedTopic } from './grouping.ts';
import { mergeTopicRegistry } from './topic-registry.ts';

function confirmed(overrides: Partial<ConfirmedTopic> = {}): ConfirmedTopic {
  return {
    topicId: 'un-adolescent-ouvre-le-feu-dans-un-college-a-aubagne',
    title: 'Un adolescent ouvre le feu dans un collège à Aubagne',
    label: 'Collège Aubagne',
    storyDay: '2026-10-05',
    createdAt: '2026-10-05T09:00:00Z',
    ...overrides,
  };
}

describe('mergeTopicRegistry (ADR-0024)', () => {
  it('mints the public slug from the label, in the registry namespace', () => {
    const { registry, added } = mergeTopicRegistry({ topics: [] }, [
      confirmed({ label: 'Collège Aubagne' }),
    ]);
    expect(added).toBe(1);
    expect(registry.topics[0]!.slug).toBe('college-aubagne');
  });

  it('a label already slugged by another Topic gets a suffix from its topicId', () => {
    const { registry: first } = mergeTopicRegistry({ topics: [] }, [
      confirmed({ label: 'Tuerie Oregon' }),
    ]);
    const { registry: second, added } = mergeTopicRegistry(first, [
      confirmed({
        topicId: 'une-fusillade-dans-une-ecole-primaire-fait-quatre-mo',
        label: 'Tuerie Oregon',
      }),
    ]);
    expect(added).toBe(1);
    expect(second.topics[1]!.slug).toBe('tuerie-oregon-une-fu');
  });

  it('an already-listed topicId adds nothing (written once, ever)', () => {
    const first = mergeTopicRegistry({ topics: [] }, [confirmed()]);
    const second = mergeTopicRegistry(first.registry, [
      confirmed({ label: 'Autre étiquette' }),
    ]);
    expect(second.added).toBe(0);
    expect(second.registry.topics).toHaveLength(1);
    // The label, minted once, never changes — even on a new confirmation.
    expect(second.registry.topics[0]!.label).toBe('Collège Aubagne');
  });
});
