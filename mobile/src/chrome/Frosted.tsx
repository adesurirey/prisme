/**
 * The scroll-edge frost of the sticky header (issue #196): one uniform
 * layer of the system's ultra-thin material — the status bar's own
 * material — with no fade attempt at all. GlassView is for glass
 * *objects* (the pills); a full-width bar in Liquid Glass reads as a
 * card with a rim and a shadow, which a scroll edge must not be.
 */

import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme';

export function Frosted(props: ViewProps) {
  const theme = useTheme();

  return (
    <View
      {...props}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, props.style]}
    >
      <BlurView
        intensity={15}
        tint="systemUltraThinMaterial"
        blurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        style={[
          StyleSheet.absoluteFill,
          // expo-blur renders translucent where device blur is missing
          // (pre-Android 12): the accepted fallback.
          Platform.OS === 'android' && { backgroundColor: `${theme.canvas}b3` },
        ]}
      />
    </View>
  );
}
