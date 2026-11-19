import type { Story } from '@prisme/domain';
import { useRouter } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Drawer, useDrawerProgress } from 'react-native-drawer-layout';
import type {
  PagerViewOnPageSelectedEvent,
  PageScrollStateChangedNativeEvent,
} from 'react-native-pager-view';
import PagerView from 'react-native-pager-view';
import Reanimated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Native-driven onScroll on a FlatList requires the Animated wrapper.
// createAnimatedComponent drops the generic — cast the result back so
// pages, refs and renderItem keep their Story typing.
const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList,
) as unknown as typeof FlatList;

import { BurgerTile } from '@/chrome/BurgerTile';
import {
  HOME_TITLE_BLOCK_HEIGHT,
  HOME_TITLE_TOP_PADDING,
  HomeHeader,
} from '@/chrome/HomeHeader';
import { SortSwitcher } from '@/chrome/SortSwitcher';
import { useEdition } from '@/data/use-edition';
import { DEFAULT_SORT_INDEX, SORTS, sortLists } from '@/sorts';
import { useTheme } from '@/theme';

// The data-layer proof surface (issue #179): the Edition client drives the
// home — disk cache rendered instantly, revalidated in the background,
// pull-to-refresh forcing a round. The title and stamp are fixed chrome
// now (amending #196): pinned in HomeHeader over a melting frost, and
// the lists scroll under it. Rows are raw title buttons pushing
// the story route (#195); cards land in #181.
// The sorts are pages of one pager (issue #197, amended by the challenge
// comment): a tap on the switcher stays the primary jump, a swipe walks
// the pages, and the landed page resets to its top only once the pager
// settles idle — the spike #192 landmine (scroll-to-top mid-settle
// yanks the page under the finger).
// The burger tile is the drawer (issue #198): the loaded home wraps in
// the standalone right-hand drawer, back type — the page slides aside
// over the dimmed tile. Only the home: story and static pushes stay
// untouched above it.

// The corner radius the sliding page rounds to while the tile is
// open — the card edge of the ChatGPT model (issue #198), measured
// off the reference: the arc eats a third of the visible strip.
const PAGE_CARD_RADIUS = 62;

// How far the light-reflection wash goes at full open (issue #198):
// the content never disappears, it recedes into the paper.
const PAGE_WASH_MAX = 0.4;

/** The « Dernier point » stamp — the rendered artifact's build instant,
 *  hour only, in Paris time like every Prisme date: the point is hourly,
 *  the minutes are noise. */
export function latestPointStamp(builtAt: string): string {
  const clock = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(builtAt))
    .replace(':', 'h')
    .replace(/h\d+$/, 'h');
  return `Dernier point à ${clock}`;
}

/**
 * The sliding page's card treatment (issue #198, the ChatGPT model):
 * the tile waits behind the page on the same canvas — and as the
 * drawer opens the page's leading edge rounds off, casts a soft drop
 * shadow onto the tile and washes lighter — a sheet of the surface
 * token fading in over everything, so the page reads a step lighter
 * than the tile behind it, opaque card beneath, no see-through. The
 * base is the shared canvas on purpose: the palette's canvas→surface
 * step is invisible in light (~3% luminance) but stark in dark (~70%),
 * so a surface-painted page read as a different screen, not a lifted
 * one. Full-bleed again when closed. Two
 * surfaces, each with one job, and one RN constraint that pins the
 * split: a shadow only renders from the shadow view's own opaque
 * background plus a radius committed to the shadow tree — an animated
 * radius never commits (the first ghost), and a transparent caster
 * alpha-composites its native subtree into square artifacts (the
 * second). So the outer carries the opaque canvas background, the
 * static radius and the shadow; the inner mask clips the content to
 * the same rounding. Reads the drawer's
 * progress context, so it mounts strictly inside <Drawer> — the
 * home's own body sits above that provider.
 */
function PageCard({
  background,
  wash,
  children,
}: {
  background: string;
  wash: string;
  children: ReactNode;
}) {
  const progress = useDrawerProgress();
  // Paint props only on the outer surface: Reanimated skips committing
  // animated paint styles to the shadow tree (the library's own FIXME),
  // so an animated borderRadius here left UIKit drawing the shadow from
  // a radius-0 square path — the corner ghost. The radius lives as a
  // static style instead (committed once, path always rounded); only
  // the shadow intensity animates. The card itself is opaque canvas;
  // the open-state lift is the surface sheet layered over it — never a
  // translucent card, which would show the drawer through.
  const shadow = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(
      progress.value,
      [0, 1],
      [0, 0.16],
      Extrapolation.CLAMP,
    ),
  }));
  // The light-reflection wash (issue #198): a sheet of the surface
  // token fading in over the page — the card lifts a step lighter than
  // the tile's shared canvas and text and images recede into the
  // paper, the base never going translucent. Inside the
  // mask, so the rounding clips it; pointer-none, so the closed page
  // stays fully interactive.
  const washStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 1],
      [0, PAGE_WASH_MAX],
      Extrapolation.CLAMP,
    ),
  }));
  return (
    <Reanimated.View
      style={[
        styles.container,
        styles.pageCardShadow,
        shadow,
        { backgroundColor: background },
      ]}
    >
      <Reanimated.View style={[styles.container, styles.pageCardMask]}>
        {children}
        <Reanimated.View
          pointerEvents="none"
          style={[styles.pageCardWash, { backgroundColor: wash }, washStyle]}
        />
      </Reanimated.View>
    </Reanimated.View>
  );
}

export function Home() {
  const { phase, refreshing, refresh } = useEdition();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // The active sort — Brûlant at launch (issue #197); taps and swipes
  // both land here, through the pager's pageSelected echo.
  const [sortIndex, setSortIndex] = useState(DEFAULT_SORT_INDEX);
  // The tile's open state — controlled, so the burger and every close
  // path (scrim, swipe, Android back) land in the one setState.
  const [menuOpen, setMenuOpen] = useState(false);

  // The standalone drawer has no back seam of its own — that lives in
  // the drawer navigator Prisme doesn't use (issue #198): while the
  // tile is open, Android back closes it instead of popping the route.
  useEffect(() => {
    if (!menuOpen) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setMenuOpen(false);
        return true;
      },
    );
    return () => subscription.remove();
  }, [menuOpen]);
  const pagerRef = useRef<PagerView>(null);
  // One list per page — the landed page's list is what the reset
  // scrolls; the pager keeps the neighbours mounted natively.
  const listRefs = useRef<Array<FlatList<Story> | null>>([]);
  const scrollState = useRef<'idle' | 'dragging' | 'settling'>('idle');
  const pendingReset = useRef<number | null>(null);

  const resetToTop = (index: number) => {
    if (scrollState.current === 'idle') {
      listRefs.current[index]?.scrollToOffset({ offset: 0, animated: false });
    } else {
      // Mid-settle: wait for idle, then reset the landed page —
      // never yank the page under a settling finger.
      pendingReset.current = index;
    }
  };

  // Tap stays the primary switcher: drive the pager; its pageSelected
  // echo lands the state and the reset — one path for taps and swipes.
  const switchSort = (index: number) => {
    pagerRef.current?.setPageWithoutAnimation(index);
  };

  const handlePageSelected = (event: PagerViewOnPageSelectedEvent) => {
    const index = event.nativeEvent.position;
    setSortIndex(index);
    resetToTop(index);
  };

  const handleScrollStateChanged = (
    event: PageScrollStateChangedNativeEvent,
  ) => {
    scrollState.current = event.nativeEvent.pageScrollState;
    if (scrollState.current === 'idle' && pendingReset.current !== null) {
      const index = pendingReset.current;
      pendingReset.current = null;
      listRefs.current[index]?.scrollToOffset({ offset: 0, animated: false });
    }
  };

  if (phase.status === 'loading') {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (phase.status === 'error') {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.canvas }]}
        contentContainerStyle={[styles.center, styles.gap]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
      >
        <Text style={styles.message}>
          Impossible de charger l'édition.{'\n'}Tirez pour réessayer.
        </Text>
      </ScrollView>
    );
  }

  const { edition, builtAt } = phase.snapshot;
  const lists = sortLists(edition);
  // The home — extracted so the drawer wraps it whole, chrome
  // included: the pills ride the page as it slides aside (issue #198).
  const home = (
    <View style={styles.container}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={DEFAULT_SORT_INDEX}
        onPageSelected={handlePageSelected}
        onPageScrollStateChanged={handleScrollStateChanged}
      >
        {SORTS.map((sort, index) => (
          <AnimatedFlatList
            key={sort.key}
            ref={(ref) => {
              listRefs.current[index] = ref;
            }}
            testID={`stories-${sort.key}`}
            data={lists[sort.key]}
            keyExtractor={(story: Story) => story.id}
            refreshing={refreshing}
            onRefresh={refresh}
            contentContainerStyle={{
              // The fixed header sits here at rest (amending #196/#197);
              // the content starts right below it and scrolls under the
              // frost — the geometry is unchanged.
              paddingTop:
                insets.top +
                HOME_TITLE_TOP_PADDING +
                HOME_TITLE_BLOCK_HEIGHT +
                12,
              // The last row must clear the floating switcher (issue #197).
              paddingBottom: insets.bottom + 72,
            }}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/story/${item.id}`)}
              >
                <Text style={[styles.story, { color: theme.ink }]}>
                  {item.title}
                </Text>
              </Pressable>
            )}
          />
        ))}
      </PagerView>
      {/* The fixed header (amending #196/#197): title, stamp and pills
          pinned over the frost that melts below the title block — the
          lists scroll under it, and its text stays legible over theirs. */}
      <HomeHeader
        stamp={latestPointStamp(builtAt)}
        onOpenMenu={() => setMenuOpen(true)}
      />
      {/* The sort switcher, pinned above the bottom safe area, floating
          over the list with no background of its own (issue #197). */}
      <View
        pointerEvents="box-none"
        style={[styles.switcher, { bottom: insets.bottom + 12 }]}
      >
        <SortSwitcher index={sortIndex} onSwitch={switchSort} />
      </View>
    </View>
  );
  return (
    <Drawer
      open={menuOpen}
      onOpen={() => setMenuOpen(true)}
      onClose={() => setMenuOpen(false)}
      // The ChatGPT feel (issue #198): the tile always sits behind the
      // page on the same canvas — the page slides aside to reveal it,
      // washing lighter over it so the tile reads darker behind. The
      // scrim stays tappable but invisible: the separation is the
      // page's wash and shadow, no dim.
      drawerPosition="right"
      drawerType="back"
      overlayStyle={{ backgroundColor: 'transparent' }}
      drawerStyle={{ width: '78%' }}
      // Edge-open only: a swipe from the right edge opens the tile;
      // once open, the pan owns the whole width (swipe-to-close) and
      // the pager is unreachable beneath the scrim.
      swipeEdgeWidth={40}
      renderDrawerContent={() => (
        <BurgerTile onClose={() => setMenuOpen(false)} />
      )}
    >
      <PageCard background={theme.canvas} wash={theme.surface}>
        {home}
      </PageCard>
    </Drawer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: PAGE_CARD_RADIUS,
  },
  // The card treatment of the sliding page (issue #198): the shadow
  // lives on the outer, unmasked surface (iOS clips a masked view's
  // shadow) and the mask clips the content on the inner one; both
  // carry the same static radius — see the note in PageCard.
  pageCardShadow: {
    // Static radius: the shadow path reads it from the committed style
    // — an animated radius never commits (see the note in PageCard).
    borderRadius: PAGE_CARD_RADIUS,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 0 },
    shadowRadius: 32,
  },
  pageCardMask: {
    overflow: 'hidden',
  },
  pageCardWash: {
    ...StyleSheet.absoluteFill,
  },
  pager: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gap: {
    gap: 12,
  },
  story: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 17,
  },
  switcher: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: '#555',
  },
});
