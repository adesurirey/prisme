import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { File } from 'expo-file-system';

import fixtureEdition from '@/data/__fixtures__/edition.json';
import fixtureOutlets from '@/data/__fixtures__/outlets.json';
import { editionCacheDirectory } from '@/data/runtime';

import { Home } from './index';

// The offline proof (issue #179): the disk cache seeded with the fixture,
// the network down — the app still renders the Edition.
const realFetch = globalThis.fetch;

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

describe('Home', () => {
  it('renders the fixture Edition from the disk cache with no network', async () => {
    await render(<Home />);

    expect(screen.getByText('Prisme')).toBeTruthy();
    // The honesty stamp: the cached artifact's own builtAt, in Paris time.
    expect(
      await screen.findByText('Mis à jour le 11 novembre à 14h01'),
    ).toBeTruthy();
    expect(
      screen.getByText("Le budget 2027 arrive en commission à l'Assemblée"),
    ).toBeTruthy();
    expect(
      screen.getByText('Le cyclone Veda approche des Antilles françaises'),
    ).toBeTruthy();
  });

  it('keeps the rendered Edition when pull-to-refresh fails offline', async () => {
    await render(<Home />);

    await screen.findByText('Mis à jour le 11 novembre à 14h01');
    fireEvent(screen.getByTestId('stories'), 'refresh');
    await waitFor(() =>
      expect(
        screen.getByText("Le budget 2027 arrive en commission à l'Assemblée"),
      ).toBeTruthy(),
    );
    expect(screen.getByText('Mis à jour le 11 novembre à 14h01')).toBeTruthy();
  });
});
