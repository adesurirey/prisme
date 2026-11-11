import type { Edition, Outlet } from '@prisme/domain';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import fixtureEdition from './__fixtures__/edition.json';
import fixtureOutlets from './__fixtures__/outlets.json';
import type { EditionClient, EditionSnapshot } from './edition-client';
import { useEdition } from './use-edition';

const cachedSnapshot: EditionSnapshot = {
  edition: fixtureEdition as unknown as Edition,
  outlets: fixtureOutlets as unknown as Outlet[],
  builtAt: fixtureEdition.builtAt,
};

const rebuiltSnapshot: EditionSnapshot = {
  ...cachedSnapshot,
  builtAt: '2026-11-11T15:00:00.000Z',
};

function fakeClient(
  overrides: Partial<Pick<EditionClient, 'readCache' | 'revalidate'>>,
): EditionClient {
  return {
    readCache: jest.fn().mockResolvedValue(null),
    revalidate: jest
      .fn()
      .mockResolvedValue({ kind: 'unavailable', error: new Error('unset') }),
    ...overrides,
  } as unknown as EditionClient;
}

describe('useEdition', () => {
  it('goes loading → ready when a cold open fetches a fresh artifact', async () => {
    const client = fakeClient({
      revalidate: jest.fn().mockResolvedValue({
        kind: 'fresh',
        snapshot: cachedSnapshot,
      }),
    });

    const { result } = await renderHook(() => useEdition(client));

    await waitFor(() => expect(result.current.phase.status).toBe('ready'));
    if (result.current.phase.status !== 'ready') return;
    expect(result.current.phase.snapshot.builtAt).toBe(fixtureEdition.builtAt);
    expect(client.revalidate).toHaveBeenCalledTimes(1);
  });

  it('renders the disk cache instantly, then keeps it on 304', async () => {
    const client = fakeClient({
      readCache: jest.fn().mockResolvedValue(cachedSnapshot),
      revalidate: jest.fn().mockResolvedValue({
        kind: 'unchanged',
        snapshot: cachedSnapshot,
      }),
    });

    const { result } = await renderHook(() => useEdition(client));

    await waitFor(() => expect(result.current.phase.status).toBe('ready'));
    expect(client.readCache).toHaveBeenCalledTimes(1);
    if (result.current.phase.status !== 'ready') return;
    expect(result.current.phase.snapshot.builtAt).toBe(fixtureEdition.builtAt);
  });

  it('keeps the last good artifact when revalidation fails', async () => {
    const client = fakeClient({
      readCache: jest.fn().mockResolvedValue(cachedSnapshot),
      revalidate: jest.fn().mockResolvedValue({
        kind: 'kept',
        snapshot: cachedSnapshot,
        error: new Error('plane mode'),
      }),
    });

    const { result } = await renderHook(() => useEdition(client));

    await waitFor(() => expect(result.current.phase.status).toBe('ready'));
    // One extra render cycle for the failed background revalidation.
    await act(async () => {});
    expect(result.current.phase.status).toBe('ready');
    if (result.current.phase.status !== 'ready') return;
    expect(result.current.phase.snapshot.builtAt).toBe(fixtureEdition.builtAt);
  });

  it('lands on error when a cold open has nothing to render', async () => {
    const client = fakeClient({
      revalidate: jest.fn().mockResolvedValue({
        kind: 'unavailable',
        error: new Error('plane mode'),
      }),
    });

    const { result } = await renderHook(() => useEdition(client));

    await waitFor(() => expect(result.current.phase.status).toBe('error'));
  });

  it('pull-to-refresh forces a round and renders what it brings back', async () => {
    const client = fakeClient({
      revalidate: jest.fn().mockResolvedValue({
        kind: 'fresh',
        snapshot: rebuiltSnapshot,
      }),
    });
    const { result } = await renderHook(() => useEdition(client));
    await waitFor(() => expect(result.current.phase.status).toBe('ready'));

    await act(async () => {
      await result.current.refresh();
    });

    expect(client.revalidate).toHaveBeenCalledWith({ force: true });
    if (result.current.phase.status !== 'ready') return;
    expect(result.current.phase.snapshot.builtAt).toBe(
      '2026-11-11T15:00:00.000Z',
    );
    expect(result.current.refreshing).toBe(false);
  });

  it('a failed refresh keeps the rendered artifact and lowers the spinner', async () => {
    const client = fakeClient({
      readCache: jest.fn().mockResolvedValue(cachedSnapshot),
      revalidate: jest.fn().mockResolvedValue({
        kind: 'kept',
        snapshot: cachedSnapshot,
        error: new Error('plane mode'),
      }),
    });
    const { result } = await renderHook(() => useEdition(client));
    await waitFor(() => expect(result.current.phase.status).toBe('ready'));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.phase.status).toBe('ready');
    if (result.current.phase.status !== 'ready') return;
    expect(result.current.phase.snapshot.builtAt).toBe(fixtureEdition.builtAt);
    expect(result.current.refreshing).toBe(false);
  });
});
