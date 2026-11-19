/**
 * The burger tile's content (issue #198): the Prisme wordmark on top,
 * then one row per static route — a tap closes the drawer and pushes
 * the route. The icons are lucide-react-native — the unified icon
 * language both platforms share (user decision on #199): typed
 * per-icon components, tinted `theme.ink`, no SF Symbols and no
 * fallback glyphs.
 *
 * The tile appears with the drawer's own progress: it zooms in from
 * 98% and rises 6pt as it fades in, one step behind the page sliding
 * away — the model's sense of depth. The scale lives on an inner
 * wrapper, never on the root that paints the canvas: the library's
 * drawer container is hardcoded white, and a scaled root would flash
 * a white frame around it.
 */

import { useRouter } from 'expo-router';
import {
  ChartColumn,
  CircleHelp,
  Share as ShareIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDrawerProgress } from 'react-native-drawer-layout';
import Reanimated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { GlassPill } from './GlassPill';
import { HOME_TITLE_TOP_PADDING } from './HomeHeader';
import { PrismeWordmark } from './PrismeWordmark';
import { shareLink } from './share';

// The wordmark rides the same line as the page's burger pill (issue
// #198, the ChatGPT model): the header's pills row is 36pt high and
// centers its 44pt pills, so that center sits at
// insets.top + HOME_TITLE_TOP_PADDING + 18. The wordmark row is the
// pill's own 44pt and starts 4pt higher to share the exact center.
const WORDMARK_ROW_OFFSET = HOME_TITLE_TOP_PADDING - 4;

// The site the tile shares — the brand's front door, not a route.
const SITE_URL = 'https://leprisme.info';

const TILES = [
  {
    route: '/classement',
    label: 'Classement des médias',
    // The spectrum chart the page will draw (#183).
    Icon: ChartColumn,
  },
  {
    route: '/methode',
    label: 'Comment ça marche',
    Icon: CircleHelp,
  },
] as const;

export function BurgerTile({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useDrawerProgress();
  const appear = useAnimatedStyle(() => ({
    // Short travel on purpose: the content settles into place from just
    // past its own edge — a long fade/rise reads as arriving from
    // nowhere (issue #198).
    opacity: interpolate(progress.value, [0, 1], [0.7, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [0.98, 1],
          Extrapolation.CLAMP,
        ),
      },
      // The rise: the zoom pivots on the tile's bottom-left corner, so
      // the content reads as growing out of it, upward (issue #198).
      {
        translateY: interpolate(
          progress.value,
          [0, 1],
          [2, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

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
      <Reanimated.View style={[styles.tileContent, appear]}>
        <View style={styles.wordmarkRow}>
          {/* The tile's title — sized like the ChatGPT model's header
              title (issue #198): 140pt dialed back 15% on simulator
              feedback. */}
          <PrismeWordmark color={theme.ink} width={119} />
          {/* The share pill rides the wordmark's line, top right —
              the same glass square as the screens' header pills. */}
          <GlassPill
            accessibilityLabel="Partager leprisme.info"
            testID="share-site-button"
            onPress={() => shareLink(SITE_URL)}
            style={styles.sharePill}
          >
            <ShareIcon size={20} strokeWidth={2} color={theme.ink} />
          </GlassPill>
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
              <tile.Icon size={20} strokeWidth={2} color={theme.ink} />
              <Text
                numberOfLines={1}
                style={[styles.label, { color: theme.ink }]}
              >
                {tile.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Reanimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
  },
  tileContent: {
    flex: 1,
    // The zoom pivots on the tile's bottom-right corner — the corner
    // nearest the card's rounded edge — instead of the flat center.
    transformOrigin: '0 100% 0',
  },
  wordmarkRow: {
    // The burger pill's own 44pt row — the wordmark and the share
    // pill center on the burger's exact line (WORDMARK_ROW_OFFSET).
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  sharePill: {
    width: 44,
    height: 44,
    paddingHorizontal: 0,
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
    // flex: 1 caps the label to the row's remaining width (past the
    // icon), so long labels ellipsize instead of pushing past the
    // tile's edge; numberOfLines adds the ellipsis.
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
  },
});
