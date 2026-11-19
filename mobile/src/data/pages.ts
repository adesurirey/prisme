/**
 * The static pages' public URLs (issue #199) — what their share pills
 * offer. The site's own slugs, trailing slash like the sitemap's: the
 * Classement route (/classement) publishes at the fuller slug the web
 * page carries; Méthode matches its route.
 */

import { ARTIFACT_BASE_URL } from './edition-client';

export const CLASSEMENT_WEB_URL = `${ARTIFACT_BASE_URL}/classement-politique-des-medias/`;

export const METHODE_WEB_URL = `${ARTIFACT_BASE_URL}/methode/`;
