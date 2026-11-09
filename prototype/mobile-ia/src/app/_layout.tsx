import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

/* PROTOTYPE (throwaway, issue #173) — one stack, no chrome: each IA
 * variant owns its whole screen. */
export default function Layout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
