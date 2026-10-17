import { describe, expect, it } from 'vitest';
import {
  parseTitleResponse,
  TITLE_PASS_SCHEMA,
  titlePassPrompt,
} from './title-pass.ts';

describe('titlePassPrompt', () => {
  const input = {
    births: [
      {
        key: 'k1',
        headlines: ['Un tireur fait plusieurs victimes', 'Deuxième titre'],
        episode: { title: 'Épisode précédent', storyDay: '2026-10-16' },
      },
      { key: 'k2', headlines: ['Autre fait'] },
    ],
    updates: [
      {
        storyId: 's1',
        title: 'Titre actuel',
        headlines: ['Titre actuel', 'Ancien titre'],
      },
    ],
  };

  it('lists births with their headlines and the previous episode, updates with their history', () => {
    const prompt = titlePassPrompt(input);
    expect(prompt).toContain(
      "- [k1] (poursuit l'épisode « Épisode précédent », 2026-10-16)",
    );
    expect(prompt).toContain('  - Un tireur fait plusieurs victimes');
    expect(prompt).toContain('- [k2]');
    expect(prompt).toContain('- [s1] Titre actuel : « Titre actuel »');
    expect(prompt).toContain('  - Ancien titre');
  });

  it('omits the birth and update sections when empty', () => {
    const prompt = titlePassPrompt({ births: [], updates: [] });
    expect(prompt).not.toContain('Stories qui naissent');
    expect(prompt).not.toContain('Stories qui ont gagné');
  });

  it('pins symmetric qualification fidelity (ADR-0013)', () => {
    const prompt = titlePassPrompt(input);
    expect(prompt).toContain(
      "n'utilise aucun mot de qualification qu'aucun titre source n'emploie",
    );
    expect(prompt).toContain("n'écris pas « attentat »");
    expect(prompt).toContain(
      "n'affaiblis pas la qualification que les sources partagent",
    );
  });

  it('pins the content rule: facts from the group, structure never (ADR-0013)', () => {
    const prompt = titlePassPrompt(input);
    expect(prompt).toContain(
      'ce que plusieurs titres affirment doit apparaître dans le titre',
    );
    expect(prompt).toContain("Un titre neutre n'est pas un titre vague");
    expect(prompt).toContain('noms propres compris');
  });

  it('pins the style rule (ADR-0013)', () => {
    const prompt = titlePassPrompt(input);
    expect(prompt).toContain('- Style du titre : un acteur nommé');
    expect(prompt).toContain(
      'la neutralité porte sur la position, pas sur la forme',
    );
  });

  it('pins the episode rule (ADR-0023)', () => {
    const prompt = titlePassPrompt(input);
    expect(prompt).toContain(
      "le lecteur qui a lu l'épisode précédent doit comprendre, depuis le titre seul, ce qui a changé",
    );
  });

  it('pins the retitle guard: only gaining Stories, only a better title (ADR-0023)', () => {
    const prompt = titlePassPrompt(input);
    expect(prompt).toContain(
      'uniquement pour les stories qui ont gagné des articles',
    );
    expect(prompt).toContain('uniquement si un meilleur titre existe');
  });

  it('has no length rule at all (ADR-0013 amendment: absent guidelines, the model infers)', () => {
    const prompt = titlePassPrompt(input);
    expect(prompt).not.toContain('110 caractères');
    expect(prompt).not.toContain('limite de longueur');
    expect(prompt).not.toContain('caractères');
  });

  it('schema requires both arrays', () => {
    expect(TITLE_PASS_SCHEMA.required).toEqual(['titles', 'titleUpdates']);
  });
});

describe('parseTitleResponse', () => {
  it('parses a well-formed answer', () => {
    const parsed = parseTitleResponse(
      JSON.stringify({
        titles: [
          { key: 'k1', title: 'Le Sénat adopte le budget' },
          { key: 'k2', title: 'Une fusillade fait quatre morts' },
        ],
        titleUpdates: [{ storyId: 's1', title: 'Meilleur titre' }],
      }),
    );
    expect(parsed!.titles).toEqual([
      { key: 'k1', title: 'Le Sénat adopte le budget' },
      { key: 'k2', title: 'Une fusillade fait quatre morts' },
    ]);
    expect(parsed!.titleUpdates).toEqual([
      { storyId: 's1', title: 'Meilleur titre' },
    ]);
  });

  it('returns null for non-JSON text', () => {
    expect(parseTitleResponse('not json at all')).toBeNull();
  });

  it('returns null when a required array is missing', () => {
    expect(parseTitleResponse(JSON.stringify({ titles: [] }))).toBeNull();
    expect(parseTitleResponse(JSON.stringify({ titleUpdates: [] }))).toBeNull();
  });

  it('drops entries without a key or a non-empty title', () => {
    const parsed = parseTitleResponse(
      JSON.stringify({
        titles: [
          { key: 'k1', title: 'Titre' },
          { key: 'k2' },
          { key: '', title: 'Titre vide' },
          { title: 'Sans clé' },
          { key: 'k3', title: '   ' },
        ],
        titleUpdates: [
          { storyId: 's1', title: 'Bon titre' },
          { storyId: 's2' },
          { title: 'Sans story' },
        ],
      }),
    );
    expect(parsed!.titles).toEqual([{ key: 'k1', title: 'Titre' }]);
    expect(parsed!.titleUpdates).toEqual([
      { storyId: 's1', title: 'Bon titre' },
    ]);
  });
});
