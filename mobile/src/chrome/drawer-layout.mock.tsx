/**
 * The jest stand-in for react-native-drawer-layout (issue #198): the
 * real Drawer is a controlled component — the tile shows exactly when
 * the `open` prop is true, above the always-mounted main — so the mock
 * renders the same contract in a plain View and records the latest
 * props, where tests assert the pinned shape (right, back, 78 %, dim).
 * The native pan, the scrim press and the dim live natively; they are
 * device-verified, not unit-tested. `useDrawerProgress` rests at 0 —
 * the page-card rounding the home derives from it collapses to zero.
 * Wired in package.json's moduleNameMapper.
 */

import type { ReactNode } from 'react';
import { View } from 'react-native';

/** The drawer shape the tests pin — the fields the assertions read. */
export type MockDrawerProps = {
  open?: boolean;
  drawerPosition?: string;
  drawerType?: string;
  drawerStyle?: unknown;
  overlayStyle?: unknown;
  renderDrawerContent?: () => ReactNode;
  children?: ReactNode;
};

/** The latest recorded props — the pinned drawer shape lives here. */
export const mockDrawerMethods = {
  props: null as MockDrawerProps | null,
};

export function MockDrawer(props: MockDrawerProps) {
  mockDrawerMethods.props = props;
  return (
    <View>
      <View testID="drawer-main">{props.children}</View>
      {props.open ? (
        <View testID="drawer-tile">{props.renderDrawerContent?.()}</View>
      ) : null}
    </View>
  );
}

export const Drawer = MockDrawer;

/** The progress shared value, closed — the home's animated page-card
 * style reads it; in Jest the Reanimated mock collapses that style. */
export const useDrawerProgress = (): { value: number } => ({ value: 0 });
