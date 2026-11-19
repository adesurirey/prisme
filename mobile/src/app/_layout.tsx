import { dark, light } from '@prisme/tokens';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { ModeProvider } from '@/mode/mode';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const palette = colorScheme === 'dark' ? dark : light;
  const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  // The navigation container paints `background` behind every scene —
  // its default grays showed at the page card's rounded corners while
  // the tile was open (issue #198): the notch behind the curve must be
  // the same canvas as the tile, or the corners read as a dark wedge.
  const theme = {
    ...base,
    colors: { ...base.colors, background: palette.canvas },
  };

  return (
    <ModeProvider>
      <ThemeProvider value={theme}>
        <StatusBar style="auto" />
        {/* Burger-only navigation (issue #195): the root Stack owns every
            route — no tab bar anywhere, and the native header stays
            hidden behind the custom chrome. */}
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="classement" />
          <Stack.Screen name="methode" />
          <Stack.Screen name="story/[id]" />
        </Stack>
      </ThemeProvider>
    </ModeProvider>
  );
}
