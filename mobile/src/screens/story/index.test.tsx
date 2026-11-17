import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { File } from 'expo-file-system';
import { Share } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import fixtureEdition from '@/data/__fixtures__/edition.json';
import fixtureOutlets from '@/data/__fixtures__/outlets.json';
import { editionCacheDirectory } from '@/data/runtime';
import { ModeProvider } from '@/mode/mode';
import { Story } from './index';

// The offline proof (issue #179): the disk cache seeded with the fixture,
// the network down — the screen still reads the Edition.
const realFetch = globalThis.fetch;

// The chrome pops via the router (issue #195's push; 5e's back).
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

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

beforeAll(async () => {
  const dir = editionCacheDirectory();
  dir.create({ intermediates: true, idempotent: true });
  await new File(dir, 'edition.json').write(JSON.stringify(fixtureEdition));
  await new File(dir, 'edition.json.etag').write('"v1"');
  await new File(dir, 'outlets.json').write(JSON.stringify(fixtureOutlets));
  await new File(dir, 'outlets.json.etag').write('"o1"');

  globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline'));
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

// The pushed id becomes a prop at the route (issue #195's seam).
function storyTree(id: string) {
  return (
    <ModeProvider>
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 59, bottom: 34, left: 0, right: 0 },
          frame: { x: 0, y: 0, width: 393, height: 852 },
        }}
      >
        <Story id={id} />
      </SafeAreaProvider>
    </ModeProvider>
  );
}

describe('the story screen (issue #199)', () => {
  test('the share pill offers the story’s public page, built from the snapshot', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    try {
      const view = await render(storyTree('b0a1d2e3f4a5'));

      // The pill starts disabled; the cached Edition enables it.
      const pill = await waitFor(() => {
        const found = view.getByTestId('share-button');
        expect(found.props.accessibilityState?.disabled).toBe(false);
        return found;
      });

      // The mode rides the same surface (the grilling decision).
      expect(screen.getByTestId('mode-button')).toBeTruthy();

      fireEvent.press(pill);
      // The literal target — the spec's shape over the fixture facts.
      expect(share).toHaveBeenCalledWith({
        url: 'https://leprisme.info/2026-11-10/budget-2027-en-commission/',
      });
    } finally {
      share.mockRestore();
    }
  });

  test('the back pill pops the route', async () => {
    await render(storyTree('b0a1d2e3f4a5'));

    fireEvent.press(screen.getByTestId('back-button'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  test('an id the Edition does not carry keeps the share pill disabled', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    try {
      const view = await render(storyTree('b0a1d2e3f4a5'));

      // Readiness first — disabled must mean « unknown », not « loading ».
      await waitFor(() =>
        expect(
          view.getByTestId('share-button').props.accessibilityState?.disabled,
        ).toBe(false),
      );

      await view.rerender(storyTree('inconnu'));
      const pill = view.getByTestId('share-button');
      expect(pill.props.accessibilityState?.disabled).toBe(true);
      fireEvent.press(pill);
      expect(share).not.toHaveBeenCalled();
    } finally {
      share.mockRestore();
    }
  });
});
