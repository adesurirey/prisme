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
// pull-to-refresh forcing a round. The title and stamp are list content
// (issue #196): they render at the same spot on open and scroll away with
// the stories; only the pills float. Rows are raw title buttons pushing
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
const PAGE_CARD_RADIUS = 48;

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
 * the tile waits behind the page — darker than it by its own token —
 * and as the drawer opens the page's leading edge rounds off, casts a
 * soft drop shadow onto the tile and washes slightly lighter. Full-
 * bleed again when closed. Two surfaces, each with one job: the outer
 * casts the shadow — transparent, because a background there gave iOS
 * a square layer to shadow from, and its stale square corner peeked
 * out behind the rounded curve; from the subtree's alpha instead, the
 * shadow follows the rounding exactly. The inner one is the card
 * itself — the masked canvas surface the content paints onto. Reads
 * the drawer's progress context, so it mounts strictly inside
 * <Drawer> — the home's own body sits above that provider.
 */
function PageCard({
  background,
  children,
}: {
  background: string;
  children: ReactNode;
}) {
  const progress = useDrawerProgress();
  // Paint props only on the outer surface: Reanimated skips committing
  // animated paint styles to the shadow tree (the library's own FIXME),
  // so an animated borderRadius here left UIKit drawing the shadow from
  // a radius-0 square path — the corner ghost. The radius lives as a
  // static style instead (committed once, path always rounded); only
  // the shadow and wash intensities animate.
  const shadow = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(
      progress.value,
      [0, 1],
      [0, 0.16],
      Extrapolation.CLAMP,
    ),
    // The whole page washes as the tile opens (the ChatGPT model): the
    // content fades toward the shared canvas, so the page reads lighter
    // than the layer beneath it — surface and page share one color and
    // only the wash separates them.
    opacity: interpolate(progress.value, [0, 1], [1, 0.6]),
  }));
  const mask = useAnimatedStyle(() => ({
    borderRadius: interpolate(
      progress.value,
      [0, 1],
      [0, PAGE_CARD_RADIUS],
      Extrapolation.CLAMP,
    ),
  }));
  return (
    <Reanimated.View style={[styles.container, styles.pageCardShadow, shadow]}>
      <Reanimated.View
        style={[
          styles.container,
          styles.pageCardMask,
          mask,
          { backgroundColor: background },
        ]}
      >
        {children}
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
  // The shared title block: one instance above the pager, translating
  // with the ACTIVE page's scroll — fixed during sort switches, gone
  // on scroll down, like list content (issue #197).
  const titleY = useRef(new Animated.Value(0)).current;
  const scrollOffsets = useRef<Array<number>>([0, 0, 0]);

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
    // The landed page's scroll owns the shared title now.
    titleY.setValue(scrollOffsets.current[index]);
  };

  // titleY holds the active page's raw scroll offset (native-driven);
  // the overlay renders it inverted.
  const handleScroll = (index: number) =>
    Animated.event([{ nativeEvent: { contentOffset: { y: titleY } } }], {
      useNativeDriver: true,
      listener: (event: { nativeEvent: { contentOffset: { y: number } } }) => {
        scrollOffsets.current[index] = event.nativeEvent.contentOffset.y;
      },
    });

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
              // The title block is a shared overlay above the pager
              // (issue #197); the content starts right below where it
              // sits at rest, so scroll math stays identical.
              paddingTop:
                insets.top +
                HOME_TITLE_TOP_PADDING +
                HOME_TITLE_BLOCK_HEIGHT +
                12,
              // The last row must clear the floating switcher (issue #197).
              paddingBottom: insets.bottom + 72,
            }}
            onScroll={handleScroll(index)}
            scrollEventThrottle={16}
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
      {/* The shared title block (issue #197): one instance for every
          sort — fixed while swiping between pages, riding the active
          page's scroll down like list content. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.titleOverlay,
          {
            paddingTop: insets.top + HOME_TITLE_TOP_PADDING,
            transform: [{ translateY: Animated.multiply(titleY, -1) }],
          },
        ]}
      >
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: theme.ink }]}>À la une</Text>
          <Text style={[styles.stamp, { color: theme.muted }]}>
            {latestPointStamp(builtAt)}
          </Text>
        </View>
      </Animated.View>
      {/* The pills only — a totally transparent overlay (issue #196). */}
      <HomeHeader onOpenMenu={() => setMenuOpen(true)} />
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
      // page — darker than it by its own token — and the page slides
      // aside to reveal it. The scrim stays tappable but invisible: the
      // separation is the tile's color and the page's shadow, no dim.
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
      <PageCard background={theme.canvas}>{home}</PageCard>
    </Drawer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // The card treatment of the sliding page (issue #198): the shadow
  // lives on the outer, unmasked surface (iOS clips a masked view's
  // shadow) and the mask on the inner one; the radius animates on both
  // so the shadow follows the rounding edge.
  pageCardShadow: {
    // Static radius: the shadow path reads it from the committed style
    // and stays rounded for good — see the note on the animated style.
    borderRadius: PAGE_CARD_RADIUS,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 0 },
    shadowRadius: 32,
  },
  pageCardMask: {
    overflow: 'hidden',
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
  titleBlock: {
    height: HOME_TITLE_BLOCK_HEIGHT,
    paddingHorizontal: 20,
  },
  titleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
