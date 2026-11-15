/**
 * The home chrome (issue #196): the pills — mode, then the inert
 * burger — pinned top-right in a totally transparent overlay. The
 * « À la une » title and the « Dernier point » stamp are not chrome:
 * they live in the scroll content (the home list's header component),
 * so they sit at the same spot on open and scroll away with it.
 */

import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { GlassPill } from './GlassPill';
import { ModeButton } from './ModeButton';

/** The title block's height below its top padding — title, gap, stamp.
 *  Shared with the home screen so the pills center on the same block
 *  the content renders. */
export const HOME_TITLE_BLOCK_HEIGHT = 56;

/** The title block's top padding — where « À la une » starts. */
export const HOME_TITLE_TOP_PADDING = 6;

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

export function HomeHeader() {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.overlay, { top: insets.top + HOME_TITLE_TOP_PADDING }]}
    >
      {/* Same row as the title block, right-aligned — the pills center
          on the title exactly where the old bar put them. */}
      <View style={styles.pills}>
        {/* Same 38pt height as the burger — the Photos pair. */}
        <ModeButton style={styles.pill} />
        <GlassPill
          accessibilityLabel="Menu"
          testID="burger-button"
          disabled
          onPress={() => undefined}
          style={styles.burger}
        >
          <BurgerIcon />
        </GlassPill>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
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
