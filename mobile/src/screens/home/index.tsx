import type { Story } from '@prisme/domain';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  PagerViewOnPageSelectedEvent,
  PageScrollStateChangedNativeEvent,
} from 'react-native-pager-view';
import PagerView from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

export function Home() {
  const { phase, refreshing, refresh } = useEdition();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // The active sort — Brûlant at launch (issue #197); taps and swipes
  // both land here, through the pager's pageSelected echo.
  const [sortIndex, setSortIndex] = useState(DEFAULT_SORT_INDEX);
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
  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={DEFAULT_SORT_INDEX}
        onPageSelected={handlePageSelected}
        onPageScrollStateChanged={handleScrollStateChanged}
      >
        {SORTS.map((sort, index) => (
          <FlatList
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
              // The title block sits where the old bar had it; it is list
              // content and scrolls away with the stories (issue #196).
              paddingTop: insets.top + HOME_TITLE_TOP_PADDING,
              // The last row must clear the floating switcher (issue #197).
              paddingBottom: insets.bottom + 72,
            }}
            ListHeaderComponent={
              <View style={styles.titleBlock}>
                <Text style={[styles.title, { color: theme.ink }]}>
                  À la une
                </Text>
                <Text style={[styles.stamp, { color: theme.muted }]}>
                  {latestPointStamp(builtAt)}
                </Text>
              </View>
            }
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
      {/* The pills only — a totally transparent overlay (issue #196). */}
      <HomeHeader />
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: 12,
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
