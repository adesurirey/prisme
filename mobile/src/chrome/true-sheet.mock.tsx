/**
 * The TrueSheet stand-in for Jest (issue #196): children render in a
 * plain View and the ref methods are recorded Jest fns, so tests drive
 * and assert the sheet through its public interface — present, dismiss,
 * resize — without the native module. Each test file swaps this in with
 * jest.mock before ModeButton's import of the real module resolves.
 */

import type {
  TrueSheetMethods,
  TrueSheetProps,
} from '@lodev09/react-native-true-sheet';
import { forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';

/** The recorded imperative methods a test can assert against. */
export const mockTrueSheetMethods: TrueSheetMethods = {
  present: jest.fn(async () => undefined),
  dismiss: jest.fn(async () => undefined),
  resize: jest.fn(async () => undefined),
  dismissStack: jest.fn(async () => undefined),
};

export const MockTrueSheet = forwardRef<TrueSheetMethods, TrueSheetProps>(
  function MockTrueSheet(props, ref) {
    useImperativeHandle(ref, () => mockTrueSheetMethods);
    return <View testID="true-sheet">{props.children}</View>;
  },
);
