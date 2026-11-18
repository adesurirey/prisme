import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ModeProvider } from '@/mode/mode';

import { HomeHeader } from './HomeHeader';

// The native sheet never loads in Jest (issue #196) — HomeHeader pulls
// ModeButton, which imports the ESM-only native module.
jest.mock('@lodev09/react-native-true-sheet', () => ({
  TrueSheet: require('@/chrome/true-sheet.mock').MockTrueSheet,
}));

// The flip animation is Reanimated; Jest gets its mock (issue #196).
jest.mock(
  'react-native-reanimated',
  () => require('@/test/reanimated-mock').reanimatedMock,
);

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

// Deterministic insets — the pills row hangs below the top inset.
const INSETS = {
  insets: { top: 59, bottom: 34, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

function renderHeader(props: { stamp?: string; onOpenMenu?: () => void } = {}) {
  return render(
    <ModeProvider>
      <SafeAreaProvider initialMetrics={INSETS}>
        <HomeHeader stamp={props.stamp} onOpenMenu={props.onOpenMenu} />
      </SafeAreaProvider>
    </ModeProvider>,
  );
}

describe('HomeHeader (issue #196, amended)', () => {
  test('carries the fixed « À la une » title and the stamp', async () => {
    await renderHeader({ stamp: 'Dernier point à 14h' });

    // The title block moved in from the scroll content (amending #196):
    // fixed chrome over the frost, not list content anymore.
    expect(screen.getByText('À la une')).toBeTruthy();
    expect(screen.getByText('Dernier point à 14h')).toBeTruthy();
  });

  test('renders no stamp line when the caller has none', async () => {
    await renderHeader();

    expect(screen.getByText('À la une')).toBeTruthy();
    expect(screen.queryByText(/Dernier point/)).toBeNull();
  });

  test('the mode pill sits in the overlay', async () => {
    await renderHeader();

    expect(screen.getByTestId('mode-button')).toBeTruthy();
  });

  test('the burger pill opens the tile (#198)', async () => {
    const onOpenMenu = jest.fn();
    await renderHeader({ onOpenMenu });

    const burger = screen.getByTestId('burger-button');
    expect(burger.props.accessibilityState?.disabled).toBe(false);
    fireEvent.press(burger);
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
  });
});
