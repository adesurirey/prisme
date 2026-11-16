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
import { HOME_TITLE_TOP_PADDING } from './HomeHeader';
import { PrismeWordmark } from './PrismeWordmark';

// The wordmark rides the same line as the page's burger pill (issue
// #198, the ChatGPT model): the header's pills row is 36pt high and
// centers its 44pt pills, so that center sits at
// insets.top + HOME_TITLE_TOP_PADDING + 18. The wordmark row is the
// pill's own 44pt and starts 4pt higher to share the exact center.
const WORDMARK_ROW_OFFSET = HOME_TITLE_TOP_PADDING - 4;

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
          backgroundColor: theme.canvas,
          paddingTop: insets.top + WORDMARK_ROW_OFFSET,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <View style={styles.wordmarkRow}>
        {/* The title of the tile — sized like the ChatGPT model's header
            title, well above the nav-scale default (issue #198); the
            140 was dialed back 15% on simulator feedback. */}
        <PrismeWordmark color={theme.ink} width={119} />
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
  wordmarkRow: {
    // The pill's own height — the wordmark centers on the burger's
    // exact line (see WORDMARK_ROW_OFFSET above). The column's main
    // axis is vertical: justifyContent centers the wordmark on that
    // line; alignItems would have centered it across the tile — the
    // previous pass's mistake.
    height: 44,
    justifyContent: 'center',
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
