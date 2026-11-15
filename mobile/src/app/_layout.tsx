import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { ModeProvider } from '@/mode/mode';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ModeProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style="auto" />
        {/* Burger-only navigation (issue #195): the root Stack owns every
            route — no tab bar anywhere. Chrome lands in 5b–5e; the native
            header stays hidden until then. */}
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
