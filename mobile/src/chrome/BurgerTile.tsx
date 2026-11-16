/**
 * The burger tile's content (issue #198): the Prisme wordmark on top,
 * then one row per static route — a tap closes the drawer and pushes
 * the route. The icons are SF Symbols through expo-symbols; Android
 * has no SF Symbols, so a plain-text glyph rides in the library's own
 * `fallback` (a string name never resolves on Android — Material
 * glyphs stay out, the ticket pins the plain text).
 */

import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { PrismeWordmark } from './PrismeWordmark';

const TILES = [
  {
    route: '/classement',
    label: 'Classement politique des médias',
    // The spectrum chart the page will draw (#183).
    symbol: 'chart.bar.fill',
    glyph: '≡',
  },
  {
    route: '/methode',
    label: 'Comment ça marche',
    symbol: 'questionmark.circle',
    glyph: '?',
  },
] as const;

export function BurgerTile({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: theme.tile,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <View style={styles.wordmark}>
        {/* The title of the tile — sized like the ChatGPT model's header
            title, well above the nav-scale default (issue #198). */}
        <PrismeWordmark color={theme.ink} width={140} />
      </View>
      <View style={styles.rows}>
        {TILES.map((tile) => (
          <Pressable
            key={tile.route}
            accessibilityRole="button"
            // The glyph rides in the icon, not the announced name.
            accessibilityLabel={tile.label}
            onPress={() => {
              onClose();
              router.push(tile.route);
            }}
            style={styles.row}
          >
            <SymbolView
              name={tile.symbol}
              size={20}
              weight="semibold"
              tintColor={theme.ink}
              fallback={
                <View style={styles.glyphBox}>
                  <Text style={[styles.glyph, { color: theme.ink }]}>
                    {tile.glyph}
                  </Text>
                </View>
              }
            />
            <Text style={[styles.label, { color: theme.ink }]}>
              {tile.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
  },
  wordmark: {
    paddingHorizontal: 24,
  },
  rows: {
    marginTop: 36,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
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
