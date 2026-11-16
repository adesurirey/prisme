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
import { BlurView } from 'expo-blur';
import type { ComponentType } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

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
  const scheme = useColorScheme();

  if (Platform.OS === 'ios') {
    return (
      // The Photos treatment: the glass control rides on a chrome
      // material capsule. Bare glass melts into a white canvas and
      // lets list text read straight through it — the material pops
      // the control over the scroll (owner's call, reversing the 5c
      // « no background of its own » line).
      <View style={styles.shell}>
        <BlurView
          intensity={25}
          tint="systemChromeMaterial"
          pointerEvents="none"
          style={styles.material}
        />
        <SegmentedControl
          testID="sort-switcher"
          values={SORTS.map((sort) => sort.label)}
          selectedIndex={index}
          style={styles.control}
          // Same size as the header pills (GlassPillText); regular
          // weight, like Photos' labels. Colors stay native.
          fontStyle={{ fontSize: 17 }}
          activeFontStyle={{ fontSize: 17 }}
          // Photos' selected pill, translucent over the glass (the
          // prop maps to setSelectedSegmentTintColor): a gray in light
          // (darker than the track), a white veil in dark (lighter
          // than the track — never undefined: nil hands the pill to
          // the app's blue system tint, simulator-checked).
          tintColor={
            scheme === 'dark'
              ? 'rgba(255, 255, 255, 0.2)'
              : 'rgba(118, 118, 128, 0.25)'
          }
          onChange={(event) => onSwitch(event.nativeEvent.selectedSegmentIndex)}
        />
      </View>
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
            // The selected pill is a raised surface from the palette —
            // hardcoded white reads nowhere in dark mode (review P1).
            segment === index && { backgroundColor: theme.surface },
          ]}
        >
          <Text
            style={{
              // Same size as the header pills (GlassPillText), regular
              // weight like Photos' labels.
              color: segment === index ? theme.ink : theme.muted,
              fontSize: 17,
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
  // The capsule shell clips the material to the control's shape; the
  // material sits behind, the control in flow on top.
  shell: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  material: {
    ...StyleSheet.absoluteFill,
  },
  // Same height as the header pills (44). The frame is respected
  // exactly by iOS 26's glass control (measured on the simulator);
  // its selected pill is inset ~2pt inside the track — native
  // behavior, same as Photos.
  control: {
    width: 285,
    height: 44,
  },
  androidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    gap: 6,
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(128, 128, 138, 0.3)',
  },
  androidSegment: {
    justifyContent: 'center',
    paddingHorizontal: 20,
    height: 36,
    borderRadius: 999,
  },
});
