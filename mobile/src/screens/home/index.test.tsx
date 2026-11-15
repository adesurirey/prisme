import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { File } from 'expo-file-system';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
    expect(await screen.findByText('Dernier point à 14h01')).toBeTruthy();
    expect(
      screen.getByText("Le budget 2027 arrive en commission à l'Assemblée"),
    ).toBeTruthy();
    expect(
      screen.getByText('Le cyclone Veda approche des Antilles françaises'),
    ).toBeTruthy();
  });

  it('keeps the rendered Edition when pull-to-refresh fails offline', async () => {
    await renderHome();

    await screen.findByText('Dernier point à 14h01');
    fireEvent(screen.getByTestId('stories'), 'refresh');
    await waitFor(() =>
      expect(
        screen.getByText("Le budget 2027 arrive en commission à l'Assemblée"),
      ).toBeTruthy(),
    );
    expect(screen.getByText('Dernier point à 14h01')).toBeTruthy();
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
});
