/**
 * The home chrome (issue #196, amended): the « À la une » title and the
 * « Dernier point » stamp are fixed chrome now — pinned to the top of
 * the screen instead of scrolling away with the list — over a frost
 * that continues the status bar's material and melts out below the
 * title block. The blur is what keeps the header text legible: the
 * rows scroll under it and smear into the material instead of printing
 * through the letters. The melt is a gradient mask over the frost
 * (MaskedView + LinearGradient) — BlurView alone draws a hard bottom
 * edge, a scroll edge must fade. The pills — mode, then the burger —
 * stay pinned top-right, centered on the title line exactly where the
 * original overlay put them; the burger opens the drawer tile (issue
 * #198).
 */

import MaskedViewPkg from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentType, ReactElement } from 'react';
import { Platform, StyleSheet, Text, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { Frosted } from './Frosted';
import { GlassPill } from './GlassPill';
import { ModeButton } from './ModeButton';

// The lib declares its class through a NativeMethods mixin that TS 6's
// JSX element typing rejects (same cast as the segmented control);
// the runtime value is the real native-wrapped component.
const MaskedView = MaskedViewPkg as ComponentType<
  ViewProps & { maskElement: ReactElement }
>;

/** The title block's height below its top padding — title, gap, stamp.
 *  Shared with the screens so their content starts below the block. */
export const HOME_TITLE_BLOCK_HEIGHT = 56;

/** The title block's top padding — where « À la une » starts. */
export const HOME_TITLE_TOP_PADDING = 6;

// How far the frost keeps melting below the title block — the ramp
// from full material under the text down to none. Android's solid
// canvas reads as a shelf edge over the material's own 24pt ramp —
// it melts more than twice as far before meeting the list.
const HOME_FROST_FADE = Platform.OS === 'android' ? 56 : 24;

function BurgerIcon() {
  const theme = useTheme();
  // Two bars — the Gemini-style menu mark, quieter than the classic three.
  return (
    <View style={styles.burgerIcon}>
      <View style={[styles.burgerBar, { backgroundColor: theme.ink }]} />
      <View style={[styles.burgerBar, { backgroundColor: theme.ink }]} />
    </View>
  );
}

export function HomeHeader({
  stamp,
  onOpenMenu,
}: {
  /** The « Dernier point » line under the title — the rendered
   *  artifact's build instant, formatted by the caller. */
  stamp?: string;
  onOpenMenu?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  // The frost column: screen-top (it continues the status bar's
  // material) through the title block, plus the melt ramp below it.
  const blockEnd =
    insets.top + HOME_TITLE_TOP_PADDING + HOME_TITLE_BLOCK_HEIGHT;
  const frostHeight = blockEnd + HOME_FROST_FADE;

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      {/* The status-bar frost continued down past the title, melting
          out over the ramp. The gradient mask holds the material fully
          opaque through the title block and fades it to nothing; the
          whole layer is pointer-none — the list beneath stays live. */}
      <MaskedView
        pointerEvents="none"
        style={[styles.frost, { height: frostHeight }]}
        maskElement={
          <LinearGradient
            colors={['black', 'black', 'transparent']}
            locations={[0, blockEnd / frostHeight, 1]}
            style={StyleSheet.absoluteFill}
          />
        }
      >
        <Frosted />
      </MaskedView>

      {/* The title block, fixed — the same spot it occupied at rest
          when it was list content (issue #196); only the scroll-away
          is gone. Pointer-none: rows under it stay tappable. */}
      <View
        pointerEvents="none"
        style={{ paddingTop: insets.top + HOME_TITLE_TOP_PADDING }}
      >
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: theme.ink }]}>À la une</Text>
          {stamp != null && (
            <Text style={[styles.stamp, { color: theme.ink }]}>{stamp}</Text>
          )}
        </View>
      </View>

      {/* Same row as the title block, right-aligned — the pills center
          on the title exactly where the old bar put them. */}
      <View
        pointerEvents="box-none"
        style={[styles.pillsRow, { top: insets.top + HOME_TITLE_TOP_PADDING }]}
      >
        <View style={styles.pills}>
          {/* Same 38pt height as the burger — the Photos pair. */}
          <ModeButton style={styles.pill} />
          <GlassPill
            accessibilityLabel="Menu"
            testID="burger-button"
            disabled={!onOpenMenu}
            onPress={() => onOpenMenu?.()}
            style={styles.burger}
          >
            <BurgerIcon />
          </GlassPill>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  frost: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  titleBlock: {
    height: HOME_TITLE_BLOCK_HEIGHT,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  stamp: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '600',
  },
  pillsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'flex-end',
  },
  pills: {
    flexDirection: 'row',
    alignItems: 'center',
    // Centered on the title line only, not the whole title+stamp block —
    // the Photos pair rides at the title's cap level, not below it.
    height: 36,
    paddingRight: 20,
    gap: 10,
  },
  pill: {
    height: 44,
  },
  burger: {
    width: 44,
    height: 44,
    paddingHorizontal: 0,
  },
  burgerIcon: {
    gap: 6,
  },
  burgerBar: {
    width: 20,
    height: 2,
    borderRadius: 999,
  },
});
