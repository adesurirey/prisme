/**
 * The Classement screen (issue #199): the shared static-page frame —
 * back and share chrome over the placeholder prose (the page itself is
 * #183); the share offers the page's public URL.
 */

import { useRouter } from 'expo-router';

import { CLASSEMENT_WEB_URL } from '@/data/pages';
import { Prose, StaticPage } from '@/screens/static-page';

const PARAGRAPHS = [
  "Cette page présentera le classement politique des médias français : où chaque média se situe sur l'éventail politique, du bord gauche au bord droit, selon les sources documentées pour chacun.",
  "Le classement s'appuie sur des études publiques et des classements établis par des tiers ; Prisme ne note jamais les médias lui-même — le prisme décrit, il ne juge pas.",
  'Le graphique du classement — la portée de chaque média face à sa tendance — sera rendu nativement, avec les mêmes formes que sur le site.',
  'Chaque média aura sa fiche : sa tendance, sa portée estimée, les sources qui l\u2019y placent, et les réserves éventuelles.',
  'Les médias exclus du classement — et la raison de leur exclusion — seront listés avec la même transparence.',
];

export function Classement() {
  const router = useRouter();
  return (
    <StaticPage
      title="Classement politique des médias"
      shareUrl={CLASSEMENT_WEB_URL}
      onBack={() => router.back()}
    >
      {PARAGRAPHS.map((paragraph) => (
        <Prose key={paragraph}>{paragraph}</Prose>
      ))}
    </StaticPage>
  );
}
