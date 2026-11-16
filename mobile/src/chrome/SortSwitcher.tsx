/**
 * The bottom sort switcher (issue #197) — chrome, like the pills: it
 * floats over the list, pinned above the bottom safe area by its
 * parent (the Home overlay), with no background of its own on iOS —
 * iOS 26 glasses the real UISegmentedControl automatically, and
 * wrapping it in a GlassView double-glasses it. Android gets a simple
 * custom control — three pressables and a selected pill, no JS fake
 * of the iOS look. The labels come straight from SORTS (issue #195);
 * taps report the segment's index and the Home owns the sort state.
 */

import type { SegmentedControlProps } from '@react-native-segmented-control/segmented-control';
import SegmentedControlPkg from '@react-native-segmented-control/segmented-control';
import type { ComponentType } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { SORTS } from '@/sorts';
import { useTheme } from '@/theme';

// The lib declares its class through a NativeMethods mixin that TS 6's
// JSX element typing rejects; the runtime value is the real
// native-wrapped component — only the declaration needs the cast.
const SegmentedControl =
  SegmentedControlPkg as ComponentType<SegmentedControlProps>;

export function SortSwitcher({
  index,
  onSwitch,
}: {
  index: number;
  onSwitch: (index: number) => void;
}) {
  const theme = useTheme();

  if (Platform.OS === 'ios') {
    return (
      <SegmentedControl
        testID="sort-switcher"
        values={SORTS.map((sort) => sort.label)}
        selectedIndex={index}
        style={styles.control}
        onChange={(event) => onSwitch(event.nativeEvent.selectedSegmentIndex)}
      />
    );
  }

  return (
    <View style={styles.androidRow}>
      {SORTS.map((sort, segment) => (
        <Pressable
          key={sort.key}
          testID={`sort-segment-${segment}`}
          accessibilityRole="button"
          accessibilityState={{ selected: segment === index }}
          onPress={() => onSwitch(segment)}
          style={[
            styles.androidSegment,
            segment === index && styles.androidPill,
          ]}
        >
          <Text
            style={{
              color: segment === index ? theme.ink : theme.muted,
            }}
          >
            {sort.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  control: {
    width: 248,
  },
  androidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(128, 128, 138, 0.18)',
  },
  androidSegment: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 999,
  },
  androidPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
});
