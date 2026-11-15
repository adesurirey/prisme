/**
 * The Reanimated stand-in for Jest (issue #196): the flip animation on
 * the mode pill needs useSharedValue/useAnimatedStyle and the spring
 * helpers; under Jest they degrade to plain values and passthrough
 * views — the label swap is instant, the pulse never runs. The real
 * package's own mock pulls in react-native-worklets' native module,
 * which cannot load in Jest.
 */

import type { ReactNode } from 'react';

/** A passthrough animated view: renders children, ignores animation. */
function PassthroughView({ children }: { children?: ReactNode }) {
  return children ?? null;
}

type SharedValue<T> = { value: T };

export const reanimatedMock = {
  default: {
    View: PassthroughView,
    createAnimatedComponent: (Component: unknown) => Component,
  },
  View: PassthroughView,
  createAnimatedComponent: (Component: unknown) => Component,

  // Layout animations: no-op descriptors, durations accepted and dropped.
  FadeInDown: { duration: () => ({}) },
  FadeOutUp: { duration: () => ({}) },

  useSharedValue: <T>(initial: T): SharedValue<T> => ({ value: initial }),
  useAnimatedStyle: () => ({}),

  withSequence: (...steps: unknown[]) => steps.at(-1),
  withSpring: (toValue: number) => toValue,
  withTiming: (toValue: number) => toValue,
};
