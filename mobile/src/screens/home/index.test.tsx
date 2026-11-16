import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { File } from 'expo-file-system';
import { FlatList } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { mockPagerMethods } from '@/chrome/pager-view.mock';
import fixtureEdition from '@/data/__fixtures__/edition.json';
import fixtureOutlets from '@/data/__fixtures__/outlets.json';
import { editionCacheDirectory } from '@/data/runtime';
import { ModeProvider } from '@/mode/mode';
import { Home } from './index';

// The offline proof (issue #179): the disk cache seeded with the fixture,
// the network down — the app still renders the Edition.
const realFetch = globalThis.fetch;

// The 5a navigation seam: a row tap pushes the story route (#195).
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// The header's mode pill pulls the native sheet and haptics (issue #196).
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

// The home renders the chrome (issue #196): the mode pill needs the
// ModeProvider, the bar the safe-area insets.
function renderHome() {
  return render(
    <ModeProvider>
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 59, bottom: 34, left: 0, right: 0 },
          frame: { x: 0, y: 0, width: 393, height: 852 },
        }}
      >
        <Home />
      </SafeAreaProvider>
    </ModeProvider>,
  );
}

describe('Home', () => {
  it('renders the fixture Edition from the disk cache with no network', async () => {
    await renderHome();

    expect(screen.getByText('À la une')).toBeTruthy();
    // The honesty stamp: the cached artifact's own builtAt, in Paris time.
    expect(await screen.findByText('Dernier point à 14h')).toBeTruthy();
    expect(
      screen.getByText("Le budget 2027 arrive en commission à l'Assemblée"),
    ).toBeTruthy();
    expect(
      screen.getByText('Le cyclone Veda approche des Antilles françaises'),
    ).toBeTruthy();
  });

  it('keeps the rendered Edition when pull-to-refresh fails offline', async () => {
    await renderHome();

    await screen.findByText('Dernier point à 14h');
    fireEvent(screen.getByTestId('stories-brulant'), 'refresh');
    await waitFor(() =>
      expect(
        screen.getByText("Le budget 2027 arrive en commission à l'Assemblée"),
      ).toBeTruthy(),
    );
    expect(screen.getByText('Dernier point à 14h')).toBeTruthy();
  });

  it('pushes the story route when a Brûlant row is tapped (#195)', async () => {
    await renderHome();

    fireEvent.press(
      screen.getByRole('button', {
        name: "Le budget 2027 arrive en commission à l'Assemblée",
      }),
    );
    expect(mockPush).toHaveBeenCalledWith('/story/b0a1d2e3f4a5');
  });

  // The row order, read from the rendered titles (issue #197): the
  // fixture's Brûlant/Top pool and its Nouveau pool differ in order only.
  function rowOrder(): string[] {
    return screen
      .getAllByText(/^(Le budget 2027|Le cyclone Veda)/)
      .map((title) =>
        title.props.children.startsWith('Le budget') ? 'budget' : 'cyclone',
      );
  }

  it('floats the switcher with Brûlant selected at launch (#197)', async () => {
    await renderHome();

    await screen.findByText('Dernier point à 14h');
    expect(rowOrder()).toEqual(['budget', 'cyclone']);
    expect(
      screen.getByTestId('sort-segment-1').props.accessibilityState,
    ).toEqual({ selected: true });
  });

  it('keeps one shared « À la une » block across sorts (#197)', async () => {
    await renderHome();
    await screen.findByText('Dernier point à 14h');

    // The title is not per-page content anymore: one instance, above
    // the pager, untouched by a sort switch.
    expect(screen.getAllByText('À la une')).toHaveLength(1);
    await fireEvent.press(screen.getByTestId('sort-segment-2'));
    expect(screen.getAllByText('À la une')).toHaveLength(1);
    expect(screen.getByText('Dernier point à 14h')).toBeTruthy();
  });

  it('tapping a sort swaps the rows in place (#197)', async () => {
    await renderHome();
    await screen.findByText('Dernier point à 14h');

    await fireEvent.press(screen.getByTestId('sort-segment-2'));
    // Nouveau — pure chronology: the fixture's latestStories order.
    expect(rowOrder()).toEqual(['cyclone', 'budget']);

    await fireEvent.press(screen.getByTestId('sort-segment-0'));
    // Top — the fixture's stories pool: budget back on top.
    expect(rowOrder()).toEqual(['budget', 'cyclone']);
  });

  it('lands the switched list at its top (#197)', async () => {
    const scrollToOffset = jest.spyOn(FlatList.prototype, 'scrollToOffset');
    await renderHome();
    await screen.findByText('Dernier point à 14h');
    scrollToOffset.mockClear();

    await fireEvent.press(screen.getByTestId('sort-segment-2'));
    // The pager's pageSelected echo arrives over the bridge, a task
    // after the jump — the reset rides it (one path for taps/swipes).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(scrollToOffset).toHaveBeenCalledWith({
      offset: 0,
      animated: false,
    });
  });

  it('a tap drives the pager to that sort page (#197)', async () => {
    await renderHome();
    await screen.findByText('Dernier point à 14h');
    mockPagerMethods.setPageWithoutAnimation.mockClear();

    await fireEvent.press(screen.getByTestId('sort-segment-2'));

    expect(mockPagerMethods.setPageWithoutAnimation).toHaveBeenCalledWith(2);
  });

  it('a landing swipe swaps the rows and pairs the control (#197)', async () => {
    await renderHome();
    await screen.findByText('Dernier point à 14h');

    // The native event a swipe emits when page 2 becomes selected —
    // the mock lands the pager there and notifies the app.
    await act(async () => {
      mockPagerMethods.emitPageSelected?.({ nativeEvent: { position: 2 } });
    });

    expect(rowOrder()).toEqual(['cyclone', 'budget']);
    expect(
      screen.getByTestId('sort-segment-2').props.accessibilityState,
    ).toEqual({ selected: true });
    expect(
      screen.getByTestId('sort-segment-1').props.accessibilityState,
    ).toEqual({ selected: false });
  });

  it('the landed page resets only once the pager settles idle (#197)', async () => {
    const scrollToOffset = jest.spyOn(FlatList.prototype, 'scrollToOffset');
    await renderHome();
    await screen.findByText('Dernier point à 14h');
    scrollToOffset.mockClear();

    // The spike's event order: the finger lifts (dragging → settling),
    // the page lands, then the pager goes idle.
    await act(async () => {
      mockPagerMethods.emitStateChanged?.({
        nativeEvent: { pageScrollState: 'dragging' },
      });
      mockPagerMethods.emitStateChanged?.({
        nativeEvent: { pageScrollState: 'settling' },
      });
      mockPagerMethods.emitPageSelected?.({ nativeEvent: { position: 2 } });
    });
    // Mid-settle: no yank.
    expect(scrollToOffset).not.toHaveBeenCalled();

    await act(async () => {
      mockPagerMethods.emitStateChanged?.({
        nativeEvent: { pageScrollState: 'idle' },
      });
    });

    expect(scrollToOffset).toHaveBeenCalledWith({
      offset: 0,
      animated: false,
    });
  });
});
