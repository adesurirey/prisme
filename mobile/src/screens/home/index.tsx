import type { Story } from '@prisme/domain';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useEdition } from '@/data/use-edition';

// The data-layer proof surface (issue #179): the Edition client drives the
// home — disk cache rendered instantly, revalidated in the background,
// pull-to-refresh forcing a round, the builtAt honesty stamp. The real
// sort screens (1:1 web parity) land in #181 on the same hook.

/** The « mis à jour » stamp — the rendered artifact's own build instant,
 *  shown in Paris time like every Prisme date. */
function updateStamp(builtAt: string): string {
  const instant = new Date(builtAt);
  const day = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: 'numeric',
    month: 'long',
  }).format(instant);
  const clock = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(instant)
    .replace(':', 'h');
  return `Mis à jour le ${day} à ${clock}`;
}

export function Home() {
  const { phase, refreshing, refresh } = useEdition();

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
        style={styles.container}
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
    <FlatList
      style={styles.container}
      testID="stories"
      data={edition.feedStories}
      keyExtractor={(story: Story) => story.id}
      refreshing={refreshing}
      onRefresh={refresh}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Prisme</Text>
          <Text style={styles.stamp}>{updateStamp(builtAt)}</Text>
        </View>
      }
      renderItem={({ item }) => <Text style={styles.story}>{item.title}</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gap: {
    gap: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  stamp: {
    marginTop: 4,
    fontSize: 13,
    color: '#555',
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
