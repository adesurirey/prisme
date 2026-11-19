/**
 * The screen chrome (issue #199): the back pill top-left — the
 * native edge-swipe and the Android back already pop the route (5a) —
 * and top-right the mode pill, then the share pill: the mode keeps the
 * position it holds on the home header, and the same global
 * Couverture/Exposition mode rides through `useMode`.
 *
 * The share pill offers the story's public page — the URL the screen
 * builds from the Edition snapshot (the share seam itself lives in
 * share.ts).
 *
 * The icons are lucide-react-native — the unified icon language both
 * platforms share (user decision on #199): typed per-icon components,
 * tinted `theme.ink` like every other surface — no SF Symbols, no
 * fallback glyphs.
 */

import {
  ArrowLeft,
  ChevronLeft,
  Share as LucideShare,
  Share2,
} from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { GlassPill } from './GlassPill';
import { HOME_TITLE_TOP_PADDING } from './HomeHeader';
import { ModeButton } from './ModeButton';
import { shareLink } from './share';

function BackIcon() {
  const theme = useTheme();
  // Material's arrow back on Android — the chevron is iOS's idiom;
  // lucide's shared stroke language on both (issue #199).
  const Glyph = Platform.OS === 'android' ? ArrowLeft : ChevronLeft;
  return <Glyph size={20} strokeWidth={2} color={theme.ink} />;
}

function ShareIcon() {
  const theme = useTheme();
  // Material's connected-dots share on Android; lucide's Share is the
  // iOS sheet glyph.
  const Glyph = Platform.OS === 'android' ? Share2 : LucideShare;
  return <Glyph size={20} strokeWidth={2} color={theme.ink} />;
}

export function ScreenHeader({
  onBack,
  shareUrl,
  mode = false,
}: {
  onBack: () => void;
  /** The page's public URL; null while nothing resolves — the pill is
   *  disabled (the chrome renders before the data lands). */
  shareUrl: string | null;
  /** The reading-mode pill — the story screen only (issue #199): on
   *  the static pages nothing on screen reads the mode. */
  mode?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const top = insets.top + HOME_TITLE_TOP_PADDING;

  const share = () => {
    if (shareUrl != null) shareLink(shareUrl);
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
          <BackIcon />
        </GlassPill>
      </View>
      <View
        pointerEvents="box-none"
        style={[styles.edge, styles.rightEdge, { top }]}
      >
        {/* The mode pill rides at its home size — height only, the
            intrinsic width: the square would clip « Couv. » into a
            circle (simulator feedback, issue #199). The story screen
            alone opts in. */}
        {mode && <ModeButton style={styles.pill} />}
        <GlassPill
          accessibilityLabel="Partager"
          testID="share-button"
          disabled={shareUrl == null}
          onPress={share}
          style={styles.square}
        >
          <ShareIcon />
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
});
