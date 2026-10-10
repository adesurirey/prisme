import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import AstroPWA from '@vite-pwa/astro';
import { defineConfig } from 'astro/config';

// GitHub Pages project site: https://adesurirey.github.io/prisme/
export default defineConfig({
  site: 'https://adesurirey.github.io',
  base: '/prisme',
  integrations: [
    react(),
    AstroPWA({
      // injectManifest with the hand-written src/sw.ts: generateSW
      // cannot express the route ordering we need — Story navigations
      // must hit the stale-while-revalidate route before any catch-all
      // NavigationRoute, with the precached home page as its offline
      // fallback. See src/sw.ts.
      // srcDir/filename: the plugin resolves the SW source as
      // resolve(root, srcDir, filename) — it ignores injectManifest.swSrc.
      srcDir: 'src',
      filename: 'sw.ts',
      strategies: 'injectManifest',
      injectManifest: {
        swSrc: 'src/sw.ts',
        // App shell only — Story pages (sujet/*) are cached at runtime,
        // never precached: the archive grows unbounded (ADR-0005).
        // No *.html wildcard: it would pull every Story page into
        // precache.
        globPatterns: [
          'index.html',
          'classement-politique-des-medias/index.html',
          'mentions-legales/index.html',
          '_astro/**/*.{js,css}',
          'icons/*.png',
          'manifest.webmanifest',
        ],
        sourcemap: false,
      },
      // The manifest is the hand-authored public/manifest.webmanifest
      // (issue #64); the plugin must not emit a competing one.
      manifest: false,
      // registerSW is done by hand in Base.astro: the plugin's auto
      // injection targets Vite's transformIndexHtml, which prerendered
      // Astro HTML never goes through — suppress it so no dead
      // registerSW.js lands in dist.
      registerSW: false,
      injectRegister: false,
      // registerType auto: the SW source itself calls skipWaiting() and
      // clientsClaim() (src/sw.ts) so the updated worker activates as
      // soon as it can; SWR already guarantees the relaunched app shows
      // fresh HTML.
      registerType: 'autoUpdate',
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
