# The site is prerendered with Astro, and the UI is React components

Every Edition build regenerates the whole site as static HTML. Astro handles pages, routing and data loading, and all UI is written as React (`.tsx`) components rendered at build time. Only the interactive pieces (Prism tabs, Coverage tooltip, the Article list's "Voir les N autres articles" toggle) are hydrated as islands. This gives fast pages, a crawlable URL with its own preview tags for every Story, and Summaries that are indexable. It runs on GitHub Pages with no server, while staying React + TypeScript.

## Considered Options

- Vite + React SPA: simplest, but serves an empty HTML shell. It's poor for indexing and gives every shared Story the same link preview.
- React Router v7 framework mode with `prerender`: 100% React, but hydrates the whole page and ships far more JavaScript.
- Next.js static export: works on GitHub Pages, but is heavy, and many Next features are unavailable in static mode.
