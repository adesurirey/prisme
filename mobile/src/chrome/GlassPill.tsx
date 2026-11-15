/**
 * A Liquid Glass pill button (iOS 26) — the shape of the header's mode
 * trigger and the story modal's close button. Below iOS 26 and on
 * Android, a translucent pill carries the same affordance.
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
  const glass = Platform.OS === 'ios' && isLiquidGlassAvailable();

  if (glass) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        onLongPress={onLongPress}
        testID={testID}
      >
        <GlassView glassEffectStyle="regular" style={[styles.pill, style]}>
          {children}
        </GlassView>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      testID={testID}
      style={({ pressed }) => [
        styles.pill,
        styles.pillFallback,
        style,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {children}
    </Pressable>
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
  pillFallback: {
    backgroundColor: 'rgba(128, 128, 138, 0.18)',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
});
