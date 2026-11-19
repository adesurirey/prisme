/**
 * The reading-mode seam (issue #180): one global mode — Couverture
 * (default) or Exposition — persisted in AsyncStorage under
 * `prisme.mode`, read once on mount, written on every flip. The
 * storage is injected so the tests run against a plain object, the
 * same injection pattern as the web's `storedMode` (mode-toggle.ts).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/** How every coverage bar on every screen reads. Same vocabulary as the
 *  web (mode-toggle.ts): 'coverage' | 'exposure'. */
export type ReadingMode = 'coverage' | 'exposure';

/** AsyncStorage key; absent or unreadable = Couverture. */
export const MODE_STORAGE_KEY = 'prisme.mode';

/** The storage seam the provider reads and writes through. */
export interface ModeStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** The pill's short reading, one per mode — a stable width, the Photos
 *  « Sélect. » pattern (issue #196): the full names live in the sheet and
 *  the accessibility label, the pill carries the abbreviations. */
export function modeShortLabel(mode: ReadingMode): string {
  return mode === 'coverage' ? 'Couv.' : 'Expo.';
}

/** The other reading — the long-press's direct flip (issue #196). */
export function flipMode(mode: ReadingMode): ReadingMode {
  return mode === 'coverage' ? 'exposure' : 'coverage';
}

/** Read the persisted mode. A broken storage never breaks the app. */
export function storedMode(storage: ModeStorage): Promise<ReadingMode> {
  return storage
    .getItem(MODE_STORAGE_KEY)
    .then((stored) => (stored === 'exposure' ? 'exposure' : 'coverage'))
    .catch(() => 'coverage' as const);
}

interface ModeContextValue {
  mode: ReadingMode;
  /** Flip the reading everywhere and persist the choice. */
  setMode: (mode: ReadingMode) => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export function ModeProvider({
  children,
  storage = AsyncStorage,
}: {
  children: ReactNode;
  storage?: ModeStorage;
}) {
  const [mode, setModeState] = useState<ReadingMode>('coverage');

  // Restore the persisted mode once on mount — before any flip, the
  // default is what's on screen.
  useEffect(() => {
    let active = true;
    storedMode(storage).then((restored) => {
      if (active) setModeState(restored);
    });
    return () => {
      active = false;
    };
  }, [storage]);

  const value = useMemo<ModeContextValue>(
    () => ({
      mode,
      setMode: (next) => {
        setModeState(next);
        // Fire-and-forget: a failed write never breaks the flip on screen.
        storage.setItem(MODE_STORAGE_KEY, next).catch(() => undefined);
      },
    }),
    [mode, storage],
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode(): ModeContextValue {
  const value = useContext(ModeContext);
  if (value == null) {
    throw new Error('useMode needs a ModeProvider above it in the tree');
  }
  return value;
}
