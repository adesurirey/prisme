/**
 * The Méthode screen (issue #199): the screen chrome — back and share,
 * no mode pill (nothing on the page reads the mode) — over the
 * placeholder prose (the page itself is #183). Same clearance under
 * the floating pills as the Classement screen.
 */

import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HOME_TITLE_BLOCK_HEIGHT,
  HOME_TITLE_TOP_PADDING,
} from '@/chrome/HomeHeader';
import { ScreenHeader } from '@/chrome/ScreenHeader';
import { METHODE_WEB_URL } from '@/data/pages';
import { useTheme } from '@/theme';

const PARAGRAPHS = [
  'Prisme est un prototype : il montre chaque jour ce que les grands médias français mettent à la une, groupe ces unes par sujet, et décrit comment l\u2019information se répartit entre elles.',
  'Cette page présentera la méthode : la collecte des flux, le groupement des articles, la classification, les Résumés, les Différences — et les limites de chacune de ces étapes.',
  'Le code est libre : chaque étape est vérifiable, et les choix documentés dans les décisions d\u2019architecture qui l\u2019accompagnent.',
  'Prisme ne note jamais les médias. Il décrit la couverture — combien de médias rapportent un sujet, et comment leurs récits diffèrent.',
  'Les données viennent des flux RSS des médias eux-mêmes ; rien n\u2019est stocké au-delà de ce que les flux publient.',
];

export function Methode() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <ScreenHeader onBack={() => router.back()} shareUrl={METHODE_WEB_URL} />
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
        <Text style={[styles.title, { color: theme.ink }]}>Méthode</Text>
        {PARAGRAPHS.map((paragraph) => (
          <Text key={paragraph} style={[styles.prose, { color: theme.prose }]}>
            {paragraph}
          </Text>
        ))}
      </ScrollView>
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
