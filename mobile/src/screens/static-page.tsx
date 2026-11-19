/**
 * The static pages' shared frame (issues #195/#199): the screen chrome —
 * back and share, no mode pill (nothing on these pages reads the mode)
 * — over a scrolling body that clears the floating pills with the
 * home's own geometry (issue #196's title block). The body is the
 * caller's children: the pages are work in progress (#183) and will
 * grow rich content — images, graphs — so the frame owns the chrome
 * and the clearance, never the content's shape. The chrome renders
 * last — RN hit-tests later siblings first, so the pills win presses
 * over the scroll beneath them (the home's own ordering, issue #196).
 */

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  HOME_TITLE_BLOCK_HEIGHT,
  HOME_TITLE_TOP_PADDING,
} from '@/chrome/HomeHeader';
import { ScreenHeader } from '@/chrome/ScreenHeader';
import { useTheme } from '@/theme';

export function StaticPage({
  title,
  shareUrl,
  onBack,
  children,
}: {
  title: string;
  shareUrl: string;
  onBack: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            // Below the floating pills — the home list's own clearance.
            paddingTop:
              insets.top +
              HOME_TITLE_TOP_PADDING +
              HOME_TITLE_BLOCK_HEIGHT +
              12,
            paddingBottom: insets.bottom + 32,
          },
        ]}
      >
        <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
        {children}
      </ScrollView>
      <ScreenHeader onBack={onBack} shareUrl={shareUrl} />
    </View>
  );
}

/** A paragraph of the pages' placeholder prose — the shared body text
 *  style. Rich content (images, graphs) renders as plain children. */
export function Prose({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.prose, { color: theme.prose }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 14 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginVertical: 18,
  },
  prose: { fontSize: 16, lineHeight: 26 },
});
