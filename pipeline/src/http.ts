/** Shared feed fetcher: same UA and timeout for every pipeline entry point. */
export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/**
 * HTTP statuses every model client retries once (server-side or throttling
 * hiccups); 4xx config errors fail fast instead.
 */
export const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504, 529]);

export async function fetchFeed(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}