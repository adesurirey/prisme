/**
 * A Liquid Glass pill button (iOS 26) — the shape of the header's mode
 * trigger and the story modal's close button. Below iOS 26 and on
 * Android, a translucent pill carries the same affordance.
 */

import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme';

export function GlassPill({
  onPress,
  accessibilityLabel,
  testID,
  children,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
  children: ReactNode;
}) {
  const glass = Platform.OS === 'ios' && isLiquidGlassAvailable();

  if (glass) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={onPress}
        testID={testID}
      >
        <GlassView glassEffectStyle="regular" style={styles.pill}>
          {children}
        </GlassView>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.pill,
        styles.pillFallback,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}

export function GlassPillText({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.text, { color: theme.ink }]}>{children}</Text>;
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
