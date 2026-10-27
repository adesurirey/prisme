import { describe, expect, it } from 'vitest';
import {
  ABSORB_QUESTION,
  absorbPayload,
  MEMBERSHIP_QUESTION,
  membershipPayload,
  parseMembershipAnswer,
  TOPIC_QUESTION,
  topicPayload,
} from './decision-model.ts';

describe('membershipPayload (ADR-0018)', () => {
  it('embeds the member headlines between the Story and the Article', () => {
    const payload = membershipPayload(
      {
        title: 'Le syndicat Alliance dépose plainte',
        section: 'misc',
        headlines: ['Un policier mis en examen', '36 enquêtes IGPN'],
      },
      {
        headline: 'Le syndicat Alliance dépose plainte contre l’État',
        teaser: 'Le chapô',
      },
    );
    expect(payload.headline).toBe(
      'Story : Le syndicat Alliance dépose plainte (Faits divers)\n' +
        'Articles déjà joints :\n' +
        '- Un policier mis en examen\n' +
        '- 36 enquêtes IGPN\n' +
        'Article : Le syndicat Alliance dépose plainte contre l’État',
    );
    expect(payload.teaser).toBe('\nLe chapô');
  });

  it('drops a member headline identical to the anchor title', () => {
    const payload = membershipPayload(
      { title: 'Titre un', headlines: ['Titre un', 'Titre deux'] },
      { headline: 'Candidat', teaser: '' },
    );
    expect(payload.headline).toBe(
      'Story : Titre un\nArticles déjà joints :\n- Titre deux\nArticle : Candidat',
    );
  });

  it('keeps the plain shape when the digest reduces to nothing: the Story line and the Article line', () => {
    // A one-member proposed Story: the digest is the seed's own headline,
    // which the anchor-title drop removes — the payload stays two lines.
    const payload = membershipPayload(
      { title: 'Titre un', headlines: ['Titre un'] },
      { headline: 'Candidat', teaser: 'chapô' },
    );
    expect(payload.headline).toBe('Story : Titre un\nArticle : Candidat');
    expect(payload.teaser).toBe('\nchapô');
  });

  it('labels the founding anchor right under the Story title (the 2026-10-27 Trappes drift fix)', () => {
    const payload = membershipPayload(
      {
        title: 'Attentat à Trappes : la garde à vue reprend',
        section: 'misc',
        founding: {
          headline: 'Un homme tire dans la rue à Trappes',
          day: '2026-10-23',
        },
        headlines: ['La garde à vue a repris', 'Le procureur s’exprime'],
      },
      { headline: 'La garde à vue de Kévin T. a repris', teaser: '' },
    );
    expect(payload.headline).toBe(
      'Story : Attentat à Trappes : la garde à vue reprend (Faits divers)\n' +
        'Événement fondateur (2026-10-23) : « Un homme tire dans la rue à Trappes »\n' +
        'Articles déjà joints :\n' +
        '- La garde à vue a repris\n' +
        '- Le procureur s’exprime\n' +
        'Article : La garde à vue de Kévin T. a repris',
    );
  });

  it('the question matches facts, not topics (ADR-0018)', () => {
    expect(MEMBERSHIP_QUESTION.belongs.instructions).toContain(
      'le même fait que cette story',
    );
    expect(MEMBERSHIP_QUESTION.belongs.instructions).not.toContain(
      'ou le même sujet',
    );
    expect(MEMBERSHIP_QUESTION.belongs.instructions).not.toContain(
      'uniquement à partir du titre',
    );
    expect(MEMBERSHIP_QUESTION.belongs.criteria.yes).toContain(
      "n'aurait pas d'existence propre sans lui",
    );
    expect(MEMBERSHIP_QUESTION.belongs.criteria.yes).not.toContain(
      'développement direct',
    );
    expect(MEMBERSHIP_QUESTION.belongs.criteria.no).toContain(
      'même thème général',
    );
    expect(MEMBERSHIP_QUESTION.belongs.criteria.no).toContain(
      'propre cycle de titres',
    );
  });
});

describe('parseMembershipAnswer', () => {
  it('answers yes when the Article belongs to the Story', () => {
    expect(
      parseMembershipAnswer({ belongs: { type: 'choice', choice: 'yes' } }),
    ).toBe(true);
  });

  it('answers no when it does not', () => {
    expect(
      parseMembershipAnswer({ belongs: { type: 'choice', choice: 'no' } }),
    ).toBe(false);
  });

  it('returns null for a missing or out-of-list answer', () => {
    expect(parseMembershipAnswer({})).toBeNull();
    expect(parseMembershipAnswer({ belongs: { choice: 'maybe' } })).toBeNull();
    expect(parseMembershipAnswer(null)).toBeNull();
    expect(parseMembershipAnswer('nonsense')).toBeNull();
  });

  it('both questions tell the model to judge from the founding anchor (the 2026-10-27 drift fix)', () => {
    expect(MEMBERSHIP_QUESTION.belongs.instructions).toContain(
      "l'événement fondateur de la story",
    );
    expect(ABSORB_QUESTION.belongs.instructions).toContain(
      "l'événement fondateur de la story existante",
    );
  });
});

describe('absorbPayload (ADR-0030)', () => {
  it('lists the live Story with her founding anchor, then the proposed bunch', () => {
    const payload = absorbPayload(
      {
        title: 'Laurent Nuñez mobilise 70 000 forces de l’ordre',
        founding: {
          headline: 'Nuñez annonce une mobilisation massive',
          day: '2026-10-23',
        },
        headlines: ['Dispositif renforcé samedi soir'],
      },
      {
        title: 'Le métro ferme plusieurs stations',
        headlines: ['Le métro ferme 12 stations', 'Stores barricadés'],
      },
    );
    expect(payload.headline).toBe(
      'Story existante : Laurent Nuñez mobilise 70 000 forces de l’ordre\n' +
        'Événement fondateur (2026-10-23) : « Nuñez annonce une mobilisation massive »\n' +
        'Articles déjà joints :\n' +
        '- Dispositif renforcé samedi soir\n' +
        'Story proposée :\n' +
        '- Le métro ferme 12 stations\n' +
        '- Stores barricadés',
    );
    expect(payload.teaser).toBe('');
  });
});

describe('topicPayload (ADR-0024)', () => {
  it('lists the whole thread oldest first, then the birth', () => {
    const payload = topicPayload(
      [
        {
          title: 'Des frappes russes touchent une centrale électrique à Kiev',
          headlines: ['Premier bilan', 'Nouvelles frappes'],
        },
        {
          title: 'Donald Trump juge honteuse la reprise des frappes',
          headlines: ['La Maison-Blanche réagit'],
        },
      ],
      {
        title: 'Le pape demande une trêve à Poutine',
        headlines: ['Le Vatican appelle au cessez-le-feu'],
      },
    );
    expect(payload.headline).toBe(
      'Sujet — épisodes déjà joints :\n' +
        'Épisode — Des frappes russes touchent une centrale électrique à Kiev\n' +
        '- Premier bilan\n' +
        '- Nouvelles frappes\n' +
        'Épisode — Donald Trump juge honteuse la reprise des frappes\n' +
        '- La Maison-Blanche réagit\n' +
        'Nouvelle story : Le pape demande une trêve à Poutine\n' +
        '- Le Vatican appelle au cessez-le-feu',
    );
    expect(payload.teaser).toBe('');
  });

  it('drops headlines duplicating the episode title, keeps the question criteria', () => {
    const payload = topicPayload(
      [
        {
          title: 'Un tireur fait plusieurs victimes',
          headlines: [
            'Un tireur fait plusieurs victimes',
            'Le bilan s’alourdit',
          ],
        },
      ],
      { title: 'L’auteur était un ancien élève', headlines: [] },
    );
    expect(payload.headline).toBe(
      'Sujet — épisodes déjà joints :\n' +
        'Épisode — Un tireur fait plusieurs victimes\n' +
        '- Le bilan s’alourdit\n' +
        'Nouvelle story : L’auteur était un ancien élève',
    );
    expect(TOPIC_QUESTION.continues.criteria.yes).toContain('réaction');
    expect(TOPIC_QUESTION.continues.criteria.no).toContain('autre match');
  });
});
