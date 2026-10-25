import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * The private Membership-refusal cache (issue #148, spec #147): every
 * definitive merge-question 'no' — pair key `${articleId}|${storyId}`, the
 * Membership gate's own composite-key convention → the ISO instant of the
 * refusal — accumulated across builds so an identical (Article, Story)
 * question is never paid for twice (ADR-0012's finiteness across builds,
 * not just within one). Stored at `.cache/refusals.json` (see
 * REFUSAL_CACHE_PATH in paths.ts) — outside the published data/, gitignored,
 * round-tripped by CI through the Actions cache: the teaser cache's
 * pattern (ADR-0027's private-cache precedent). Ids and instants only —
 * never headline or teaser text (ADR-0003 holds trivially). Entries expire
 * 48 h after the refusal instant, pruned at load and at save, so the ledger
 * is bounded to ~2 days of pairs and stays disposable POC state. A missing
 * or corrupt file degrades to an empty ledger with a warning and never
 * fails a build — cache philosophy, not database philosophy: the truth
 * stays in the Story files.
 */

/** Pair key `${articleId}|${storyId}` → ISO instant of the refusal. */
export type RefusalLedger = Record<string, string>;

/** How long a refusal answers its pair: 48 h from the refusal instant
 * (issue #148). Soundness: a refusal is only consultable while its Article
 * is fresh, and freshness is the 24 h collection window — 48 h bounds every
 * possible consultation with margin, and bounds the cache to ~2 days of
 * pairs. */
export const REFUSAL_TTL_MS = 48 * 3_600_000;

/** True when the entry is a consultable refusal: a `${articleId}|${storyId}`
 * key and an instant not yet past the TTL. Malformed keys and instants
 * count as expired — corruption degrades, never fails (issue #148). */
function isLiveEntry(
  key: string,
  instant: unknown,
  now: Date,
): instant is string {
  if (typeof instant !== 'string') return false;
  const [articleId, storyId] = key.split('|');
  if (
    articleId == null ||
    articleId === '' ||
    storyId == null ||
    storyId === ''
  )
    return false;
  const at = Date.parse(instant);
  return !Number.isNaN(at) && at >= now.getTime() - REFUSAL_TTL_MS;
}

/** Pure: keep only entries inside the TTL — the bound that keeps the
 * ledger at ~2 days of pairs (issue #148). */
export function pruneRefusals(ledger: RefusalLedger, now: Date): RefusalLedger {
  const out: RefusalLedger = {};
  for (const [key, instant] of Object.entries(ledger))
    if (isLiveEntry(key, instant, now)) out[key] = instant;
  return out;
}

/**
 * Tolerant read (prior art: the teaser cache): a missing, corrupt or
 * wrongly-shaped file yields an empty ledger plus a build-log warning —
 * never a build failure. Entries older than the TTL are pruned at load, so
 * a consultable entry is always one the Article's 24 h collection window
 * could still ask.
 */
export async function loadRefusalCache(
  path: URL,
  now: Date,
): Promise<RefusalLedger> {
  try {
    const ledger = JSON.parse(await readFile(path, 'utf8')) as RefusalLedger;
    if (ledger == null || typeof ledger !== 'object' || Array.isArray(ledger)) {
      console.warn(
        '⚠️ Refusal cache has an unexpected shape — starting an empty ledger; refused pairs are re-paid once (issue #148).',
      );
      return {};
    }
    return pruneRefusals(ledger, now);
  } catch {
    console.warn(
      '⚠️ Refusal cache missing or corrupt — starting an empty ledger; refused pairs are re-paid once (issue #148).',
    );
    return {};
  }
}

/**
 * Pure: the active ledger plus this build’s refusals (issue #148). A pair
 * refused this build is added; a pair already in the ledger keeps its
 * original instant — the cache answers from the first refusal and never
 * refreshes a TTL on consultation. Aged entries are pruned, so the saved
 * file stays bounded to ~2 days of pairs.
 */
export function mergeRefusals(
  ledger: RefusalLedger,
  refusals: ReadonlyMap<string, string>,
  now: Date,
): RefusalLedger {
  const out = pruneRefusals(ledger, now);
  for (const [key, instant] of refusals) {
    if (out[key] == null) out[key] = instant;
  }
  return out;
}

export async function saveRefusalCache(
  ledger: RefusalLedger,
  path: URL,
): Promise<void> {
  await mkdir(dirname(path.pathname), { recursive: true });
  await writeFile(path, `${JSON.stringify(ledger, null, 2)}\n`);
}
