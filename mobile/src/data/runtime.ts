/**
 * The React Native wiring of the Edition client: `fetch` for HTTP, the
 * Expo file system for the last-good disk cache, and the singleton every
 * screen shares through `useEdition`. The contract semantics live in
 * `edition-client.ts`; only the ports are implemented here.
 */

import { Directory, File, Paths } from 'expo-file-system';

import {
  ARTIFACT_BASE_URL,
  type ArtifactCache,
  createEditionClient,
  type FetchResponse,
  type FetchText,
} from './edition-client';

/** Where the last-good artifacts live. Documents, not cache: the OS may
 *  evict cache storage, and the offline Edition is the product promise. */
export const ARTIFACT_CACHE_DIR = 'prisme-edition';

/** The cache directory, as one `Directory` — exposed for tests that seed
 *  the offline fixture through the same files the client reads. */
export function editionCacheDirectory(): Directory {
  return new Directory(Paths.document, ARTIFACT_CACHE_DIR);
}

/**
 * One artifact on disk: the raw body at `<name>.json`, its ETag in a
 * `<name>.json.etag` sidecar (absent when the server sent none — the next
 * fetch is then simply unconditional).
 */
export function createDiskArtifactCache(
  directory: Directory,
  name: string,
): ArtifactCache {
  const bodyFile = new File(directory, `${name}.json`);
  const etagFile = new File(directory, `${name}.json.etag`);

  return {
    async read() {
      if (!bodyFile.exists) return null;
      return {
        body: await bodyFile.text(),
        etag: etagFile.exists ? await etagFile.text() : null,
      };
    },

    async write(artifact) {
      directory.create({ intermediates: true, idempotent: true });
      await bodyFile.write(artifact.body);
      if (artifact.etag == null) {
        if (etagFile.exists) etagFile.delete();
        return;
      }
      await etagFile.write(artifact.etag);
    },
  };
}

/** The conditional-GET port over React Native's `fetch`. */
export const rnFetchText: FetchText = async (url, etag) => {
  const response = await fetch(url, {
    headers: etag != null ? { 'If-None-Match': etag } : {},
  });
  const result: FetchResponse = {
    status: response.status,
    etag: response.headers.get('etag'),
    body: response.status === 200 ? await response.text() : null,
  };
  return result;
};

/** The one Edition client the app uses (ADR-0043: one module to swap). */
export const editionClient = createEditionClient({
  baseUrl: ARTIFACT_BASE_URL,
  fetchText: rnFetchText,
  caches: {
    edition: createDiskArtifactCache(editionCacheDirectory(), 'edition'),
    outlets: createDiskArtifactCache(editionCacheDirectory(), 'outlets'),
  },
});
