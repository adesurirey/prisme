import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, Share } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ModeProvider } from '@/mode/mode';
import { collectMarkers, type MarkerNode } from '@/test/tree';

import { ScreenHeader } from './ScreenHeader';

// The mode pill pulls the native sheet and haptics (issue #196).
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

/** The literal share target of the fixture story — the spec's shape
 *  (`https://leprisme.info/<storyDay>/<slug>/`), not recomputed. */
const URL = 'https://leprisme.info/2026-11-10/budget-2027-en-commission/';

function renderHeader(
  props: { shareUrl?: string | null; onBack?: () => void; mode?: boolean } = {},
) {
  return render(
    <ModeProvider>
      <SafeAreaProvider initialMetrics={INSETS}>
        <ScreenHeader
          onBack={props.onBack ?? (() => undefined)}
          shareUrl={props.shareUrl === undefined ? URL : props.shareUrl}
          mode={props.mode === undefined ? true : props.mode}
        />
      </SafeAreaProvider>
    </ModeProvider>,
  );
}

describe('ScreenHeader (issue #199)', () => {
  test('the back pill fires the pop', async () => {
    const onBack = jest.fn();
    await renderHeader({ onBack });

    fireEvent.press(screen.getByTestId('back-button'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('the share pill shares the story URL', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    try {
      await renderHeader();

      fireEvent.press(screen.getByTestId('share-button'));
      expect(share).toHaveBeenCalledWith({ url: URL });
    } finally {
      share.mockRestore();
    }
  });

  test('on Android the URL rides the message — the chooser carries it', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'android');
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    try {
      await renderHeader();

      fireEvent.press(screen.getByTestId('share-button'));
      expect(share).toHaveBeenCalledWith({ message: URL });
    } finally {
      share.mockRestore();
      os.restore();
    }
  });

  test('without a resolved story, the share pill is disabled and shares nothing', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    try {
      await renderHeader({ shareUrl: null });

      const pill = screen.getByTestId('share-button');
      expect(pill.props.accessibilityState?.disabled).toBe(true);
      fireEvent.press(pill);
      expect(share).not.toHaveBeenCalled();
    } finally {
      share.mockRestore();
    }
  });

  test('the mode pill rides before the share pill — the home position kept', async () => {
    const { toJSON } = await renderHeader();

    // Marker order is chrome behavior: the mode keeps its home position.
    const order = collectMarkers(toJSON() as MarkerNode);
    expect(order).toContain('mode-button');
    expect(order.indexOf('mode-button')).toBeLessThan(
      order.indexOf('share-button'),
    );
  });

  test('without mode, the pill stays home — back and share only (the static pages)', async () => {
    const onBack = jest.fn();
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    try {
      await renderHeader({ mode: false, onBack });

      expect(screen.queryByTestId('mode-button')).toBeNull();

      fireEvent.press(screen.getByTestId('back-button'));
      expect(onBack).toHaveBeenCalledTimes(1);

      fireEvent.press(screen.getByTestId('share-button'));
      expect(share).toHaveBeenCalledWith({ url: URL });
    } finally {
      share.mockRestore();
    }
  });
});
