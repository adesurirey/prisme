/* PROTOTYPE (throwaway, issue #173) — rough shared pieces. */
import type { ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { coverageOf, type Story, timeAgo } from './data';
import { GROUPS, type Group, type Palette, usePalette } from './tokens';

export function CoverageBar({ story }: { story: Story }) {
  const p = usePalette();
  const { counts, total } = coverageOf(story);
  if (total === 0) return null;
  const color: Record<Group, string> = {
    gauche: p.gauche,
    centre: p.centre,
    droite: p.droite,
  };
  return (
    <View style={[styles.bar, { backgroundColor: p.toggleTrack }]}>
      {GROUPS.filter((g) => counts[g] > 0).map((g) => (
        <View key={g} style={{ flex: counts[g], backgroundColor: color[g] }} />
      ))}
    </View>
  );
}

export function LeaningDots({ story }: { story: Story }) {
  const p = usePalette();
  const { counts } = coverageOf(story);
  const color: Record<Group, string> = {
    gauche: p.gauche,
    centre: p.centre,
    droite: p.droite,
  };
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {GROUPS.map((g) => (
        <View
          key={g}
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: counts[g] > 0 ? color[g] : p.line,
          }}
        />
      ))}
    </View>
  );
}

export function StoryRow({
  story,
  onPress,
}: {
  story: Story;
  onPress: () => void;
}) {
  const p = usePalette();
  const { counts, total } = coverageOf(story);
  const latest = story.articles.reduce(
    (m, a) => (a.publishedAt > m ? a.publishedAt : m),
    story.articles[0].publishedAt,
  );
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: p.toggleTrack },
      ]}
    >
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
        numberOfLines={3}
        style={{
          color: p.ink,
          fontSize: 17,
          fontWeight: '600',
          lineHeight: 22,
          marginTop: 3,
        }}
      >
        {story.title}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginTop: 6,
        }}
      >
        <LeaningDots story={story} />
        <Text style={{ color: p.muted, fontSize: 13 }}>
          {total} médias · G {counts.gauche} · C {counts.centre} · D{' '}
          {counts.droite}
        </Text>
        <Text style={{ color: p.faint, fontSize: 12, marginLeft: 'auto' }}>
          {timeAgo(latest)}
        </Text>
      </View>
    </Pressable>
  );
}

export function StoryList({
  stories,
  refreshing,
  onRefresh,
  onOpen,
}: {
  stories: Story[];
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (i: number) => void;
}) {
  const p = usePalette();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.canvas }}
      contentContainerStyle={{ paddingBottom: 140 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={p.muted}
        />
      }
    >
      {stories.map((s, i) => (
        <View key={s.id}>
          <StoryRow story={s} onPress={() => onOpen(i)} />
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: p.line,
              marginLeft: 16,
            }}
          />
        </View>
      ))}
    </ScrollView>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  compact,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
}) {
  const p = usePalette();
  return (
    <View
      style={[
        styles.segmented,
        { backgroundColor: p.toggleTrack },
        compact && { alignSelf: 'flex-start' },
      ]}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.segment, active && { backgroundColor: p.surface }]}
          >
            <Text
              style={{
                color: active ? p.ink : p.muted,
                fontSize: 13,
                fontWeight: '500',
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PrismeHeader({ updatedAt }: { updatedAt: Date }) {
  const p = usePalette();
  const hh = String(updatedAt.getHours()).padStart(2, '0');
  const mm = String(updatedAt.getMinutes()).padStart(2, '0');
  return (
    <View
      style={[
        styles.header,
        { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: p.line },
      ]}
    >
      <Text
        style={{
          color: p.ink,
          fontWeight: '700',
          letterSpacing: 3,
          fontSize: 13,
        }}
      >
        PRISME
      </Text>
      <Text style={{ color: p.faint, fontSize: 12 }}>
        mis à jour à {hh}:{mm}
      </Text>
    </View>
  );
}

export function SectionTitle({
  children,
  p,
}: {
  children: ReactNode;
  p: Palette;
}) {
  return (
    <Text
      style={{
        color: p.muted,
        fontSize: 12,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginTop: 28,
        marginBottom: 8,
      }}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  bar: { height: 6, borderRadius: 3, flexDirection: 'row', overflow: 'hidden' },
  row: { paddingHorizontal: 16, paddingVertical: 14 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 44,
  },
  segmented: { flexDirection: 'row', borderRadius: 8, padding: 2 },
  segment: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
});
