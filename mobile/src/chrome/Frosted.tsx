/**
 * The scroll-edge frost of the sticky header (issue #196): one uniform
 * layer of the system's ultra-thin material — the status bar's own
 * material — with no fade attempt at all. GlassView is for glass
 * *objects* (the pills); a full-width bar in Liquid Glass reads as a
 * card with a rim and a shadow, which a scroll edge must not be.
 *
 * Android: Material has no translucent chrome — a top bar is a solid
 * surface — and the BlurView renders nothing inside the header's melt
 * mask anyway (content printed straight through the title). A
 * canvas-colored bar stands in; the melt mask fades it out unchanged.
 */

import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme';

export function Frosted(props: ViewProps) {
  const theme = useTheme();

  if (Platform.OS === 'android') {
    return (
      <View
        {...props}
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          props.style,
          { backgroundColor: theme.canvas },
        ]}
      />
    );
  }

  return (
    <View
      {...props}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, props.style]}
    >
      <BlurView
        intensity={15}
        tint="systemUltraThinMaterial"
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
