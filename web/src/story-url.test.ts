import { describe, expect, it } from 'vitest';
import { storyUrl } from './story-url';

describe('storyUrl', () => {
  it('builds the canonical /<storyDay>/<slug>/ URL', () => {
    expect(storyUrl({ storyDay: '2026-10-12', slug: 'un-sujet' })).toBe(
      '/2026-10-12/un-sujet/',
    );
  });
});
