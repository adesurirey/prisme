import type { RedirectRegistry } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import { redirectStubHtml, stubsToEmit } from './redirect-stub.ts';

const SITE = 'https://leprisme.info';

/**
 * The redirect stub pages: for every registry entry whose dead URL has no
 * Story file anymore, the build emits a 0-second meta-refresh page at the
 * old path — the static-hosting stand-in for a server-side 301, treated
 * like a permanent redirect by search engines when paired with a canonical
 * link to the target.
 */

const REGISTRY: RedirectRegistry = {
  redirects: [
    {
      from: { day: '2026-10-17', slug: 'sujet-ancien' },
      to: { day: '2026-10-18', slug: 'sujet-base' },
      createdAt: '2026-10-18T12:00:00Z',
    },
    {
      from: { day: '2026-10-18', slug: 'sujet-abs' },
      to: { day: '2026-10-18', slug: 'sujet-base' },
      createdAt: '2026-10-18T12:00:00Z',
    },
  ],
};

describe('stubsToEmit', () => {
  it('emits only entries whose dead URL has no Story file', () => {
    // 'sujet-base' has a Story file (it survived the merge): no stub.
    // 'sujet-ancien' and 'sujet-abs' were merged away: stubs.
    expect(
      stubsToEmit(REGISTRY, new Set(['sujet-base', 'sujet-autre'])),
    ).toEqual(REGISTRY.redirects);
  });

  it('skips entries whose from-slug still exists as a Story', () => {
    expect(stubsToEmit(REGISTRY, new Set(['sujet-base', 'sujet-abs']))).toEqual(
      [REGISTRY.redirects[0]],
    );
  });
});

describe('redirectStubHtml', () => {
  const html = redirectStubHtml(REGISTRY.redirects[0], SITE);

  it('refreshes immediately to the absolute target URL', () => {
    expect(html).toContain(
      '<meta http-equiv="refresh" content="0; url=https://leprisme.info/2026-10-18/sujet-base/">',
    );
  });

  it('consolidates ranking signals with a canonical link', () => {
    expect(html).toContain(
      '<link rel="canonical" href="https://leprisme.info/2026-10-18/sujet-base/">',
    );
  });

  it('keeps a no-script and a visible French fallback link', () => {
    expect(html).toContain('<noscript>');
    expect(html).toContain('Cette page a déménagé');
    expect(html).toContain('href="/2026-10-18/sujet-base/"');
  });
});
