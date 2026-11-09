/* PROTOTYPE (throwaway, issue #173) — the Story page, rough: does the
 * Prism stack read on a phone as one scroll? */
// biome-ignore-all lint/suspicious/noArrayIndexKey: throwaway prototype (issue #173) — fixed 24 bins, bullets never reorder

import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  coverageOf,
  groupOf,
  heroImageOf,
  leaningOf,
  outletName,
  type Story,
  sortOf,
  timeAgo,
} from '@/data';
import { GROUP_LABELS, GROUPS, type Group, usePalette } from '@/tokens';
import { CoverageBar, SectionTitle, Segmented } from '@/ui';

function Chronology({ story }: { story: Story }) {
  const p = usePalette();
  const times = story.articles
    .map((a) => new Date(a.publishedAt).getTime())
    .filter((t) => !Number.isNaN(t));
  if (times.length === 0) return null;
  const min = Math.min(...times);
  const span = Math.max(Math.max(...times) - min, 3_600_000);
  const BINS = 24;
  const bins: Record<Group, number>[] = Array.from({ length: BINS }, () => ({
    gauche: 0,
    centre: 0,
    droite: 0,
  }));
  for (const a of story.articles) {
    const g = groupOf(leaningOf(a.outletId));
    const idx = Math.min(
      BINS - 1,
      Math.floor(((new Date(a.publishedAt).getTime() - min) / span) * BINS),
    );
    bins[idx][g] += 1;
  }
  const maxCount = Math.max(1, ...bins.flatMap((b) => GROUPS.map((g) => b[g])));
  const color: Record<Group, string> = {
    gauche: p.gauche,
    centre: p.centre,
    droite: p.droite,
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 32,
        gap: 2,
      }}
    >
      {bins.map((b, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 1,
          }}
        >
          {GROUPS.map((g) => (
            <View
              key={g}
              style={{
                flex: 1,
                height: b[g] === 0 ? 2 : 3 + (b[g] / maxCount) * 29,
                backgroundColor: b[g] === 0 ? p.toggleTrack : color[g],
                borderRadius: 1,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function StoryPage() {
  const p = usePalette();
  const router = useRouter();
  const { list, i } = useLocalSearchParams<{ list: string; i: string }>();
  const story = sortOf(String(list)).stories[Number(i)];
  const [tab, setTab] = useState<Group>('gauche');
  if (story == null) return <View />;
  const cov = coverageOf(story);
  const hero = heroImageOf(story);
  const bullets = story.summaries?.[tab] ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.canvas }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ marginBottom: 12, alignSelf: 'flex-start' }}
        >
          <Text style={{ color: p.droite, fontSize: 15 }}>‹ À la une</Text>
        </Pressable>

        {hero != null && (
          <Image
            source={{ uri: hero }}
            style={{
              width: '100%',
              height: 190,
              borderRadius: 10,
              marginBottom: 14,
            }}
          />
        )}

        <Text
          style={{
            color: p.trending,
            fontSize: 11,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          {story.section}
        </Text>
        <Text
          style={{
            color: p.ink,
            fontSize: 24,
            fontWeight: '700',
            lineHeight: 30,
            marginTop: 4,
          }}
        >
          {story.title}
        </Text>

        <View style={{ marginTop: 14 }}>
          <CoverageBar story={story} />
          <Text style={{ color: p.muted, fontSize: 13, marginTop: 6 }}>
            {cov.total} médias · G {cov.counts.gauche} · C {cov.counts.centre} ·
            D {cov.counts.droite}
          </Text>
        </View>

        <SectionTitle p={p}>Chronologie de couverture (esquisse)</SectionTitle>
        <Chronology story={story} />

        <SectionTitle p={p}>Résumés</SectionTitle>
        <Segmented
          options={GROUPS.map((g) => ({ key: g, label: GROUP_LABELS[g] }))}
          value={tab}
          onChange={setTab}
          compact
        />
        <View style={{ marginTop: 12, gap: 8 }}>
          {bullets.length === 0 && (
            <Text style={{ color: p.faint, fontSize: 14 }}>
              Pas de résumé (budget des résumés).
            </Text>
          )}
          {bullets.map((b, idx) => (
            <Text
              key={idx}
              style={{ color: p.prose, fontSize: 15, lineHeight: 22 }}
            >
              • {b}
            </Text>
          ))}
        </View>

        {story.differences?.length > 0 && (
          <>
            <SectionTitle p={p}>Différences</SectionTitle>
            {story.differences.map((d, idx) => {
              const g = GROUPS[idx];
              const color =
                g === 'gauche'
                  ? p.gauche
                  : g === 'centre'
                    ? p.centre
                    : p.droite;
              return (
                <View
                  key={g}
                  style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: color,
                      marginTop: 6,
                    }}
                  />
                  <Text
                    style={{
                      color: p.prose,
                      fontSize: 14,
                      lineHeight: 20,
                      flex: 1,
                    }}
                  >
                    {d}
                  </Text>
                </View>
              );
            })}
          </>
        )}

        <SectionTitle p={p}>Articles</SectionTitle>
        {GROUPS.map((g) => {
          const articles = cov.articlesPerGroup[g];
          if (articles.length === 0) return null;
          return (
            <View key={g} style={{ marginBottom: 16 }}>
              <Text
                style={{
                  color: p.muted,
                  fontSize: 12,
                  fontWeight: '600',
                  marginBottom: 4,
                }}
              >
                {GROUP_LABELS[g]} — {cov.counts[g]} médias
              </Text>
              {articles.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    void WebBrowser.openBrowserAsync(a.url);
                  }}
                  style={({ pressed }) => [
                    styles.articleRow,
                    pressed && { backgroundColor: p.toggleTrack },
                  ]}
                >
                  <Text style={{ color: p.muted, fontSize: 12 }}>
                    {outletName(a.outletId)}
                  </Text>
                  <Text
                    numberOfLines={3}
                    style={{
                      color: p.ink,
                      fontSize: 15,
                      lineHeight: 20,
                      marginTop: 1,
                    }}
                  >
                    {a.headline}
                  </Text>
                  <Text style={{ color: p.faint, fontSize: 11, marginTop: 3 }}>
                    {timeAgo(a.publishedAt)}
                  </Text>
                </Pressable>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  articleRow: { paddingVertical: 8, borderRadius: 8, paddingHorizontal: 4 },
});
