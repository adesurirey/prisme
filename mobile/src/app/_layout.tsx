import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style="auto" />
      {/* App chrome (wordmark + reading-mode toggle) lands in #180; the
          native header stays hidden until then. */}
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
