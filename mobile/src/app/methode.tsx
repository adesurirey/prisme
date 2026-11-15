/**
 * The Méthode route placeholder (issue #195): a plain pushed route
 * carrying the prose from the old tab. The page itself — the method's
 * sections, the « qui sommes-nous » intro — is #183; the header chrome
 * is 5b–5d.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

const PARAGRAPHS = [
  'Prisme est un prototype : il montre chaque jour ce que les grands médias français mettent à la une, groupe ces unes par sujet, et décrit comment l\u2019information se répartit entre elles.',
  'Cette page présentera la méthode : la collecte des flux, le groupement des articles, la classification, les Résumés, les Différences — et les limites de chacune de ces étapes.',
  'Le code est libre : chaque étape est vérifiable, et les choix documentés dans les décisions d\u2019architecture qui l\u2019accompagnent.',
  'Prisme ne note jamais les médias. Il décrit la couverture — combien de médias rapportent un sujet, et comment leurs récits diffèrent.',
  'Les données viennent des flux RSS des médias eux-mêmes ; rien n\u2019est stocké au-delà de ce que les flux publient.',
];

export default function Methode() {
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
