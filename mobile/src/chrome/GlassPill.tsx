/**
 * A Liquid Glass pill button (iOS 26) — the shape of the header's mode
 * trigger and the story modal's close button. Below iOS 26, a
 * translucent pill carries the same affordance. Android: an opaque
 * surface pill with a hairline and the ripple — translucent controls
 * read as broken when list content floats beneath them, and Material
 * raises its touchables on solid surfaces.
 */

import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme';

export function GlassPill({
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
  disabled,
  style,
  children,
}: {
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
  testID?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const theme = useTheme();
  const glass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const pressableProps = {
    accessibilityLabel,
    accessibilityRole: 'button' as const,
    disabled,
    onPress,
    onLongPress,
    testID,
  };

  if (glass) {
    return (
      <Pressable {...pressableProps}>
        <GlassView glassEffectStyle="regular" style={[styles.pill, style]}>
          {children}
        </GlassView>
      </Pressable>
    );
  }

  // The clip wrapper: RN's ripple drawable ignores the view's own
  // rounded outline — its square corners overflow the pill. The
  // capsule wrapper's overflow hidden clips the ripple to the shape.
  return (
    <View style={styles.rippleClip}>
      <Pressable
        {...pressableProps}
        android_ripple={{ color: theme.line }}
        style={({ pressed }) => [
          styles.pill,
          style,
          {
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.line,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        {children}
      </Pressable>
    </View>
  );
}

export function GlassPillText({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  return (
    <Text style={[styles.text, { color: theme.ink }, style]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleClip: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  text: {
    fontSize: 17,
    fontWeight: '600',
  },
});
