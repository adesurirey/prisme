import type { Story } from '@prisme/domain';
import { useRouter } from 'expo-router';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HOME_HEADER_BAR_HEIGHT, HomeHeader } from '@/chrome/HomeHeader';
import { useEdition } from '@/data/use-edition';
import { useTheme } from '@/theme';

// The data-layer proof surface (issue #179): the Edition client drives the
// home — disk cache rendered instantly, revalidated in the background,
// pull-to-refresh forcing a round. The fixed header (issue #196) carries
// « À la une », the stamp and the pills; rows are raw title buttons
// pushing the story route (#195); cards land in #181.

export function Home() {
  const { phase, refreshing, refresh } = useEdition();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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
  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <FlatList
        testID="stories"
        data={edition.feedStories}
        keyExtractor={(story: Story) => story.id}
        refreshing={refreshing}
        onRefresh={refresh}
        contentContainerStyle={{
          // The first row's padding tucks into the frost's melt zone, so
          // scrolling smokes the rows under the bar without ever hiding
          // a readable line at rest.
          paddingTop: insets.top + HOME_HEADER_BAR_HEIGHT - 16,
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
      <HomeHeader builtAt={builtAt} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: '#555',
  },
});
