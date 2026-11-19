/**
 * Theme resolution (PRD #185): system-following dark mode, colors from
 * the single token source (@prisme/tokens, issue #172). Screens style
 * directly against these palettes — no styling library, so a future
 * swap stays screen-by-screen mechanical.
 */

import { dark, light, type Palette } from '@prisme/tokens';
import { useColorScheme } from 'react-native';

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
