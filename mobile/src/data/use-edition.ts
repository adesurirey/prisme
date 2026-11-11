/**
 * The Edition in the component tree: the hook every screen reads the
 * artifact through (issue #179). On open it renders the disk cache
 * instantly, then revalidates in the background; pull-to-refresh forces a
 * round through the same door. Whatever happens on the network, a rendered
 * Edition stays rendered — `builtAt` carries the honesty stamp.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  EditionClient,
  EditionSnapshot,
  Revalidation,
} from './edition-client';
import { editionClient } from './runtime';

export type EditionPhase =
  /** No artifact yet: nothing was cached and nothing has arrived. */
  | { status: 'loading' }
  /** An Edition plus its Outlets, with the builtAt to stamp it with. */
  | { status: 'ready'; snapshot: EditionSnapshot }
  /** Cold open, total failure: nothing to render. Pull to retry. */
  | { status: 'error' };

export function useEdition(client: EditionClient = editionClient): {
  phase: EditionPhase;
  /** True while a pull-to-refresh round runs — the spinner's state. */
  refreshing: boolean;
  /** Pull-to-refresh: force a revalidation round now. */
  refresh: () => Promise<void>;
} {
  const [phase, setPhase] = useState<EditionPhase>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  // Whether any snapshot was ever rendered — a later 'unavailable' must not
  // evict it.
  const renderedRef = useRef(false);

  /** What one revalidation round means for the rendered phase: a `200`
   *  re-renders, a failure keeps what is rendered, and 'unavailable' only
   *  lands when nothing was ever rendered. */
  const apply = useCallback((result: Revalidation) => {
    if (result.kind === 'fresh') {
      renderedRef.current = true;
      setPhase({ status: 'ready', snapshot: result.snapshot });
    } else if (result.kind === 'unavailable' && !renderedRef.current) {
      setPhase({ status: 'error' });
    }
    // 'unchanged' and 'kept': what is rendered stays rendered.
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      const cached = await client.readCache();
      if (!active) return;
      if (cached != null) {
        renderedRef.current = true;
        setPhase({ status: 'ready', snapshot: cached });
      }

      const result = await client.revalidate();
      if (active) apply(result);
    })().catch(() => {
      if (active && !renderedRef.current) setPhase({ status: 'error' });
    });

    return () => {
      active = false;
    };
  }, [client, apply]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      apply(await client.revalidate({ force: true }));
    } finally {
      setRefreshing(false);
    }
  }, [client, apply]);

  return { phase, refreshing, refresh };
}
