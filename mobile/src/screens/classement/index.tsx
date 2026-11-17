/**
 * The Classement screen (issue #199): the screen chrome — back and
 * share, no mode pill (nothing on the page reads the mode) — over the
 * placeholder prose (the page itself is #183). The share offers the
 * page's public URL; the prose scrolls under the floating pills the
 * same way the home's title block does (issue #196's geometry).
 */

import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HOME_TITLE_BLOCK_HEIGHT,
  HOME_TITLE_TOP_PADDING,
} from '@/chrome/HomeHeader';
import { ScreenHeader } from '@/chrome/ScreenHeader';
import { CLASSEMENT_WEB_URL } from '@/data/pages';
import { useTheme } from '@/theme';

const PARAGRAPHS = [
  "Cette page présentera le classement politique des médias français : où chaque média se situe sur l'éventail politique, du bord gauche au bord droit, selon les sources documentées pour chacun.",
  "Le classement s'appuie sur des études publiques et des classements établis par des tiers ; Prisme ne note jamais les médias lui-même — le prisme décrit, il ne juge pas.",
  'Le graphique du classement — la portée de chaque média face à sa tendance — sera rendu nativement, avec les mêmes formes que sur le site.',
  'Chaque média aura sa fiche : sa tendance, sa portée estimée, les sources qui l\u2019y placent, et les réserves éventuelles.',
  'Les médias exclus du classement — et la raison de leur exclusion — seront listés avec la même transparence.',
];

export function Classement() {
  const router = useRouter();
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
        <Text style={[styles.title, { color: theme.ink }]}>
          Classement politique des médias
        </Text>
        {PARAGRAPHS.map((paragraph) => (
          <Text key={paragraph} style={[styles.prose, { color: theme.prose }]}>
            {paragraph}
          </Text>
        ))}
      </ScrollView>
      {/* The chrome renders last — RN hit-tests later siblings first,
          so the pills win presses over the scroll beneath them (the
          home's own ordering, issue #196). */}
      <ScreenHeader
        onBack={() => router.back()}
        shareUrl={CLASSEMENT_WEB_URL}
      />
    </View>
  );
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
