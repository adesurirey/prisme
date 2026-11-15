/**
 * The scroll-edge frost of the sticky header (issue #196): one blur
 * layer, cleared toward its bottom edge by a canvas wash — no panel, no
 * border, no shadow; the content simply blurs and melts into the list,
 * Photos-style. GlassView is for glass *objects* (the pills) — a full-
 * width bar in Liquid Glass reads as a card with a rim and a shadow,
 * which is exactly what a scroll edge must not be.
 */

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Platform,
  StyleSheet,
  useColorScheme,
  View,
  type ViewProps,
} from 'react-native';

import { useTheme } from '@/theme';

export function Frosted(props: ViewProps) {
  const theme = useTheme();
  const tint = useColorScheme() === 'dark' ? 'dark' : 'light';

  // A backdrop, never a touch target: the list scrolls and taps through.
  return (
    <View
      {...props}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, props.style]}
    >
      <BlurView
        intensity={55}
        tint={tint}
        experimentalBlurMethod={
          Platform.OS === 'android' ? 'dimezisBlurView' : undefined
        }
        style={[
          StyleSheet.absoluteFill,
          // expo-blur renders translucent where device blur is missing
          // (pre-Android 12): the accepted fallback (issue #180 salvage).
          Platform.OS === 'android' && { backgroundColor: `${theme.canvas}b3` },
        ]}
      />
      {/* The wash: the blur's hard bottom edge dissolves into the canvas,
          so the frost has no silhouette — it just fades. */}
      <LinearGradient
        colors={[
          `${theme.canvas}00`,
          `${theme.canvas}59`,
          `${theme.canvas}d9`,
          `${theme.canvas}ff`,
        ]}
        locations={[0.42, 0.72, 0.93, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
