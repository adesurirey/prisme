import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
  flipMode,
  MODE_STORAGE_KEY,
  ModeProvider,
  modeShortLabel,
  useMode,
} from './mode';

/** A plain-object stand-in for AsyncStorage the provider can be given. */
function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const writes: Array<[string, string]> = [];
  return {
    getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
    setItem: (key: string, value: string) => {
      writes.push([key, value]);
      store.set(key, value);
      return Promise.resolve();
    },
    writes,
  };
}

function withProvider(storage = memoryStorage()) {
  return ({ children }: { children: ReactNode }) => (
    <ModeProvider storage={storage}>{children}</ModeProvider>
  );
}

describe('useMode (issue #180)', () => {
  test('defaults to Couverture when nothing is persisted', async () => {
    const storage = memoryStorage();
    const { result } = await renderHook(() => useMode(), {
      wrapper: withProvider(storage),
    });

    await waitFor(() => expect(result.current.mode).toBe('coverage'));
    expect(storage.writes).toEqual([]);
  });

  test('restores a persisted Exposition on mount', async () => {
    const storage = memoryStorage({ [MODE_STORAGE_KEY]: 'exposure' });
    const { result } = await renderHook(() => useMode(), {
      wrapper: withProvider(storage),
    });

    await waitFor(() => expect(result.current.mode).toBe('exposure'));
  });

  test('a flip changes the mode everywhere and persists it', async () => {
    const storage = memoryStorage();
    const { result } = await renderHook(() => useMode(), {
      wrapper: withProvider(storage),
    });

    await waitFor(() => expect(result.current.mode).toBe('coverage'));
    result.current.setMode('exposure');

    await waitFor(() => expect(result.current.mode).toBe('exposure'));
    expect(storage.writes).toEqual([[MODE_STORAGE_KEY, 'exposure']]);
  });

  test('a broken storage falls back to Couverture without breaking', async () => {
    const broken = {
      getItem: () => Promise.reject(new Error('gone')),
      setItem: () => Promise.reject(new Error('gone')),
    };
    const { result } = await renderHook(() => useMode(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ModeProvider storage={broken}>{children}</ModeProvider>
      ),
    });

    result.current.setMode('exposure');
    await waitFor(() => expect(result.current.mode).toBe('exposure'));
  });
});

describe('modeShortLabel (issue #196)', () => {
  test('the mode pill reads « Couv. » in Couverture', () => {
    expect(modeShortLabel('coverage')).toBe('Couv.');
  });

  test('the mode pill reads « Expo. » in Exposition', () => {
    expect(modeShortLabel('exposure')).toBe('Expo.');
  });
});

describe('flipMode (issue #196)', () => {
  test('a long-press on Couverture flips to Exposition', () => {
    expect(flipMode('coverage')).toBe('exposure');
  });

  test('a long-press on Exposition flips to Couverture', () => {
    expect(flipMode('exposure')).toBe('coverage');
  });
});
