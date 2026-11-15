import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { MODE_STORAGE_KEY, ModeProvider } from '@/mode/mode';

import { ModeButton } from './ModeButton';
import { mockTrueSheetMethods } from './true-sheet.mock';

// The native sheet never loads in Jest: the mock renders its children in
// a plain View and records present/dismiss (issue #196).
jest.mock('@lodev09/react-native-true-sheet', () => ({
  TrueSheet: require('@/chrome/true-sheet.mock').MockTrueSheet,
}));

// The haptic is native; the test asserts the call, not the vibration.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

import * as Haptics from 'expo-haptics';

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

function renderButton(storage = memoryStorage()) {
  // RTL v14's render is async — the returned promise must be awaited
  // before any screen query.
  return render(
    <ModeProvider storage={storage}>
      <ModeButton />
    </ModeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ModeButton (issue #196)', () => {
  test('the pill reads the current mode as « Couv. »', async () => {
    await renderButton();

    expect(screen.getByText('Couv.')).toBeTruthy();
    await waitFor(() =>
      expect(mockTrueSheetMethods.present).not.toHaveBeenCalled(),
    );
  });

  test('a persisted Exposition reads « Expo. »', async () => {
    await renderButton(memoryStorage({ [MODE_STORAGE_KEY]: 'exposure' }));

    expect(await screen.findByText('Expo.')).toBeTruthy();
  });

  test('the long-press tip is part of the sheet', async () => {
    await renderButton();

    expect(screen.getByText('Appui long : basculer directement.')).toBeTruthy();
  });

  test('a tap presents the sheet and flips nothing', async () => {
    const storage = memoryStorage();
    await renderButton(storage);

    await fireEvent.press(screen.getByTestId('mode-button'));

    expect(mockTrueSheetMethods.present).toHaveBeenCalled();
    expect(storage.writes).toEqual([]);
  });

  test('choosing Exposition flips the reading, persists it, dismisses', async () => {
    const storage = memoryStorage();
    await renderButton(storage);

    await screen.findByText('Couv.');
    await fireEvent.press(screen.getByTestId('mode-row-exposure'));

    expect(await screen.findByText('Expo.')).toBeTruthy();
    expect(storage.writes).toEqual([[MODE_STORAGE_KEY, 'exposure']]);
    expect(mockTrueSheetMethods.dismiss).toHaveBeenCalled();
  });

  test('choosing Couverture from a persisted Exposition flips back', async () => {
    const storage = memoryStorage({ [MODE_STORAGE_KEY]: 'exposure' });
    await renderButton(storage);

    await screen.findByText('Expo.');
    await fireEvent.press(screen.getByTestId('mode-row-coverage'));

    expect(await screen.findByText('Couv.')).toBeTruthy();
    expect(storage.writes).toEqual([[MODE_STORAGE_KEY, 'coverage']]);
  });

  test('a long-press flips instantly with a haptic and no sheet', async () => {
    const storage = memoryStorage();
    await renderButton(storage);

    await screen.findByText('Couv.');
    await fireEvent(screen.getByTestId('mode-button'), 'longPress');

    expect(await screen.findByText('Expo.')).toBeTruthy();
    expect(storage.writes).toEqual([[MODE_STORAGE_KEY, 'exposure']]);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
    expect(mockTrueSheetMethods.present).not.toHaveBeenCalled();
  });
});
