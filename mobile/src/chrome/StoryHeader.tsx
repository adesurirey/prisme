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
 * The icons are lucide-react-native — the unified icon language both
 * platforms share (user decision on #199, amending the #198
 * plain-text-fallback note): typed per-icon components, tinted
 * `theme.ink` like every other surface — no SF Symbols, no fallback
 * glyphs.
 */

import { ChevronLeft, Share2 } from 'lucide-react-native';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { GlassPill } from './GlassPill';
import { HOME_TITLE_TOP_PADDING } from './HomeHeader';
import { ModeButton } from './ModeButton';

function BackIcon() {
  const theme = useTheme();
  return <ChevronLeft size={20} strokeWidth={2} color={theme.ink} />;
}

function ShareIcon() {
  const theme = useTheme();
  return <Share2 size={20} strokeWidth={2} color={theme.ink} />;
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
          <BackIcon />
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
