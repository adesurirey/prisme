/**
 * The app's single data seam (issue #179, ADR-0043): the Edition client.
 *
 * The static site is the app's API — `edition.json` + `outlets.json`
 * published as-is at the site root. This module owns the whole contract:
 * render the disk cache instantly, revalidate with `If-None-Match` in the
 * background (`304` keeps, `200` replaces), keep the last good artifact on
 * failure, and surface `builtAt` as the honesty stamp. No contract
 * versioning: app and site change in lockstep from this repo (POC).
 *
 * Everything the stories carry — `articles`, summaries, `differences`, the
 * pipeline-computed `activity` bins (issue #186) — passes through untouched:
 * this layer does no binning and contains no timezone logic.
 *
 * The core is pure: HTTP and the disk come in as ports, so the semantics
 * are testable against fakes. The React Native wiring (fetch + the Expo
 * file system) lives in `runtime.ts`; screens reach it through
 * `useEdition`.
 */

import type { Edition, Outlet } from '@prisme/domain';

/** The site root every artifact URL hangs off (ADR-0043). */
export const ARTIFACT_BASE_URL = 'https://leprisme.info';

/** One cached artifact: the last good body plus the ETag it arrived with. */
export interface CachedArtifact {
  etag: string | null;
  body: string;
}

/** The disk-cache port: last-good storage for one artifact. */
export interface ArtifactCache {
  read(): Promise<CachedArtifact | null>;
  write(artifact: CachedArtifact): Promise<void>;
}

/** What one conditional GET concluded. */
export interface FetchResponse {
  status: number;
  etag: string | null;
  body: string | null;
}

/**
 * The HTTP port. `etag` is the cached artifact's ETag, sent as
 * `If-None-Match`; `null` means fetch unconditionally. Network failures
 * reject — the client treats that as keep-the-last-good.
 */
export type FetchText = (
  url: string,
  etag: string | null,
) => Promise<FetchResponse>;

/** The Edition plus its Outlets — one artifact, fetched and cached as a pair. */
export interface EditionSnapshot {
  edition: Edition;
  outlets: Outlet[];
  /** `edition.builtAt`, surfaced for the « mis à jour » stamp. */
  builtAt: string;
}

/** What one revalidation round concluded. */
export type Revalidation =
  /** A `200` replaced at least one artifact — re-render. */
  | { kind: 'fresh'; snapshot: EditionSnapshot }
  /** Every conditional GET answered `304` — what is rendered is current. */
  | { kind: 'unchanged'; snapshot: EditionSnapshot }
  /** A fetch failed and the last good artifact stays — its builtAt is the
   *  honest « mis à jour » stamp. */
  | { kind: 'kept'; snapshot: EditionSnapshot; error: unknown }
  /** Nothing to render: no pair was cached and none arrived. Whatever `200`
   *  did land is cached, so the next round recovers from it. */
  | { kind: 'unavailable'; error: unknown };

export interface EditionClient {
  /** The disk cache rendered instantly on open, before any network. */
  readCache(): Promise<EditionSnapshot | null>;
  /**
   * Fetch both artifacts, conditionally on the cached ETags. Concurrent
   * calls share one round; `{ force: true }` (pull-to-refresh) starts a
   * fresh one regardless.
   */
  revalidate(options?: { force?: boolean }): Promise<Revalidation>;
}

/** What one artifact's round produced: its current body, or nothing. */
interface ArtifactOutcome {
  body: string | null;
  /** True when a `200` replaced the cache this round. */
  fresh: boolean;
  /** The failure, when the round ended on the last good body (or none). */
  error: unknown | null;
}

/** Parse the pair into a snapshot — throws on a malformed body. */
function buildSnapshot(
  editionBody: string,
  outletsBody: string,
): EditionSnapshot {
  const edition = JSON.parse(editionBody) as Edition;
  const outlets = JSON.parse(outletsBody) as Outlet[];
  return { edition, outlets, builtAt: edition.builtAt };
}

export function createEditionClient(ports: {
  baseUrl?: string;
  fetchText: FetchText;
  caches: { edition: ArtifactCache; outlets: ArtifactCache };
}): EditionClient {
  const baseUrl = ports.baseUrl ?? ARTIFACT_BASE_URL;
  const { caches } = ports;

  async function safeRead(
    cache: ArtifactCache,
  ): Promise<CachedArtifact | null> {
    try {
      return await cache.read();
    } catch {
      return null;
    }
  }

  /** One artifact's round: conditional GET, `304` keeps, `200` replaces. */
  async function revalidateArtifact(
    name: 'edition' | 'outlets',
  ): Promise<ArtifactOutcome> {
    const cache = caches[name];
    const cached = await safeRead(cache);
    try {
      const response = await ports.fetchText(
        `${baseUrl}/${name}.json`,
        cached?.etag ?? null,
      );
      if (response.status === 304 && cached != null) {
        return { body: cached.body, fresh: false, error: null };
      }
      if (response.status === 200 && response.body != null) {
        JSON.parse(response.body); // a malformed body is a failure, not a render
        const artifact: CachedArtifact = {
          etag: response.etag,
          body: response.body,
        };
        await cache.write(artifact);
        return { body: artifact.body, fresh: true, error: null };
      }
      throw new Error(`unexpected ${name}.json status ${response.status}`);
    } catch (error) {
      // Keep the last good body — or report that there is none.
      return { body: cached?.body ?? null, fresh: false, error };
    }
  }

  let inflight: Promise<Revalidation> | null = null;

  async function run(): Promise<Revalidation> {
    const [edition, outlets] = await Promise.all([
      revalidateArtifact('edition'),
      revalidateArtifact('outlets'),
    ]);
    if (edition.body == null || outlets.body == null) {
      return {
        kind: 'unavailable',
        error: edition.error ?? outlets.error,
      };
    }
    try {
      const snapshot = buildSnapshot(edition.body, outlets.body);
      if (edition.fresh || outlets.fresh) return { kind: 'fresh', snapshot };
      const error = edition.error ?? outlets.error;
      if (error != null) return { kind: 'kept', snapshot, error };
      return { kind: 'unchanged', snapshot };
    } catch (error) {
      // A fetched body that does not parse: keep the previous render.
      const snapshot = await tryReadCache();
      if (snapshot == null) return { kind: 'unavailable', error };
      return { kind: 'kept', snapshot, error };
    }
  }

  async function tryReadCache(): Promise<EditionSnapshot | null> {
    const [edition, outlets] = await Promise.all([
      safeRead(caches.edition),
      safeRead(caches.outlets),
    ]);
    if (edition == null || outlets == null) return null;
    try {
      return buildSnapshot(edition.body, outlets.body);
    } catch {
      return null;
    }
  }

  return {
    readCache: tryReadCache,

    revalidate(options?: { force?: boolean }): Promise<Revalidation> {
      if (inflight != null && options?.force !== true) return inflight;
      const round = run().finally(() => {
        if (inflight === round) inflight = null;
      });
      inflight = round;
      return round;
    },
  };
}
