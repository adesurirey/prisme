import { render, screen } from '@testing-library/react-native';
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

function renderHeader() {
  return render(
    <ModeProvider>
      <SafeAreaProvider initialMetrics={INSETS}>
        <HomeHeader />
      </SafeAreaProvider>
    </ModeProvider>,
  );
}

describe('HomeHeader (issue #196)', () => {
  test('carries no title — « À la une » is list content', async () => {
    await renderHeader();

    expect(screen.queryByText('À la une')).toBeNull();
  });

  test('the mode pill sits in the overlay', async () => {
    await renderHeader();

    expect(screen.getByTestId('mode-button')).toBeTruthy();
  });

  test('the burger pill renders inert — 5d wires it', async () => {
    await renderHeader();

    const burger = screen.getByTestId('burger-button');
    expect(burger).toBeTruthy();
    expect(burger.props.accessibilityState?.disabled).toBe(true);
  });
});
