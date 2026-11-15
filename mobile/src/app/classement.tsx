/**
 * The Classement route placeholder (issue #195): a plain pushed route
 * carrying the prose from the old tab. The page itself — intro,
 * leaning chart, directory — is #183; the header chrome is 5b–5d.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

const PARAGRAPHS = [
  "Cette page présentera le classement politique des médias français : où chaque média se situe sur l'éventail politique, du bord gauche au bord droit, selon les sources documentées pour chacun.",
  "Le classement s'appuie sur des études publiques et des classements établis par des tiers ; Prisme ne note jamais les médias lui-même — le prisme décrit, il ne juge pas.",
  'Le graphique du classement — la portée de chaque média face à sa tendance — sera rendu nativement, avec les mêmes formes que sur le site.',
  'Chaque média aura sa fiche : sa tendance, sa portée estimée, les sources qui l\u2019y placent, et les réserves éventuelles.',
  'Les médias exclus du classement — et la raison de leur exclusion — seront listés avec la même transparence.',
];

export default function Classement() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 },
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
