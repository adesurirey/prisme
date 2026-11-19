import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, Share } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BurgerTile } from './BurgerTile';

// The tile imports the header's geometry constants (the wordmark's
// alignment), which pull in ModeButton's native sheet and haptics
// (issue #196) — Jest gets the established stand-ins.
jest.mock('@lodev09/react-native-true-sheet', () => ({
  TrueSheet: require('@/chrome/true-sheet.mock').MockTrueSheet,
}));

jest.mock(
  'react-native-reanimated',
  () => require('@/test/reanimated-mock').reanimatedMock,
);

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

// The tile pushes the static routes (issue #195 routes) through the
// router — the seam is the push call itself, no navigation runtime.
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Deterministic insets — the wordmark clears the status bar.
const INSETS = {
  insets: { top: 59, bottom: 34, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

async function renderTile() {
  jest.clearAllMocks();
  const onClose = jest.fn();
  // RTL v14's render is async — awaited before any screen query.
  await render(
    <SafeAreaProvider initialMetrics={INSETS}>
      <BurgerTile onClose={onClose} />
    </SafeAreaProvider>,
  );
  return { onClose };
}

describe('BurgerTile (issue #198)', () => {
  test('carries the Prisme wordmark on top', async () => {
    await renderTile();

    expect(screen.getByLabelText('Prisme')).toBeTruthy();
  });

  test('renders the two static-route rows', async () => {
    await renderTile();

    expect(
      screen.getByRole('button', { name: 'Classement des médias' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Comment ça marche' }),
    ).toBeTruthy();
  });

  test('a row pushes its route and closes the drawer', async () => {
    const { onClose } = await renderTile();

    // Wrapped in awaited acts: RNTL's fireEvent dispatch runs inside
    // act, and overlapping act scopes corrupt the next test's render.
    await act(async () => {
      fireEvent.press(
        screen.getByRole('button', { name: 'Classement des médias' }),
      );
    });
    expect(mockPush).toHaveBeenCalledWith('/classement');
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.press(
        screen.getByRole('button', { name: 'Comment ça marche' }),
      );
    });
    expect(mockPush).toHaveBeenCalledWith('/methode');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('the share pill shares leprisme.info and stays on the tile', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({
      action: Share.sharedAction,
      activityType: undefined,
    });
    const { onClose } = await renderTile();

    await act(async () => {
      fireEvent.press(screen.getByTestId('share-site-button'));
    });
    expect(shareSpy).toHaveBeenCalledWith({ url: 'https://leprisme.info' });
    // Sharing doesn't navigate: the drawer stays open.
    expect(onClose).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
