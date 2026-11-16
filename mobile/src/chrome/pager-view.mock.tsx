/**
 * The jest stand-in for react-native-pager-view (issue #197): the
 * native pager shows one page of the JS children at a time, so the
 * mock renders exactly children[page] — initialPage at launch, then
 * whatever the imperative setPage calls or the tests' fired events
 * land on. The contract mirrors the bridge: setPage jumps instantly
 * and delivers onPageSelected on a later tick, never inside the
 * caller's; a swipe's landing is the tests firing the native-side
 * events (state change, page selected) themselves. Wired in
 * package.json's moduleNameMapper.
 */

import {
  forwardRef,
  type ReactNode,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

export type PageScrollState = 'idle' | 'dragging' | 'settling';

export const mockPagerMethods = {
  setPage: jest.fn((page: number): void => mockPagerMethods.jumpAndEcho(page)),
  setPageWithoutAnimation: jest.fn((page: number): void =>
    mockPagerMethods.jumpAndEcho(page),
  ),
  setScrollEnabled: jest.fn(),
  /** The mock's page move — what the native pager does on a setPage. */
  jumpTo: null as null | ((page: number) => void),
  /** The jump plus its bridge echo: onPageSelected on a later task. */
  jumpAndEcho(page: number): void {
    mockPagerMethods.jumpTo?.(page);
    // The bridge delivers onPageSelected after the jump — never inside
    // the caller's tick, and only once the landed page has committed.
    setTimeout(() => {
      mockPagerMethods.emitPageSelected?.({
        nativeEvent: { position: page },
      });
    }, 0);
  },
  /** The registered bridge callbacks — tests fire these to swipe. */
  emitPageSelected: null as
    | null
    | ((event: { nativeEvent: { position: number } }) => void),
  emitStateChanged: null as
    | null
    | ((event: { nativeEvent: { pageScrollState: PageScrollState } }) => void),
};

type PagerProps = {
  initialPage?: number;
  style?: StyleProp<ViewStyle>;
  onPageSelected?: (event: { nativeEvent: { position: number } }) => void;
  onPageScrollStateChanged?: (event: {
    nativeEvent: { pageScrollState: PageScrollState };
  }) => void;
  children?: ReactNode;
};

export const MockPagerView = forwardRef(function MockPagerView(
  props: PagerProps,
  ref,
) {
  const [page, setPage] = useState(props.initialPage ?? 0);
  const pageSelected = useRef(props.onPageSelected);
  pageSelected.current = props.onPageSelected;

  mockPagerMethods.jumpTo = (target: number) => setPage(target);
  // The landed page both moves the pager and notifies the app — the
  // full native event, not just the callback.
  mockPagerMethods.emitPageSelected = (event: {
    nativeEvent: { position: number };
  }) => {
    setPage(event.nativeEvent.position);
    pageSelected.current?.(event);
  };
  mockPagerMethods.emitStateChanged = props.onPageScrollStateChanged ?? null;

  useImperativeHandle(ref, () => ({
    setPage: (target: number) => mockPagerMethods.setPage(target),
    setPageWithoutAnimation: (target: number) =>
      mockPagerMethods.setPageWithoutAnimation(target),
    setScrollEnabled: (enabled: boolean) =>
      mockPagerMethods.setScrollEnabled(enabled),
  }));

  const children = Array.isArray(props.children)
    ? props.children
    : [props.children];
  return <View style={props.style}>{children[page] ?? null}</View>;
});

export default MockPagerView;
