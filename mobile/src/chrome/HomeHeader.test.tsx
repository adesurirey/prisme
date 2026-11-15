import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ModeProvider } from '@/mode/mode';

import { HomeHeader } from './HomeHeader';

// The native sheet never loads in Jest (issue #196) — HomeHeader pulls
// ModeButton, which imports the ESM-only native module.
jest.mock('@lodev09/react-native-true-sheet', () => ({
  TrueSheet: require('@/chrome/true-sheet.mock').MockTrueSheet,
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

// Deterministic insets — the bar's top padding is the top inset + a lead.
const INSETS = {
  insets: { top: 59, bottom: 34, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

function renderHeader(builtAt = '2025-11-11T13:01:00Z') {
  return render(
    <ModeProvider>
      <SafeAreaProvider initialMetrics={INSETS}>
        <HomeHeader builtAt={builtAt} />
      </SafeAreaProvider>
    </ModeProvider>,
  );
}

describe('HomeHeader (issue #196)', () => {
  test('names the page « À la une »', async () => {
    await renderHeader();

    expect(screen.getByText('À la une')).toBeTruthy();
  });

  test('the stamp reads the artifact builtAt in Paris time', async () => {
    await renderHeader('2025-11-11T13:01:00Z');

    // 13:01 UTC is 14:01 in November's CET.
    expect(screen.getByText('Dernier point à 14h01')).toBeTruthy();
  });

  test('the mode pill sits in the bar', async () => {
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
