/**
 * The story screen's chrome (issue #199): the back pill top-left — the
 * native edge-swipe and the Android back already pop the route (5a) —
 * and top-right the mode pill, then the share pill: the mode keeps the
 * position it holds on the home header (the grilling decision), and the
 * same global Couverture/Exposition mode rides through `useMode`.
 *
 * The share pill offers the story's public page — the URL the screen
 * builds from the Edition snapshot. iOS shares the URL itself; Android
 * carries it as the `message`: RN 0.88's Android chooser reads only
 * `message`/`title`, so a `url`-only share opens the chooser empty.
 *
 * The icons are SF Symbols through expo-symbols; Android has no SF
 * Symbols, so a plain-text glyph rides in the library's own `fallback`
 * — the burger tile's pattern (issue #198).
 */

import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { GlassPill } from './GlassPill';
import { HOME_TITLE_TOP_PADDING } from './HomeHeader';
import { ModeButton } from './ModeButton';

function PillIcon({ symbol, glyph }: { symbol: string; glyph: string }) {
  const theme = useTheme();
  return (
    <SymbolView
      name={symbol as never}
      size={20}
      weight="semibold"
      tintColor={theme.ink}
      fallback={
        <View style={styles.glyphBox}>
          <Text style={[styles.glyph, { color: theme.ink }]}>{glyph}</Text>
        </View>
      }
    />
  );
}

export function StoryHeader({
  onBack,
  shareUrl,
}: {
  onBack: () => void;
  /** The story's public page URL; null while no Story resolved — the
   *  pill is disabled (the chrome renders before the data lands). */
  shareUrl: string | null;
}) {
  const insets = useSafeAreaInsets();
  const top = insets.top + HOME_TITLE_TOP_PADDING;

  const share = () => {
    if (shareUrl == null) return;
    // Fire-and-forget: a dismissal still resolves; a failure never
    // crashes the screen.
    void Share.share(
      Platform.OS === 'android' ? { message: shareUrl } : { url: shareUrl },
    ).catch(() => undefined);
  };

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[styles.edge, styles.leftEdge, { top }]}
      >
        <GlassPill
          accessibilityLabel="Retour"
          testID="back-button"
          onPress={onBack}
          style={styles.square}
        >
          <PillIcon symbol="chevron.left" glyph="‹" />
        </GlassPill>
      </View>
      <View
        pointerEvents="box-none"
        style={[styles.edge, styles.rightEdge, { top }]}
      >
        {/* The mode pill rides at its home size — height only, the
            intrinsic width: the square would clip « Couv. » into a
            circle (simulator feedback, issue #199). */}
        <ModeButton style={styles.pill} />
        <GlassPill
          accessibilityLabel="Partager"
          testID="share-button"
          disabled={shareUrl == null}
          onPress={share}
          style={styles.square}
        >
          <PillIcon symbol="square.and.arrow.up" glyph="↑" />
        </GlassPill>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    // Same row the home pills ride — centered on the cap line.
    height: 36,
  },
  leftEdge: { paddingLeft: 20 },
  rightEdge: {
    justifyContent: 'flex-end',
    paddingRight: 20,
    gap: 10,
  },
  pill: {
    height: 44,
  },
  square: {
    width: 44,
    height: 44,
    paddingHorizontal: 0,
  },
  glyphBox: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 20,
  },
});
