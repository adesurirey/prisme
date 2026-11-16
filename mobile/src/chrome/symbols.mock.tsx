/**
 * The jest stand-in for expo-symbols (issue #198): the real SymbolView
 * draws SF Symbols through a native view on iOS and through a Material
 * font on Android — neither loads in Jest. The mock mirrors the
 * library's own contract: with no symbol resolvable, `fallback` is
 * what renders — which is precisely the tile's Android path (a plain
 * string name gives Android the fallback, never a Material glyph).
 * Wired in package.json's moduleNameMapper.
 */

import { Fragment } from 'react';

/** The fields the tile hands the symbol view — hand-written, the
 * moduleNameMapper precedents don't import types from the module they
 * stand in for. */
type MockSymbolProps = {
  fallback?: React.ReactNode;
};

export function MockSymbolView(props: MockSymbolProps) {
  return <Fragment>{props.fallback ?? null}</Fragment>;
}

export const SymbolView = MockSymbolView;
