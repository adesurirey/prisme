/**
 * The story screen (issue #199): the chrome — back, mode, share — over
 * the placeholder body (the body is #182). The story resolves through
 * the same `useEdition` door every screen reads (issue #179): the disk
 * cache renders instantly, so the share pill carries the public URL as
 * soon as the id matches a Story; until then it stays disabled — the
 * chrome renders before the data lands.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { StoryHeader } from '@/chrome/StoryHeader';
import { findStory, storyWebUrl } from '@/data/story';
import { useEdition } from '@/data/use-edition';
import { useTheme } from '@/theme';

export function Story({ id }: { id: string }) {
  const { phase } = useEdition();
  const router = useRouter();
  const theme = useTheme();

  const story =
    phase.status === 'ready' ? findStory(id, phase.snapshot.edition) : null;
  const shareUrl = story != null ? storyWebUrl(story) : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <StoryHeader onBack={() => router.back()} shareUrl={shareUrl} />
      {/* The body is #182 — the placeholder keeps the route's 5a text. */}
      <View style={styles.body}>
        <Text style={[styles.placeholder, { color: theme.prose }]}>
          Le récit s'écrira ici — le corps de page arrive avec #182.
        </Text>
        <Text style={[styles.id, { color: theme.prose }]}>{id}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  placeholder: { fontSize: 16, lineHeight: 26, textAlign: 'center' },
  id: { fontSize: 12, opacity: 0.5 },
});
