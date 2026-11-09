/*
 * PROTOTYPE (throwaway, issue #173).
 * Three IA variants for À la une, switchable via the floating pill:
 *   A · Sélecteur — one screen, segmented control (web parity, ADR-0028)
 *   B · Onglets   — bottom tabs, one per sort
 *   C · Pager     — full-screen swipeable pages with synced tab labels
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView as SafeAreaBottom } from 'react-native-safe-area-context';
import { SORTS, type SortKey, sortOf } from '@/data';
import { usePalette } from '@/tokens';
import { PrismeHeader, Segmented, StoryList } from '@/ui';

const VARIANTS = [
  { key: 'A', name: 'Sélecteur' },
  { key: 'B', name: 'Onglets' },
  { key: 'C', name: 'Pager' },
] as const;
type VariantKey = (typeof VARIANTS)[number]['key'];

export default function Home() {
  const p = usePalette();
  const router = useRouter();
  const [variant, setVariant] = useState<VariantKey>('A');
  const [sort, setSort] = useState<SortKey>('brulant');
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(() => new Date());
  const w = Dimensions.get('window').width;

  const active = sortOf(sort);
  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setUpdatedAt(new Date());
    }, 900);
  };
  const open = (i: number) =>
    router.push({ pathname: '/story', params: { list: sort, i: String(i) } });
  const cycleVariant = (dir: 1 | -1) => {
    const idx = VARIANTS.findIndex((v) => v.key === variant);
    setVariant(VARIANTS[(idx + dir + VARIANTS.length) % VARIANTS.length].key);
  };

  const title = (
    <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
      <Text
        style={{
          color: p.ink,
          fontSize: 28,
          fontWeight: '700',
          letterSpacing: -0.5,
        }}
      >
        À la une
      </Text>
      <Text
        style={{ color: p.muted, fontSize: 13, marginTop: 4, marginBottom: 12 }}
      >
        {active.hint} · {active.stories.length} histoires
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.canvas }}>
      <PrismeHeader updatedAt={updatedAt} />

      {variant === 'A' && (
        <>
          {title}
          <View style={{ paddingHorizontal: 16 }}>
            <Segmented
              options={SORTS.map((s) => ({ key: s.key, label: s.label }))}
              value={sort}
              onChange={setSort}
            />
          </View>
          <StoryList
            stories={active.stories}
            refreshing={refreshing}
            onRefresh={refresh}
            onOpen={open}
          />
        </>
      )}

      {variant === 'B' && (
        <>
          {title}
          <View style={{ flex: 1 }}>
            <StoryList
              stories={active.stories}
              refreshing={refreshing}
              onRefresh={refresh}
              onOpen={open}
            />
          </View>
          {/* Rough hand-rolled bar — good enough to judge the IA, not the pixels. */}
          <SafeAreaBottom
            edges={['bottom']}
            style={{
              backgroundColor: p.surface,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderColor: p.line,
            }}
          >
            <View style={{ flexDirection: 'row' }}>
              {SORTS.map((s) => {
                const on = s.key === sort;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => setSort(s.key)}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      paddingVertical: 12,
                    }}
                  >
                    <Text
                      style={{
                        color: on ? p.ink : p.muted,
                        fontWeight: on ? '700' : '500',
                        fontSize: 14,
                      }}
                    >
                      {s.label}
                    </Text>
                    <View
                      style={{
                        height: 2,
                        width: 22,
                        borderRadius: 1,
                        backgroundColor: on ? p.trending : 'transparent',
                        marginTop: 4,
                      }}
                    />
                  </Pressable>
                );
              })}
            </View>
          </SafeAreaBottom>
        </>
      )}

      {variant === 'C' && (
        <>
          <View
            style={{
              flexDirection: 'row',
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 8,
            }}
          >
            {SORTS.map((s) => {
              const on = s.key === sort;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => setSort(s.key)}
                  style={{ marginRight: 18, paddingVertical: 4 }}
                >
                  <Text
                    style={{
                      color: on ? p.ink : p.muted,
                      fontSize: on ? 20 : 16,
                      fontWeight: on ? '700' : '500',
                    }}
                  >
                    {s.label}
                  </Text>
                  <View
                    style={{
                      height: 2.5,
                      width: '100%',
                      borderRadius: 2,
                      backgroundColor: on ? p.trending : 'transparent',
                      marginTop: 5,
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / w);
              const key = SORTS[idx]?.key;
              if (key != null) setSort(key);
            }}
          >
            {SORTS.map((s) => (
              <View key={s.key} style={{ width: w }}>
                <StoryList
                  stories={s.stories}
                  refreshing={refreshing}
                  onRefresh={refresh}
                  onOpen={(i) =>
                    router.push({
                      pathname: '/story',
                      params: { list: s.key, i: String(i) },
                    })
                  }
                />
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {/* The variant switcher — loud on purpose, obviously not part of any design. */}
      <View
        style={{
          position: 'absolute',
          bottom: 76,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.75)',
            borderRadius: 999,
            paddingHorizontal: 4,
            paddingVertical: 3,
          }}
        >
          <Pressable onPress={() => cycleVariant(-1)} style={{ padding: 8 }}>
            <Text style={{ color: '#fff', fontSize: 13 }}>◀</Text>
          </Pressable>
          <Text style={{ color: '#fff', fontSize: 12, paddingHorizontal: 8 }}>
            {variant} · {VARIANTS.find((v) => v.key === variant)?.name}
          </Text>
          <Pressable onPress={() => cycleVariant(1)} style={{ padding: 8 }}>
            <Text style={{ color: '#fff', fontSize: 13 }}>▶</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
