import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { DEFAULT_SORT_INDEX, SORTS } from '@/sorts';

import { SortSwitcher } from './SortSwitcher';

// The #197 seams: the control reads the SORTS order with Brûlant
// selected at launch, and reports taps as the segment's index. The
// native control's labels never exist in the JS tree — Jest sees the
// platform mock (package.json moduleNameMapper).

function renderSwitcher() {
  // RTL v14's render is async — awaited before any screen query.
  return render(
    <SortSwitcher index={DEFAULT_SORT_INDEX} onSwitch={() => undefined} />,
  );
}

// The rendered labels, in order — the mock's Text children.
function renderedLabels(): string[] {
  return screen
    .getAllByText(/^(Top|Brûlant|Tous)$/)
    .map((label) => label.props.children);
}

describe('SortSwitcher (issue #197)', () => {
  test('renders the sorts in order — Top | Brûlant | Tous', async () => {
    await renderSwitcher();

    expect(renderedLabels()).toEqual(SORTS.map((sort) => sort.label));
  });

  test('Brûlant is selected at launch — DEFAULT_SORT_INDEX', async () => {
    await renderSwitcher();

    expect(
      screen.getByTestId(`sort-segment-${DEFAULT_SORT_INDEX}`).props
        .accessibilityState,
    ).toEqual({ selected: true });
    expect(
      screen.getByTestId('sort-segment-0').props.accessibilityState,
    ).toEqual({ selected: false });
  });

  test('tapping a segment reports its index', async () => {
    const onSwitch = jest.fn();
    await render(
      <SortSwitcher index={DEFAULT_SORT_INDEX} onSwitch={onSwitch} />,
    );

    await fireEvent.press(screen.getByTestId('sort-segment-0'));
    await fireEvent.press(screen.getByTestId('sort-segment-2'));

    expect(onSwitch.mock.calls).toEqual([[0], [2]]);
  });

  test('on Android the fallback marks the selected segment', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      await renderSwitcher();

      // Same labels, same order — the pill on the selected segment is
      // the fallback's selected mark.
      expect(renderedLabels()).toEqual(['Top', 'Brûlant', 'Tous']);
      expect(
        screen.getByTestId('sort-segment-1').props.accessibilityState,
      ).toEqual({ selected: true });
      expect(
        screen.getByTestId('sort-segment-2').props.accessibilityState,
      ).toEqual({ selected: false });
    } finally {
      os.restore();
    }
  });
});
