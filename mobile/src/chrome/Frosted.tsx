/**
 * The frosted background of the sticky header (issue #180): iOS 26's
 * Liquid Glass, kept very transparent — a clear-reading glass with a
 * light canvas tint, no bottom hairline. Below iOS 26 a soft
 * `BlurView`; Android 12+ gets real blur with a translucent fallback
 * for anything older.
 */

import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Platform, useColorScheme, type ViewProps } from 'react-native';

import { useTheme } from '@/theme';

export function Frosted(props: ViewProps) {
  const theme = useTheme();
  const tint = useColorScheme() === 'dark' ? 'dark' : 'light';

  if (Platform.OS === 'ios' && isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        tintColor={`${theme.canvas}24`}
        {...props}
      />
    );
  }

  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={28} tint={tint} style={props.style}>
        {props.children}
      </BlurView>
    );
  }

  // Android: expo-blur gives real blur on 12+; on older versions it
  // renders translucent, which is the accepted fallback.
  return (
    <BlurView
      intensity={24}
      tint={tint}
      experimentalBlurMethod="dimezisBlurView"
      style={[{ backgroundColor: `${theme.canvas}b3` }, props.style]}
    >
      {props.children}
    </BlurView>
  );
}
