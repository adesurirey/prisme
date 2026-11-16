import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BurgerTile } from './BurgerTile';

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
      screen.getByRole('button', { name: 'Classement politique des médias' }),
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
        screen.getByRole('button', { name: 'Classement politique des médias' }),
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

  test('the icons carry a plain-text fallback (jest sees the fallback path)', async () => {
    await renderTile();

    // The SymbolView mock resolves to the fallback — the glyphs Android
    // renders where SF Symbols do not exist.

    expect(screen.getByText(/≡/)).toBeTruthy();
    expect(screen.getByText(/\?/)).toBeTruthy();
  });
});
