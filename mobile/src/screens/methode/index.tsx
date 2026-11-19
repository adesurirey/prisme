/**
 * The Méthode screen (issue #199): the shared static-page frame — back
 * and share chrome over the placeholder prose (the page itself is
 * #183); the share offers the page's public URL.
 */

import { useRouter } from 'expo-router';

import { METHODE_WEB_URL } from '@/data/pages';
import { Prose, StaticPage } from '@/screens/static-page';

const PARAGRAPHS = [
  'Prisme est un prototype : il montre chaque jour ce que les grands médias français mettent à la une, groupe ces unes par sujet, et décrit comment l\u2019information se répartit entre elles.',
  'Cette page présentera la méthode : la collecte des flux, le groupement des articles, la classification, les Résumés, les Différences — et les limites de chacune de ces étapes.',
  'Le code est libre : chaque étape est vérifiable, et les choix documentés dans les décisions d\u2019architecture qui l\u2019accompagnent.',
  'Prisme ne note jamais les médias. Il décrit la couverture — combien de médias rapportent un sujet, et comment leurs récits diffèrent.',
  'Les données viennent des flux RSS des médias eux-mêmes ; rien n\u2019est stocké au-delà de ce que les flux publient.',
];

export function Methode() {
  const router = useRouter();
  return (
    <StaticPage
      title="Méthode"
      shareUrl={METHODE_WEB_URL}
      onBack={() => router.back()}
    >
      {PARAGRAPHS.map((paragraph) => (
        <Prose key={paragraph}>{paragraph}</Prose>
      ))}
    </StaticPage>
  );
}
