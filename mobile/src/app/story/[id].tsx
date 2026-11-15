/**
 * The story route placeholder (issue #195): pushed full-screen over
 * the home, header hidden — the native edge-swipe and the Android
 * back pop it. The body is #182; the chrome (back, mode, share) is
 * 5e (#199).
 */

import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

export default function Story() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.canvas, paddingTop: insets.top + 16 },
      ]}
    >
      <Text style={[styles.placeholder, { color: theme.prose }]}>
        Le récit s'écrira ici — le corps de page arrive avec #182.
      </Text>
      <Text style={[styles.id, { color: theme.prose }]}>{id}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, gap: 8 },
  placeholder: { fontSize: 16, lineHeight: 26 },
  id: { fontSize: 12, opacity: 0.5 },
});
