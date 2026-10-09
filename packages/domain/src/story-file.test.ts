import { describe, expect, it } from 'vitest';
import type { Story } from './index.ts';
import {
  parseStoryFile,
  reconcileSlugs,
  slugFor,
  slugify,
} from './story-file.ts';

describe('parseStoryFile', () => {
  const valid = {
    id: 'abc123',
    slug: 'un-titre',
    title: 'Un titre',
    createdAt: '2026-10-09T10:00:00Z',
    articles: [{ id: 'a1', headline: 'A' }],
  };

  it('accepts a well-formed Story file', () => {
    expect(parseStoryFile(valid, 'un-titre.json')).toEqual(valid);
  });

  it('rejects a non-object', () => {
    expect(parseStoryFile(null, 'x.json')).toBeNull();
    expect(parseStoryFile('nope', 'x.json')).toBeNull();
    expect(parseStoryFile([valid], 'x.json')).toBeNull();
  });

  it('rejects when id, slug or title is not a string, or articles not an array', () => {
    for (const broken of [
      { ...valid, id: 1 },
      { ...valid, slug: undefined },
      { ...valid, title: null },
      { ...valid, articles: 'nope' },
    ]) {
      expect(parseStoryFile(broken, 'x.json')).toBeNull();
    }
  });
});

describe('slugify', () => {
  it('strips accents, lowercases, keeps alphanumerics, truncates to 64', () => {
    expect(slugify('Déjà-vu à Épinay !')).toBe('deja-vu-a-epinay');
    expect(slugify('X'.repeat(70))).toHaveLength(64);
    expect(slugify('---')).toBe('');
  });
});

describe('slugFor', () => {
  it('returns the bare slug when free', () => {
    expect(slugFor('Un titre', 'id123', new Set())).toBe('un-titre');
  });

  it('falls back to a Story-id suffix from the own id, extending the slice', () => {
    const taken = new Set([
      'un-titre',
      'un-titre-id1234',
      'un-titre-id123456',
      'un-titre-id1234567890',
    ]);
    expect(slugFor('Un titre', 'id123456789012', taken)).toBe(
      'un-titre-id123456789012',
    );
  });

  it('falls back to bare when the title slugifies to nothing', () => {
    expect(slugFor('???', 'abc', new Set())).toBe('sujet');
  });
});

describe('reconcileSlugs', () => {
  it('gives the bare slug to the smallest Story id among the created Stories', () => {
    const a: Story = {
      id: 'b',
      slug: 'sujet',
      title: 'Sujet',
      createdAt: '',
      articles: [],
    };
    const b: Story = {
      id: 'a',
      slug: 'sujet-a',
      title: 'Sujet',
      createdAt: '',
      articles: [],
    };
    const taken = new Set(['sujet', 'sujet-a']);
    reconcileSlugs([a, b], taken);
    expect(b.slug).toBe('sujet');
    expect(a.slug).toBe('sujet-b');
  });

  it('leaves the group alone when no created Story holds the bare slug', () => {
    const a: Story = {
      id: 'a',
      slug: 'sujet-a',
      title: 'Sujet',
      createdAt: '',
      articles: [],
    };
    const b: Story = {
      id: 'b',
      slug: 'sujet-b',
      title: 'Sujet',
      createdAt: '',
      articles: [],
    };
    const taken = new Set(['sujet-a', 'sujet-b']);
    reconcileSlugs([a, b], taken);
    expect(a.slug).toBe('sujet-a');
    expect(b.slug).toBe('sujet-b');
  });

  it('does nothing when the bare holder already has the smallest id', () => {
    const a: Story = {
      id: 'a',
      slug: 'sujet',
      title: 'Sujet',
      createdAt: '',
      articles: [],
    };
    const b: Story = {
      id: 'b',
      slug: 'sujet-b',
      title: 'Sujet',
      createdAt: '',
      articles: [],
    };
    const taken = new Set(['sujet', 'sujet-b']);
    reconcileSlugs([a, b], taken);
    expect(a.slug).toBe('sujet');
    expect(b.slug).toBe('sujet-b');
  });
});
