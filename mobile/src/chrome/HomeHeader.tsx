/**
 * The home header (issue #196): a fixed Frosted bar — « À la une » and
 * the « Dernier point » stamp on the left, the mode pill and the inert
 * burger pill on the right — fading out at its bottom edge with a
 * gradient extension of the glass (expo-linear-gradient). The list
 * scrolls under the glass, Photos-style; the bar exists only on home.
 *
 * The stamp is the artifact's own builtAt, Paris time — the same clock
 * the web shows, reworded for the header's single line. The burger
 * renders but stays inert until 5d wires the drawer.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { Frosted } from './Frosted';
import { GlassPill } from './GlassPill';
import { ModeButton } from './ModeButton';

/** The bar's height below the top inset — the list's first-row offset. */
export const HOME_HEADER_BAR_HEIGHT = 78;

/** The « Dernier point » stamp — the rendered artifact's build instant,
 *  in Paris time like every Prisme date (the clock half of the old
 *  « Mis à jour » stamp, reworded for the header line). */
export function latestPointStamp(builtAt: string): string {
  const clock = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(builtAt))
    .replace(':', 'h');
  return `Dernier point à ${clock}`;
}

function BurgerIcon() {
  const theme = useTheme();
  return (
    <View style={styles.burgerIcon}>
      <View style={[styles.burgerBar, { backgroundColor: theme.ink }]} />
      <View style={[styles.burgerBar, { backgroundColor: theme.ink }]} />
      <View style={[styles.burgerBar, { backgroundColor: theme.ink }]} />
    </View>
  );
}

export function HomeHeader({ builtAt }: { builtAt: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      {/* The scroll-edge frost — a backdrop layer behind the bar. */}
      <Frosted />
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <View style={styles.titles}>
          <Text style={[styles.title, { color: theme.ink }]}>À la une</Text>
          <Text style={[styles.stamp, { color: theme.muted }]}>
            {latestPointStamp(builtAt)}
          </Text>
        </View>
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
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  titles: {
    flexShrink: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  stamp: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
  },
  pills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pill: {
    height: 38,
  },
  burger: {
    width: 38,
    height: 38,
    paddingHorizontal: 0,
  },
  burgerIcon: {
    gap: 4,
  },
  burgerBar: {
    width: 18,
    height: 2,
    borderRadius: 999,
  },
});
