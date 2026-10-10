/**
 * Prisme's service worker (issue #65) — hand-written because generateSW
 * cannot express the ordering we need: Story navigations must go through
 * the stale-while-revalidate route FIRST, and fall back to the precached
 * home page only when that fails (offline, never-visited Story). The
 * generated catch-all NavigationRoute would hijack every Story navigation
 * and never let the SWR route run.
 *
 * ADR-0004: the prerendered HTML is the Edition — navigations serve the
 * cached copy immediately and refresh it in the background, so a relaunch
 * may show the previous Edition and the next launch is current (the baked
 * "dernier point à HH:mm" line is the honesty cue).
 *
 * ADR-0005: Story pages are never precached — the archive grows
 * unbounded; they are cached at runtime on first visit only.
 */

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

// App shell: home, classement, mentions légales, hashed assets, icons,
// manifest — the injectManifest globPatterns in astro.config.mjs. The
// manifest entries are already /prisme-based (the @vite-pwa/astro
// manifest transform runs on the injected __WB_MANIFEST).
precacheAndRoute(self.__WB_MANIFEST, { directoryIndex: 'index.html' });

// The precache key of the home page is "/prisme" (the directory entry —
// directoryIndex above resolves it); createHandlerBoundToURL throws at
// runtime if this key is missing, so it must match exactly.
const homeHandler = createHandlerBoundToURL('/prisme');

// Story pages: cache at runtime on first visit, stale-while-revalidate;
// if the network and cache both fail (offline, never-visited Story),
// fall back to the precached home page so the app never dead-ends.
registerRoute(
  ({ request, url }) =>
    request.method === 'GET' && url.pathname.startsWith('/prisme/sujet/'),
  async (args) => {
    try {
      return await new StaleWhileRevalidate({
        cacheName: 'prisme-stories',
        plugins: [
          new ExpirationPlugin({ maxEntries: 200, purgeOnQuotaError: true }),
        ],
      }).handle(args);
    } catch {
      return homeHandler(args);
    }
  },
);

// Any other navigation (e.g. an unavailable page while offline) is
// served the precached home page; assets are excluded.
registerRoute(
  new NavigationRoute(homeHandler, {
    denylist: [
      /\/_astro\//,
      /\.(png|jpg|jpeg|svg|webp|ico|css|js|webmanifest)$/,
    ],
  }),
);

// Take over as soon as the updated worker activates: the SWR serving
// model already means the next launch gets the fresh Edition.
// (skipWaiting is missing from this TS config's DOM-only lib types.)
(
  self as unknown as ServiceWorkerGlobalScope & { skipWaiting(): Promise<void> }
).skipWaiting();
clientsClaim();
