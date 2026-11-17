import { fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ModeProvider } from '@/mode/mode';
import { collectMarkers, type MarkerNode } from '@/test/tree';
import { Classement } from './index';

// The router pops the chrome (issue #195's push; the story's seam).
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

// The header statically imports the mode pill (its sheet and haptics).
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

function renderClassement() {
  return render(
    <ModeProvider>
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 59, bottom: 34, left: 0, right: 0 },
          frame: { x: 0, y: 0, width: 393, height: 852 },
        }}
      >
        <Classement />
      </SafeAreaProvider>
    </ModeProvider>,
  );
}

describe('the Classement screen (issue #199)', () => {
  test('the share pill offers the page’s public URL', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    try {
      await renderClassement();

      fireEvent.press(screen.getByTestId('share-button'));
      // The literal — the site's own slug, trailing slash.
      expect(share).toHaveBeenCalledWith({
        url: 'https://leprisme.info/classement-politique-des-medias/',
      });
    } finally {
      share.mockRestore();
    }
  });

  test('no mode pill — nothing on the page reads the mode', async () => {
    await renderClassement();

    expect(screen.queryByTestId('mode-button')).toBeNull();
  });

  test('the back pill pops the route', async () => {
    await renderClassement();

    fireEvent.press(screen.getByTestId('back-button'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  test('the chrome renders above the content — the pills win hit-testing', async () => {
    const { toJSON } = await renderClassement();

    // RN presses land on the topmost later sibling: the header must
    // render AFTER the scroll's content, or the pills go dead (the
    // simulator-found bug, issue #199).
    const markers = collectMarkers(toJSON() as MarkerNode);
    expect(markers.indexOf('back-button')).toBeGreaterThan(
      markers.indexOf('Classement politique des médias'),
    );
  });
});
