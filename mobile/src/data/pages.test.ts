import { ARTIFACT_BASE_URL } from './edition-client';
import { CLASSEMENT_WEB_URL, METHODE_WEB_URL } from './pages';

describe('the static pages’ public URLs (issue #199)', () => {
  test('the Classement page lives at the site’s own slug', () => {
    expect(CLASSEMENT_WEB_URL).toBe(
      'https://leprisme.info/classement-politique-des-medias/',
    );
  });

  test('the Méthode page lives at /methode/', () => {
    expect(METHODE_WEB_URL).toBe('https://leprisme.info/methode/');
  });

  test('both hang off the artifact root', () => {
    expect(CLASSEMENT_WEB_URL.startsWith(ARTIFACT_BASE_URL)).toBe(true);
    expect(METHODE_WEB_URL.startsWith(ARTIFACT_BASE_URL)).toBe(true);
  });
});
