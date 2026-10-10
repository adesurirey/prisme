# Orientations politiques des médias de Prisme

Recherche sourcée derrière le classement Gauche / Centre / Droite des médias de
Prisme (issue #2). Le périmètre est **ouvert** (issue #10) : un média entre dans
l'Édition quand les trois critères sont réunis —

1. une diffusion ou audience significative (ACPM ou équivalent certifié) ;
2. un flux RSS fonctionnel, vérifié avec un User-Agent de navigateur normal ;
3. un Leaning sourcé selon la méthode ci-dessous (≥ 2 sources citées, désaccords écrits).

À ce jour, **28 médias** y répondent. La version typée de ce document est
`packages/domain/src/outlets.ts`, importée par le pipeline et le site ; les deux doivent
rester identiques (les tests du module font respecter les règles de preuve).

- **Méthode et règle de placement** ci-dessous, puis un dossier par média.
- **Vérifications** (flux RSS, réservations TDM) effectuées le **2026-10-10** avec un
  User-Agent de navigateur normal (tous les médias, issues #10, #11, #72 et #73). Chiffres ACPM : millésime **2025/2026** pour la presse
  (diffusion France payée certifiée), **août 2026** pour les sites (visites mensuelles).
- Conformément à l'ADR-0001, le Leaning appartient au média, jamais à un article. Les
  notes et citations de ce document sont écrites pour être **publiables telles quelles**
  sur `/pourquoi-ce-classement`.

---

## Méthode

### Ce que nous cherchons

Pour chaque média : une place sur cinq cases (**Gauche / Centre gauche / Centre / Centre
droit / Droite**), justifiée
par **au moins deux sources publiques indépendantes et citables** (études académiques,
analyses d'observatoires, rapports de régulateurs ou de défense de la liberté de la
presse, ouvrages de référence, chartes éditoriales, notations tierces, encyclopédies avec
leurs notes de bas de page), avec la **trace des désaccords** entre les sources. En plus :
une preuve d'audience (ou la raison de l'inclusion), les flux vérifiés, la mention du
paywall et la réservation éventuelle de fouille de textes et de données (TDM).

### Règle de placement

La référence la plus systématique trouvée est **FrIdéo** (Le French News Lab, ICNLSP
2026) : une échelle continue de positionnement pour 30 médias d'information nationaux
français, construite en fusionnant neuf familles de preuves indépendantes (propriété,
réseau de liens, enquêtes d'audience, chartes, profilage encyclopédique, invitations à
l'antenne, notations Media Bias/Fact Check et Ad Fontes, mesure lexicale sur 568 906
articles de 2024-2025), avec un intervalle de confiance par média.

FrIdéo décrit sept bandes ; Prisme en retient cinq (la PRD exclut toujours de distinguer
l'extrême gauche et l'extrême droite — issue #46). La règle, appliquée à tous les médias
couverts :

| Bande FrIdéo | Leaning Prisme |
|---|---|
| `far-left`, `left` | **Gauche** |
| `center-left` | **Centre gauche** |
| `center` | **Centre** |
| `center-right` | **Centre droit** |
| `right`, `far-right` | **Droite** |

La couverture et les synthèses regroupent ensuite ces cinq bandes en trois camps :
centre gauche compte avec la gauche, centre droit avec la droite (voir la section
« Couverture et angles morts » du site et ADR-0010).

Cette règle est symétrique et répétible : elle ne dépend pas de l'actualité ni des
goûts de l'équipe. Deux médias hors du panel FrIdéo (**Courrier international**,
**Europe 1**) sont placés à partir des autres sources, avec le raisonnement écrit.

### Choix des flux

Une seule règle, appliquée à tous les médias :

1. **`une`** quand le média publie un vrai flux de une (sélection éditoriale, quelques
   dizaines d'articles au plus).
2. **`latest`** = le flux le plus complet disponible (le flux « tous les articles » quand il
   existe), jamais un flux de rubrique choisi pour écarter du contenu.
3. **Le hors-nuit (météo, recettes, séries, jeux…) se filtre à la classification** (issue #4 :
   `news` / `opinion` / `live` / `not_news`), jamais en amont par le choix des flux : même
   traitement pour tous les médias, et les rubriques se décident côté Story (label), pas côté
   collecte.
4. Quand un flux est mort, vide ou sans dates, il est documenté dans le dossier du média
   plutôt que supprimé silencieusement.

### Ce que nous ne faisons pas

- Nous ne jugeons ni la qualité ni la fiabilité d'un média : le positionnement n'est pas
  une note de vérité (FrIdéo le rappelle explicitement).
- Nous ne classons pas les articles (ADR-0001).
- Nous n'inventons pas de contraste quand les sources se taisent : « centre non résolu »
  veut dire que les preuves ne départagent pas, pas que le média serait neutre par nature.

---

## Tableau récapitulatif

| Média | Leaning | Score FrIdéo (bande) | Audience (ACPM) | Paywall | TDM |
|---|---|---|---|---|---|
| L'Obs | Gauche | −0,89 (gauche) | 38e magazine, 162 242 ex. | Partiellement payant | non |
| Le HuffPost | Gauche | −1,00 (gauche) | 33e site, 17,9 M visites | Gratuit | non |
| Libération | Gauche | −1,08 (gauche) | 5e PQN, 119 943 ex. | Partiellement payant | non |
| Mediapart | Gauche | −1,63 (extrême gauche) | 257 383 abonnés (fin 2025) | Abonnement | non |
| Blast | Gauche | −1,65 (extrême gauche) | 33 625 abonnés payants (assermenté) | Gratuit | non |
| L'Humanité | Gauche | −2,41 (extrême gauche) | 7e PQN, 40 996 ex. | Gratuit | non |
| Le Monde | Centre | −0,71 (centre gauche) | 1er PQN, 564 586 ex. | Partiellement payant | indéterminé (402) |
| Marianne | Centre | −0,65 (centre gauche) | magazine, 100 527 ex. | Partiellement payant | **oui** |
| Slate.fr | Centre gauche | −0,53 (centre gauche) | 1er groupe podcasts ACPM, 2,4 M téléch. France (sept. 2026) | Gratuit | non |
| franceinfo | Centre | −0,41 (centre gauche) | 3e site, 136,5 M visites | Gratuit | **oui** |
| Ouest-France | Centre | −0,16 (centre) | 1er PQR, 580 981 ex. | Partiellement payant | **oui** |
| BFMTV | Centre | +0,07 (centre) | 5e site, 118,7 M visites | Gratuit | indéterminé (403) |
| 20 Minutes | Centre | −0,31 (centre gauche) | 8e site, 90,3 M visites | Gratuit | non |
| Le Parisien | Centre | +0,10 (centre) | 2e PQR, 196 365 ex. | Partiellement payant | **oui** |
| TF1 Info | Centre | +0,36 (centre droit) | hors classement ACPM | Gratuit | **oui** |
| RFI | Centre | −0,11 (centre) | 38e site, 13,6 M visites | Gratuit | **oui** |
| France 24 | Centre | −0,03 (centre) | 48e site, 9,5 M visites | Gratuit | **oui** |
| Courrier international | Centre | hors panel | 39e magazine, 162 073 ex. | Partiellement payant | non |
| L'Express | Centre | +0,18 (centre) | 54e magazine, 118 937 ex. | Partiellement payant | non |
| La Croix | Centre | +0,13 (centre) | 6e PQN, 73 595 ex. | Partiellement payant | non |
| Challenges | Centre | −0,10 (centre) | magazine, 232 050 ex. (DSH) | Partiellement payant | **oui** |
| Le Point | Centre | +0,56 (centre droit) | 20e magazine, 263 528 ex. | Partiellement payant | indéterminé (403) |
| L'Opinion | Centre droit | +0,60 (centre droit) | membre ACPM, 633 k (S1 2026) | En grande partie payant | non |
| Le Figaro | Droite | +1,02 (droite) | 2e PQN, 397 194 ex. | Partiellement payant | **oui** |
| CNews | Droite | +0,96 (droite) | 22e site, 30,2 M visites | Gratuit | non |
| Europe 1 | Droite | hors panel | 75e site, 4,7 M visites | Gratuit | non |
| Le JDD | Droite | +0,95 (droite) | 9e 7e jour, 118 153 ex. | Partiellement payant | non |
| Valeurs actuelles | Droite | +1,87 (extrême droite) | 89e magazine, 61 124 ex. | Partiellement payant | non |

PQN = presse quotidienne nationale, PQR = presse quotidienne régionale, 7e jour =
hebdomadaires du dimanche, magazine = presse magazine (classements ACPM 2025/2026).
« visites » = classement unifié des sites web grand public ACPM, août 2026.

---

## Les 28 médias

### L'Obs — Gauche

**Placement.** Bande `left` de FrIdéo → Gauche.

**Désaccords entre sources.** Aucun désaccord notable ; les deux sources pointent à
gauche.

**Sources**

1. **FrIdéo : où se situe Le Nouvel Obs ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/le-nouvel-obs> — « Score −0,89 dans la bande "gauche" (intervalle −1,54…−0,24) : le classement à gauche est soutenu par les données, 5 familles de preuves sur 9. »
2. **Le Nouvel Obs (article encyclopédique)** — Wikipédia (avec les ouvrages et articles cités en notes), 2026 — <https://fr.wikipedia.org/wiki/Le_Nouvel_Obs> — « Historiquement situé à gauche et d'inspiration mendésiste puis sociale-démocrate, le titre revendique depuis 2020 une ligne de gauche progressiste. »

**Audience.** ACPM presse magazine 2025/2026 : 38e rang, 162 242 exemplaires France
payée ; Nouvelobs.com : 46e rang des sites, 10,5 M de visites (août 2026).

**Flux vérifiés (2026-10-10).** `latest` <https://www.nouvelobs.com/rss.xml> — 200,
200 articles, ~6 jours couverts, images sur 80 articles. Flux volumineux : seul un
extrait de la journée arrive à la fenêtre des 24 h.

**Paywall / TDM.** Partiellement payant ; pas de `tdmrep.json` (404).

### Le HuffPost — Gauche

**Placement.** Bande `left` de FrIdéo → Gauche.

**Désaccords entre sources.** Deux réserves, écrites ici plutôt que cachées : FrIdéo ne
dispose que de 4 familles de preuves (intervalle large, −1,81…−0,18), et la référence de
Wikipédia porte sur l'édition américaine du HuffPost.

**Sources**

1. **FrIdéo : où se situe Le HuffPost ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/le-huffpost> — « Score −1,00 dans la bande "gauche" (intervalle −1,81…−0,18) : intervalle large, le média n'est couvert que par 4 familles de preuves. »
2. **Le HuffPost (article encyclopédique)** — Wikipédia (avec les sources citées en notes), 2026 — <https://fr.wikipedia.org/wiki/Le_HuffPost> — « La ligne éditoriale du HuffPost est généralement classée à gauche » — l'article renvoie surtout à l'édition américaine et à ses contributeurs (2011-2012).

**Audience.** ACPM sites web grand public : 33e rang, 17,9 M de visites en août 2026
(Huffingtonpost.fr).

**Flux vérifiés (2026-10-10).** `latest` <https://www.huffingtonpost.fr/rss/all_headline.xml>
— 200, 20 articles, ~6 h, images sur tous les articles. Unique flux RSS : tous les
titres en continu, sans sélection « à la une ».

**Paywall / TDM.** Gratuit ; pas de `tdmrep.json` (404).

### Libération — Gauche

**Placement.** Bande `left` de FrIdéo → Gauche.

**Désaccords entre sources.** Media Bias/Fact Check note « Left-Center » et Lucide
« Centre-gauche » ; FrIdéo, dont la fusion de neuf familles de preuves intègre ces
notations, place Libération en bande « gauche » avec un intervalle (−1,60…−0,56) qui
exclut zéro. La règle de placement suit FrIdéo ; les deux notations divergentes sont
publiées. À noter aussi : Acrimed critique le journal depuis la gauche (« quotidien de
Rothschild », célébration du néolibéralisme) — une contestation qui suppose précisément
un ancrage à gauche.

**Sources**

1. **FrIdéo : où se situe Libération ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/liberation> — « Score −1,08 dans la bande "gauche" (intervalle −1,60…−0,56) : le classement à gauche est soutenu par les données, 7 familles de preuves sur 9, rang 4 sur 30. »
2. **Libération, journal (article encyclopédique)** — Wikipédia (avec les ouvrages et articles cités en notes), 2026 — <https://fr.wikipedia.org/wiki/Lib%C3%A9ration_(journal)> — « On est le journal de toutes les gauches. Avec un clivage au sein de la rédaction : les plus jeunes sont plutôt LFI, les anciens sont sociaux-démocrates » (Alexandra Schwartzbrod, directrice adjointe de la rédaction, 2023) ; Serge July (2019) : « Sa sensibilité est de gauche ».
3. **Libération (Paris) – Bias and Credibility** — Media Bias/Fact Check, 2026 — <https://mediabiasfactcheck.com/liberation-paris-bias/> — « Noté "Left-Center" sur la base de la sélection de sujets et de positions éditoriales favorisant modérément la gauche ; fiabilité factuelle notée "High". »
4. **Libération : orientation politique, propriétaire et fiabilité** — Lucide, 2026 — <https://lucideinfo.fr/medias/liberation> — « Repère éditorial "Centre-gauche", à partir de la ligne éditoriale observée » : le seul désaccord de placement du dossier.

**Audience.** ACPM presse quotidienne nationale 2025/2026 : 5e rang, 119 943 exemplaires
France payée ; Liberation.fr : 35e rang des sites, 15,9 M de visites (août 2026).

**Flux vérifiés (2026-10-10).** `latest`
<https://www.liberation.fr/arc/outboundfeeds/rss/?outputType=xml> — 200, 50 articles,
~9 h, aucune image. Flux officiel de syndication de la plateforme Arc XP (Washington
Post), servi sur le domaine de Libération. Les flux `/rss/` historiques restent bloqués
par DataDome (403, vérifié le 2026-10-10 et le 2026-10-10, issue #11) : c'est ce flux qui
a débloqué l'entrée de Libération dans l'Édition. 50 articles au plus par fenêtre
d'environ 9 h ; l'endpoint n'est pas documenté publiquement par Libération et pourrait
être restreint (voir Limites connues).

**Paywall / TDM.** Partiellement payant ; pas de `tdmrep.json` (404 ; la page répond
depuis le serveur de Libération malgré DataDome).

### Mediapart — Gauche

**Placement.** Bande `far-left` de FrIdéo → rattachée à **Gauche** (notre échelle n'a pas
de case extrême gauche, voir la PRD).

**Désaccords entre sources.** Aucun : Mediapart assume une ligne de gauche, et FrIdéo le
place à l'extrême gauche de son panel.

**Sources**

1. **FrIdéo : où se situe Mediapart ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/mediapart> — « Score −1,63 dans la bande "extrême gauche" (intervalle −2,19…−1,08), 7 familles de preuves : l'un des deux médias les plus à gauche du panel. »
2. **Mediapart (article encyclopédique)** — Wikipédia (avec les articles et ouvrages cités en notes), 2026 — <https://fr.wikipedia.org/wiki/Mediapart> — « Le site […] a une ligne éditoriale orientée à gauche » ; Mediapart se présente comme un journal d'enquêtes indépendant.

**Audience.** 257 383 abonnés individuels et collectifs au 31 décembre 2025 (+10 % en un
an) — pas de diffusion papier certifiée ACPM : l'audience est celle d'un pure player
abonné. Source : Mediapart, *Mediapart 2025 en chiffres*,
<https://infographics.mediapart.fr/custom-pages/assets/documents/rapport-activite-2025/Mediapart_2025_en_chiffres.pdf>
(chiffre recoupé par Stratégies, 17/03/2026).

**Flux vérifiés (2026-10-10).** `latest` <https://www.mediapart.fr/articles/feed> — 200,
10 articles, ~12 h, images sur tous les articles.

**Paywall / TDM.** Abonnement (intégral) ; pas de `tdmrep.json` (404).

### Blast — Gauche

**Placement.** Bande `far-left` de FrIdéo → rattachée à **Gauche** (notre échelle n'a pas
de case extrême gauche, voir la PRD).

**Désaccords entre sources.** FrIdéo place Blast en bande « extrême gauche » (rang 2 sur
30, intervalle −2,39…−0,91 qui exclut zéro) mais ne le couvre qu'avec 4 familles de
preuves sur 9 : une part du score provient de l'« a priori de tradition fondatrice »,
et le média est voisin immédiat de Mediapart, avec des intervalles qui se recouvrent
(l'ordre entre deux voisins n'est pas tranchable par l'échelle). Wikipédia le classe
simplement « à gauche ». La règle de placement suit la bande FrIdéo ; l'écart entre
« extrême gauche » et « gauche » est écrit ici plutôt que lissé.

**Sources**

1. **FrIdéo : où se situe Blast ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/blast> — « Score −1,65 dans la bande "extrême gauche", au rang 2 sur 30 (intervalle −2,39…−0,91) ; 4 des 9 familles de preuves le couvrent directement, ce qui est peu : une part appréciable du score provient de l'a priori de tradition fondatrice. »
2. **Blast (média) (article encyclopédique)** — Wikipédia (avec les articles de presse cités en notes), 2026 — <https://fr.wikipedia.org/wiki/Blast_(m%C3%A9dia)> — « Classé à gauche, il combine une plateforme d'information généraliste et une web TV » ; « une ligne éditoriale qui se veut orientée à gauche » — en juin 2024, le média appelle à faire « front commun » contre l'extrême droite et à soutenir le Nouveau Front populaire.

**Audience.** Pas de certification ACPM (absent du classement des sites grand public de
septembre 2026, ni membre recensé). 33 625 abonnés payants, plus de 7 000 sociétaires,
~4 M€ de chiffre d'affaires et plus de 40 équivalents temps plein — chiffres **déclarés
sous serment** par Denis Robert devant la commission de la culture du Sénat (14 avril
2026) ; ~360 000 visites/mois estimées par Semrush (août 2026), du même ordre
qu'Atlantico. Réserve écrite : chiffres auto-déclarés, quoiqu'assermentés — aucune
donnée certifiée par un tiers ; le trafic site estimé reste très en dessous de tous les
sites certifiés de l'Édition. Détail et recoupements :
<https://github.com/adesurirey/prisme/blob/main/docs/research/blast-audience.md>.
Source primaire : Sénat, compte rendu de la commission de la culture, 14/04/2026,
<https://www.senat.fr/compte-rendu-commissions/20260413/cult.html>.

**Flux vérifiés (2026-10-10).** `latest` <https://api.blast-info.fr/rss_articles.xml> —
200, 100 articles, ~3 mois couverts, images sur les 100 articles. Le site est une SPA
qui ne référence aucun flux dans son HTML : les flux sont servis sur le sous-domaine
`api.blast-info.fr` — un premier audit (issue #71) les avait donc cherchés en vain sur
`www.blast-info.fr`. Un flux distinct couvre les émissions (`rss_emissions.xml`) : non
retenu, l'Édition agrège les articles. Contribution 24 h : ~2 articles — le rythme de
publication est faible, la fenêtre n'en capte pas toujours.

**Paywall / TDM.** Gratuit (sans publicité, financé par ses lecteurs) ; pas de
réservation TDM (`robots.txt` entièrement ouvert, pas de `tdmrep.json`, aucun en-tête
`tdm-reservation`).

### L'Humanité — Gauche

**Placement.** Bande `far-left` de FrIdéo → rattachée à **Gauche**.

**Désaccords entre sources.** Aucun ; l'ancrage au PCF est historique et assumé.

**Sources**

1. **FrIdéo : où se situe L'Humanité ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/l-humanite> — « Score −2,41, le plus à gauche des 30 médias du panel (intervalle −3,06…−1,76), sur 5 familles de preuves. »
2. **L'Humanité (article encyclopédique)** — Wikipédia (avec les travaux historiques cités en notes), 2026 — <https://fr.wikipedia.org/wiki/L%27Humanit%C3%A9> — Fondé en 1904 par Jean Jaurès, le quotidien est l'« organe central du Parti communiste français » : sa ligne éditoriale suit la ligne du parti.

**Audience.** ACPM quotidien nationaux 2025/2026 : 7e rang, 40 996 exemplaires France
payée ; Humanite.fr : 91e rang des sites, 3,3 M de visites (août 2026). Retenu pour sa
signification éditoriale (quotidien historique de la gauche communiste) plus que pour son
audience.

**Flux vérifiés (2026-10-10).** `latest` <https://www.humanite.fr/feed> — 200, 20
articles, ~2 h, images sur tous les articles. Flux très fréquent.

**Paywall / TDM.** Gratuit ; pas de `tdmrep.json` (404).

### Le Monde — Centre gauche

**Placement.** Bande `center-left` de FrIdéo → **Centre gauche**.

**Désaccords entre sources.** Cas le plus discuté du panel. FrIdéo range Le Monde dans
« centre gauche » (intervalle −1,23…−0,18, excluant zéro) et Media Bias/Fact Check le note
« LEFT-CENTER » ; le journal se définit comme indépendant des partis et plusieurs
descriptions le tiennent pour centriste (Lucide le dit « centre-gauche »). Le placement
suit la bande : ceux qui placent Le Monde à gauche ne sont pas « contredits » ici — la
divergence est documentée et la règle est publique.

**Sources**

1. **FrIdéo : où se situe Le Monde ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/le-monde> — « Score −0,71 dans la bande "centre gauche" (intervalle −1,23…−0,18), 7 familles de preuves. »
2. **Le Monde – Bias and Credibility** — Media Bias/Fact Check, 2026 — <https://mediabiasfactcheck.com/le-monde/> — Noté « LEFT-CENTER BIAS » (centre gauche).
3. **Le Monde (article encyclopédique, section « Positionnement politique »)** — Wikipédia (avec les ouvrages cités en notes, dont Eveno 2001), 2026 — <https://fr.wikipedia.org/wiki/Le_Monde> — Le Monde se veut indépendant des partis ; son histoire est décrite entre engagement à gauche (soutien à l'Union de la gauche dans les années 1970) et revendication d'ouverture à plusieurs courants.
4. **Le Monde : orientation politique, propriétaire et fiabilité** — Lucide (observatoire de médias), 2026 — <https://lucideinfo.fr/medias/le-monde> — Repère éditorial : « Centre-gauche » ; propriété : Niel / Pigasse / Křetínský / Fonds pour l'indépendance de la presse.

**Audience.** 1er quotidien national : ACPM 2025/2026, 564 586 exemplaires France payée ;
LeMonde.fr : 7e rang des sites, 95,5 M de visites (août 2026).

**Flux vérifiés (2026-10-10).** `une` <https://www.lemonde.fr/rss/une.xml> — 200, 16
articles, ~15 h, images partout ; `latest` <https://www.lemonde.fr/rss/en_continu.xml> —
200, 60 articles, ~27 h, images partout.

**Paywall / TDM.** Partiellement payant ; réservation TDM **indéterminée** :
`lemonde.fr/.well-known/tdmrep.json` répond 402 « Accès restreint ».

### Marianne — Centre gauche

**Placement.** Bande `center-left` de FrIdéo → **Centre gauche**.

**Désaccords entre sources.** L'un des désaccords les plus nets du panel FrIdéo : la
famille « propriété » (Daniel Křetínský) place Marianne à droite du centre, quand les
familles « réseau de liens » et
« contenu » la placent à gauche. Les sources descriptives vont dans le même sens : Le
Monde décrit un « lent glissement conservateur », Wikipédia un engagement souverainiste
depuis les années 2010. La mesure agrégée (intervalle excluant zéro) reste pourtant à
gauche du centre ; la bande `center-left` est retenue telle quelle (**Centre gauche**). Ce
glissement restera à suivre à chaque campagne de mise à jour de la configuration — c'est
le miroir du cas du JDD : là, la mesure rattrapait le récit ; ici, elle ne l'a pas encore
rattrapé.

**Sources**

1. **FrIdéo : où se situe Marianne ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/marianne> — « Score −0,65 dans la bande "centre gauche" (intervalle −1,24…−0,06), 6 familles de preuves ; la propriété le place à droite du centre, les familles réseau et contenu à gauche. »
2. **La saga de « Marianne », hebdomadaire « anti-pensée unique », ses convulsions et son lent glissement conservateur** — Le Monde, 2024-06-21 — <https://www.lemonde.fr/economie/article/2024/06/21/la-saga-de-marianne-hebdo-anti-pensee-unique-ses-convulsions-et-son-lent-glissement-conservateur_6242147_3234.html> — La ligne du magazine a dérivé à droite au fil des changements d'actionnariat et de direction, sans s'ancrer nettement.
3. **Marianne (article encyclopédique)** — Wikipédia, 2026 — <https://fr.wikipedia.org/wiki/Marianne_(magazine)> — Perçu comme de gauche à sa création (1997), le magazine s'engage au cours des années 2010 vers une ligne souverainiste ; diffusion 127 872 exemplaires (2024).

**Audience.** ACPM magazines 2025/2026 : 100 527 exemplaires France payée ; marianne.net :
4,8 M de visites par mois.

**Flux vérifiés (2026-10-10).** `latest` <https://www.marianne.net/rss.xml> — 200, 20
articles, ~32 h, images partout (enclosures). Fragile aux robots : `marianne.net/rss`
répond 403 (page HTML de blocage) sans en-têtes de navigateur complets, puis 301 vers
`rss.xml` — à surveiller à chaque vérification.

**Exclusion de facto en CI (2026-10-08, issue #35).** Depuis son ajout, Marianne a
contribué zéro article aux éditions construites en CI : l'arête AWS WAF de
marianne.net (devant CloudFront) répond **405** avec `x-amzn-waf-action: captcha` aux
adresses IP des runners GitHub, quel que soit le User-Agent ou les en-têtes — vérifié
depuis un runner avec curl et Node fetch, sur toutes les URL du domaine (run
37777088410). Le flux répond 200 localement, d'où l'invisibilité : `pnpm verify` tourne
en local. Aucune URL alternative n'existe (les sous-domaines `feeds.`/`static.`/
`backend.` ne résolvent pas). Le JDD, média du même groupe, échoue de la même façon
(403) dans les mêmes builds. Le remède systémique — relayer les requêtes de flux CI
par un petit proxy — reste à décider ; en attendant, la ligne « Contribution » du
journal de build rend toute contribution nulle visible (issue #35).

**Paywall / TDM.** Partiellement payant ; **réservation TDM publiée** (`tdm-reservation:
1` pour `/`, avec une politique `tdm-policy.json`).

### Slate.fr — Centre gauche

**Placement.** Bande `center-left` de FrIdéo → **Centre gauche**. L'intervalle de confiance
(−1,27…+0,21) contient zéro : la bande est une convention de lecture, pas un départage
(Limites connues, point 3). Slate.fr est aussi l'un des médias les moins couverts du panel
(4 familles de preuves sur 9) : une part notable du score vient de l'a priori de tradition
fondatrice — celle de Slate US, dont Slate.fr reprend le concept — et FrIdéo le dit
explicitement.

**Désaccords entre sources.** Wikipédia décrit un magazine « de centre-gauche »
(l'édition française reprenant le concept, la gratuité et l'habillage de la version
américaine) ; Acrimed tient au contraire Slate.fr pour « parfaitement partisan » malgré
sa revendication de non-partisanat, « plus proche du blog que du site d'information ».
La famille de preuve la plus directement informative ici, le score lexical « sensible à
la distanciation » de FrIdéo (−1,02), va dans le sens d'une écriture positionnée mais pas
militante. Nous retenons la bande mesurée, avec ce désaccord écrit.

**Sources**

1. **FrIdéo : où se situe Slate.fr ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 (échelle FrIdéo version 1.0, 2026-08-10, relative au panel de 30 médias) — <https://frenchnewslab.org/fr/medias/slate-fr> — « Score −0,53 dans la bande "centre gauche" (intervalle −1,27…+0,21) : l'intervalle contient zéro et 4 familles de preuves seulement couvrent le média ; le score lexical sensible à la distanciation vaut −1,02. »
2. **Slate (article encyclopédique, édition française)** — Wikipédia (avec les articles cités en notes), 2026 — <https://fr.wikipedia.org/wiki/Slate.fr> — « Le magazine, de centre-gauche » ; Slate.fr, lancé en 2009 par Colombani, Leser, Hufnagel, Le Boucher et Attali, reprend le concept, la gratuité et l'habillage de la version américaine.
3. **Slate.fr : jeune site, vieilles rengaines** — Acrimed (Matthieu Vincent), 2026 — <https://www.acrimed.org/Slate-fr-jeune-site-vieilles-rengaines> — « Il se présente comme un site non partisan d'information. Or il est parfaitement partisan » : pour l'observatoire, le commentaire prime sur l'enquête, l'opinion sur le fait.

**Audience.** Aucune certification ACPM « sites » n'a été trouvée pour slate.fr ; l'audience
certifiée est celle des podcasts : Groupe Slate est 1er rang des groupes podcasts ACPM
(septembre 2026, 2 395 428 téléchargements France). La décision d'inclusion (commentaire
de l'issue #73) retient ce signal d'audience certifié côté podcasts en l'absence de
certification site.

**Flux vérifiés (2026-10-10).** `latest` <https://slate.fr/rss.xml> — 200, 22 articles,
images partout, champs entre CDATA. Flux court : ~9 articles dans les dernières 24 h,
mais les anciens items restent dans le flux ~4 mois (126 jours couverts au total).
`slate.fr` redirige 301 vers `www.slate.fr` : c'est la même ressource.

**Paywall / TDM.** Gratuit : l'offre « Slate+ » (lancée en octobre 2016) vend des services
et des contenus additionnels (podcasts, Transfert Club), les articles restent en accès
libre. Pas de `tdmrep.json` (404).

### franceinfo — Centre gauche

**Placement.** Bande `center-left` de FrIdéo, intervalle contenant zéro → **Centre gauche**
(la bande est retenue même sans départage).

**Désaccords entre sources.** Aucun départage : FrIdéo (le média le mieux couvert du
panel, 8 familles) place franceinfo dans « centre gauche » sans que l'intervalle exclue
zéro. Le statut de service public milite pour le Centre ; la règle de placement donne le
même résultat.

**Sources**

1. **FrIdéo : où se situe Franceinfo ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/franceinfo> — « Score −0,41, bande "centre gauche" mais intervalle −0,93…+0,11 contenant zéro : non résolu. »
2. **France Info (offre globale) (article encyclopédique)** — Wikipédia, 2026 — <https://fr.wikipedia.org/wiki/France_Info_(offre_globale)> — France Info est l'offre d'information publique portée par France Télévisions et Radio France, dont les conventions imposent indépendance, exactitude et pluralisme.

**Audience.** 3e rang des sites web ACPM (grand public), 136,5 M de visites en août 2026
(Franceinfo.fr).

**Flux vérifiés (2026-10-10).** `latest` <https://www.francetvinfo.fr/titres.rss> — 200,
33 articles, ~24 h, images partout.

**Paywall / TDM.** Gratuit ; **réservation TDM publiée** (`tdm-reservation: 1`, avec une
politique sur franceinfo.fr).

### Ouest-France — Centre

**Placement.** Bande `center` de FrIdéo → **Centre**.

**Désaccords entre sources.** Wikipédia indique « Centre-droit, Démocratie chrétienne »
quand FrIdéo ne départage pas Ouest-France du centre. La démocratie chrétienne se lit des
deux côtés du centre ; nous retenons Centre et signalons la nuance « centre droit ».

**Sources**

1. **FrIdéo : où se situe Ouest-France ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/ouest-france> — « Score −0,16, bande "centre" (intervalle −0,81…+0,49) : au milieu du panel, sans orientation résolue. »
2. **Ouest-France (article encyclopédique)** — Wikipédia (avec les fiches ACPM citées en notes), 2026 — <https://fr.wikipedia.org/wiki/Ouest-France> — Positionnement politique indiqué dans l'article : « Centre-droit, Démocratie chrétienne » ; premier quotidien payant français en diffusion depuis 1975.

**Audience.** 1er quotidien français toute catégorie : ACPM presse quotidienne régionale
2025/2026, 580 981 exemplaires France payée (rang 1) ; ouest-france.fr : 1er rang des
sites, 185,5 M de visites (août 2026).

**Flux vérifiés (2026-10-10).** `une` <https://www.ouest-france.fr/rss/une> — 200, 10
articles, ~30 min, images partout ; `latest` <https://www.ouest-france.fr/rss-en-continu.xml>
— 200, 10 articles, ~30 min, images partout. **Les deux flux servent les mêmes 10
articles** (vérifié le 2026-10-10) : le flux « en continu » n'apporte rien de plus.

**Paywall / TDM.** Partiellement payant ; **réservation TDM publiée** pour « / »
(`tdm-reservation: 1`) ; « /shopping/ » et « /tourisme/ » ne sont pas réservés.

### BFMTV — Centre

**Placement.** Bande `center` de FrIdéo → **Centre**.

**Désaccords entre sources.** Le plus visible après Le Monde : la charte de la chaîne
revendique impartialité et neutralité, Acrimed décrit une chaîne qui « met la barre (très)
à droite » sur certains choix éditoriaux, FrIdéo la situe au milieu du panel avec des
signaux contradictoires selon les familles de preuves. Nous retenons Centre, qui est aussi
la position la plus souvent attribuée au média.

**Sources**

1. **FrIdéo : où se situe BFMTV ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/bfmtv> — « Score +0,07, bande "centre" (intervalle −0,55…+0,69) : strictement au milieu du panel, sans orientation résolue. »
2. **Les 50 engagements de BFMTV (charte de déontologie)** — BFMTV (groupe RMC-BFM), 2024 — <https://www.bfmtv.com/static/nxt-bfmtv/pdf/charte-deontologie-bfmtv.pdf> — « BFMTV s'engage à garantir le pluralisme et à diffuser une information exacte et conforme à la réalité, qui proscrit toute présentation partiale des faits » (engagements 29-30).
3. **BFM-TV (dossier d'analyse)** — Acrimed (observatoire des médias), 2020 — <https://www.acrimed.org/+-BFM-TV-+> — Acrimed décrit au contraire une chaîne qui « met la barre (très) à droite » (« Après Conflans, toujours moins de pluralisme sur BFM-TV », déc. 2020).

**Audience.** 5e rang des sites web ACPM (grand public), 118,7 M de visites en août 2026
(Bfmtv.com) ; première chaîne d'information en continu française par son audience web.

**Flux vérifiés (2026-10-10).** `latest` <https://www.bfmtv.com/rss/news-24-7/> — 200,
30 articles, ~13 h, images partout.

**Paywall / TDM.** Gratuit ; réservation TDM **indéterminée** (la sonde est bloquée par un
pare-feu, 403).

### 20 Minutes — Centre gauche

**Placement.** Bande `center-left` de FrIdéo, intervalle contenant zéro → **Centre gauche**
(la bande est retenue même sans départage).

**Désaccords entre sources.** La charte revendique la neutralité, Media Bias/Fact Check
note « LEFT-CENTER », FrIdéo « centre gauche » sans départage. La bande `center-left`
est retenue telle quelle.

**Sources**

1. **FrIdéo : où se situe 20 Minutes ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/20-minutes> — « Score −0,31, bande "centre gauche" mais intervalle −0,82…+0,19 contenant zéro : non résolu. »
2. **La charte de « 20 Minutes »** — 20 Minutes, 2026 — <https://www.20minutes.fr/charte-20minutes> — « L'indépendance et la neutralité politiques et religieuses sont dans les fondements même de la pratique éditoriale de 20 Minutes » (charte du média, actionnaires Sipa Ouest-France et Groupe Rossel).
3. **20 Minutes – Bias and Credibility** — Media Bias/Fact Check, 2026 — <https://mediabiasfactcheck.com/20-minutes/> — Noté « LEFT-CENTER BIAS » (centre gauche).

**Audience.** 8e rang des sites web ACPM (grand public), 90,3 M de visites en août 2026
(20minutes.fr). Presse gratuite : pas de diffusion payée certifiée ACPM.

**Flux vérifiés (2026-10-10).** `une` <https://www.20minutes.fr/feeds/rss-une.xml> — 200,
30 articles, ~6 jours, images partout. Le flux « une » accumule les choix de la journée
sur plusieurs jours : il sert de front page par défaut. Pas de flux « latest » : les
autres URL `/feeds/*` répondent 403 (vérifié le 2026-10-10).

**Paywall / TDM.** Gratuit ; pas de `tdmrep.json` (404).

### Le Parisien — Centre

**Placement.** Bande `center` de FrIdéo → **Centre**.

**Désaccords entre sources.** Media Bias/Fact Check le note « RIGHT-CENTER » quand FrIdéo
ne le départage pas du centre (et précise que Le Parisien et BFMTV ne sont pas départagés
par l'échelle) et que le journal se définit comme généraliste. À surveiller : Wikipédia
mentionne des tractations entre Bernard Arnault et Vincent Bolloré fin 2025 pour la vente
du titre.

**Sources**

1. **FrIdéo : où se situe Le Parisien ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/le-parisien> — « Score +0,10, bande "centre" (intervalle −0,40…+0,61) : non résolu. »
2. **Le Parisien – Bias and Credibility** — Media Bias/Fact Check, 2026 — <https://mediabiasfactcheck.com/le-parisien/> — Noté « RIGHT-CENTER BIAS » (centre droit).
3. **Le Parisien (article encyclopédique)** — Wikipédia (avec les chiffres ACPM cités en notes), 2026 — <https://fr.wikipedia.org/wiki/Le_Parisien> — « La ligne éditoriale est généraliste, s'intéressant particulièrement aux faits divers et à l'actualité locale » ; détenu par Bernard Arnault (LVMH) depuis 2015.

**Audience.** ACPM 2025/2026 : 196 365 exemplaires France payée (2e rang presse
quotidienne régionale ; 261 437 avec le couplage « Le Parisien + Aujourd'hui en France ») ;
LeParisien.fr : 12e rang des sites, 61,9 M de visites (août 2026).

**Flux vérifiés (2026-10-10).** `latest` <https://feeds.leparisien.fr/leparisien/rss> —
200, 100 articles, **aucune date ni image** (titre et lien uniquement), temps couvert :
non mesurable. Les articles sont datés par le collecteur depuis le slug de leur URL
(JJ-MM-AAAA, ~96 % des items ; datés à la collecte pour le reste — ADR-0007, issue #12) :
ils entrent dans la fenêtre des 24 h sans heure affichée. Ils restent sans image ni
chapô : pas de photo quand Le Parisien est seul sur un sujet, classification sur le titre
seul. L'ancien flux « en-continu » répond 200 avec 0 article, et « rss/une » sert des
archives de 2019 (vérifié le 2026-10-10).

**Paywall / TDM.** Partiellement payant ; **réservation TDM publiée**
(`tdm-reservation: 1`), avec une politique par agent (GPTBot, ClaudeBot…).

### TF1 Info — Centre droit

**Placement.** Bande `center-right` de FrIdéo, intervalle contenant zéro → **Centre droit**
(la bande est retenue même sans départage).

**Désaccords entre sources.** Les enquêtes d'audience perçoivent TF1 Info à droite
(+1,30 sur cette famille FrIdéo, le signal le plus à droite du panel) ; les autres
familles le placent au centre et l'intervalle global contient zéro. La bande
`center-right` est retenue telle quelle (**Centre droit**), et la perception est notée.

**Sources**

1. **FrIdéo : où se situe TF1 INFO ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/tf1-info> — « Score +0,36, bande "centre droit" mais intervalle −0,31…+1,03 contenant zéro : non résolu, alors que la famille "orientation perçue en enquêtes" le place nettement à droite (+1,30). »
2. **LCI / TF1 Info (article encyclopédique)** — Wikipédia, 2026 — <https://fr.wikipedia.org/wiki/LCI> — Chaîne d'information du Groupe TF1 (privé, groupe Bouygues), devenue la marque d'information « TF1 Info » ; aucune ligne partisane n'y est revendiquée.

**Audience.** Absente du classement ACPM des sites ; retenue comme marque d'information de
la première chaîne de télévision privée française (Groupe TF1), audience mesurée par
Médiamétrie plutôt que par l'ACPM.

**Flux vérifiés (2026-10-10).** `latest` <https://www.tf1info.fr/feeds/rss-une.xml> — 200,
100 articles, ~3 jours, images partout. Malgré son nom, ce flux est un feu complet (JT,
émissions, recettes, météo) : traité en flux « latest », 10 articles récents pour la
front page.

**Paywall / TDM.** Gratuit ; **réservation TDM publiée** (`tdm-reservation: 1`).

### RFI — Centre

**Placement.** Bande `center` de FrIdéo → **Centre**.

**Désaccords entre sources.** Aucun : média public international, charte d'éthique
contraignante, position médiane sur l'échelle.

**Sources**

1. **FrIdéo : où se situe RFI ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/rfi> — « Score −0,11, bande "centre" (intervalle −0,61…+0,40) : au milieu du panel, sans orientation résolue. »
2. **Nos engagements — Déontologie** — France Médias Monde (société mère de RFI et France 24), 2026 — <https://www.francemediasmonde.com/fr/nos-engagements> — « RFI, France 24 et MCD portent un engagement commun : apporter une information libre, indépendante, experte, équilibrée et pluraliste », encadré par une charte d'éthique et de déontologie.
3. **Radio France internationale (article encyclopédique)** — Wikipédia, 2026 — <https://fr.wikipedia.org/wiki/Radio_France_internationale> — Radio publique française d'information internationale, éditée par France Médias Monde, société de l'audiovisuel extérieur de l'État.

**Audience.** 38e rang des sites web ACPM, 13,6 M de visites en août 2026 (Rfi.fr) ;
audience mondiale (132 relais FM/DAB+, 1 950 radios partenaires selon France Médias Monde).

**Flux vérifiés (2026-10-10).** `latest` <https://www.rfi.fr/fr/rss> — 200, 23 articles,
~14 h, images partout.

**Paywall / TDM.** Gratuit ; **réservation TDM publiée** (`tdm-reservation: 1`) ; une
sonde de contrôle peut être filtrée par le pare-feu du site (403 observé une fois).

### France 24 — Centre

**Placement.** Bande `center` de FrIdéo → **Centre** (le média le plus proche du centre du
panel).

**Désaccords entre sources.** Aucun.

**Sources**

1. **FrIdéo : où se situe France 24 ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/france-24> — « Score −0,03, bande "centre" (intervalle −0,53…+0,48) : le média le plus proche du centre du panel. »
2. **Nos engagements — Déontologie** — France Médias Monde, 2026 — <https://www.francemediasmonde.com/fr/nos-engagements> — « RFI, France 24 et MCD portent un engagement commun : apporter une information libre, indépendante, experte, équilibrée et pluraliste. »
3. **France 24 (article encyclopédique)** — Wikipédia, 2026 — <https://fr.wikipedia.org/wiki/France_24> — Quatre chaînes d'information continue du service public audiovisuel extérieur français (France Médias Monde), diffusées dans 577 millions de foyers.

**Audience.** 48e rang des sites web ACPM, 9,5 M de visites en août 2026 (France24.com) ;
diffusion mondiale dans 577 millions de foyers (France Médias Monde).

**Flux vérifiés (2026-10-10).** `latest` <https://www.france24.com/fr/rss> — 200, 24
articles, ~4 h, images sur 22 articles.

**Paywall / TDM.** Gratuit ; **réservation TDM publiée** (`tdm-reservation: 1`) ; une
sonde de contrôle peut être filtrée par le pare-feu du site (403 observé une fois).

### Courrier international — Centre

**Placement.** Hors panel FrIdéo. Trois sources convergentes mais pas identiques ;
aucune ne le place à gauche de notre échelle à cinq cases → **Centre**, la nuance
« centre gauche » restant documentée ci-dessous.

**Désaccords entre sources.** « Social-démocrate » (Wikipédia), « libéral »
(eurotopics/Bertelsmann), « centre-gauche » (Lucide). Le titre se définit par son ouverture
internationale (la presse étrangère traduite) plus que par un positionnement partisan.
Placé à Centre, la nuance « centre gauche » / « social-démocrate » restant documentée
ici et dans le module de configuration.

**Sources**

1. **Courrier international (article encyclopédique)** — Wikipédia (avec les chiffres ACPM cités en notes), 2026 — <https://fr.wikipedia.org/wiki/Courrier_international> — « Sa ligne éditoriale social-démocrate vise à offrir un regard étranger sur l'actualité » ; hebdomadaire du groupe Le Monde, diffusion 161 069 exemplaires (2021).
2. **Courrier International — profil de média** — eurotopics (Bertelsmann Stiftung), 2026 — <https://www.eurotopics.net/fr/148466/courrier-international> — Orientation politique indiquée : « libéral » ; diffusion 159 000 exemplaires (2022), modèle « articles en partie payants ».
3. **Courrier International : orientation politique, propriétaire et fiabilité** — Lucide (observatoire de médias), 2026 — <https://lucideinfo.fr/medias/courrier-international> — Repère éditorial : « Centre-gauche » ; propriété : Fonds pour l'indépendance de la presse → groupe Le Monde.

**Audience.** ACPM presse magazine 2025/2026 : 39e rang, 162 073 exemplaires France
payée ; CourrierInternational.com : 56e rang des sites, 7,9 M de visites (août 2026).

**Flux vérifiés (2026-10-10).** `latest`
<https://www.courrierinternational.com/feed/all/rss.xml> — 200, 20 articles, ~6 h, images
partout. (Les URL `courrierinternational.com/feed` et `/rss` servent une page HTML.)

**Paywall / TDM.** Partiellement payant ; pas de `tdmrep.json` (404).

### L'Express — Centre

**Placement.** Bande `center` de FrIdéo → **Centre**.

**Désaccords entre sources.** L'un des cas les plus discutés (la PRD le signalait). Les
descriptions historiques vont du « centre gauche » mendésiste des origines (1953,
Jean-Jacques Servan-Schreiber, Raymond Aron) au « centre droit » libéral des dernières
décennies. FrIdéo ne le départage pas du centre aujourd'hui. Nous retenons Centre, en
signalant que le classement d'un magazine qui a beaucoup bougé est, par construction, le
plus fragile du panel.

**Sources**

1. **FrIdéo : où se situe L'Express ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/l-express> — « Score +0,18, bande "centre" (intervalle −0,43…+0,78) : non résolu, 6 familles de preuves. »
2. **L'Express (article encyclopédique, section « Ligne éditoriale »)** — Wikipédia (avec les ouvrages et articles cités en notes), 2026 — <https://fr.wikipedia.org/wiki/L%27Express> — Hebdomadaire fondé en 1953, historiquement classé du centre gauche (mendésiste, social-libéral) au centre droit selon les époques et les directions.

**Audience.** ACPM presse magazine 2025/2026 : 54e rang, 118 937 exemplaires France
payée ; Lexpress.fr : 62e rang des sites, 6,7 M de visites (août 2026).

**Flux vérifiés (2026-10-10).** `latest` <https://www.lexpress.fr/rss/alaune.xml> — 200,
100 articles, ~5,5 jours, images partout. Flux « à la une » volumineux : traité en flux
« latest », 10 articles récents pour la front page.

**Paywall / TDM.** Partiellement payant ; pas de `tdmrep.json` (404).

### La Croix — Centre

**Placement.** Bande `center` de FrIdéo → **Centre**.

**Désaccords entre sources.** Lucide le dit « centre-droit », FrIdéo non résolu ;
l'héritage chrétien-démocrate peut se lire de part et d'autre du centre (FrIdéo le note
lui-même : tradition catholique à droite, preuves directes au centre). Nous retenons
Centre, avec la nuance « centre droit » documentée.

**Sources**

1. **FrIdéo : où se situe La Croix ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/la-croix> — « Score +0,13, bande "centre" (intervalle −0,52…+0,77) : non résolu » ; la tradition catholique range le titre au centre droit pour les sources de tradition, au centre pour les preuves directes.
2. **La Croix : orientation politique, propriétaire et fiabilité** — Lucide (observatoire de médias), 2026-08-12 — <https://lucideinfo.fr/medias/la-croix> — Repère éditorial : « Centre-droit » ; propriété : groupe Bayard (association des Assomptionnistes), qui publie aussi sa charte éditoriale.
3. **La Croix (article encyclopédique)** — Wikipédia (avec les chiffres ACPM cités en notes), 2026 — <https://fr.wikipedia.org/wiki/La_Croix> — Quotidien catholique d'information politique et générale, édité par le groupe Bayard depuis sa fondation en 1883 ; diffusion 91 762 exemplaires (2022).

**Audience.** ACPM quotidien nationaux 2025/2026 : 6e rang, 73 595 exemplaires France
payée ; La-croix.com : 86e rang des sites, 3,5 M de visites (août 2026).

**Flux vérifiés (2026-10-10).** `latest` <https://www.la-croix.com/rss> — 200, 50
articles, ~25 h, images partout. Flux général, toutes rubriques (religion et culture
comprises) : les rubriques sont tranchées par la classification (#4), pas par le choix du
flux. Le flux `/rss/france` (actualité nationale) existe si un périmètre restreint devenait
souhaitable.

**Paywall / TDM.** Partiellement payant ; pas de `tdmrep.json` (404).

### Challenges — Centre

**Placement.** Bande `center` de FrIdéo → **Centre**.

**Désaccords entre sources.** L'intervalle de confiance de FrIdéo (−0,84…+0,63)
contient zéro et seules 4 familles de preuves sur 9 couvrent directement le média : la
bande « centre » est lue comme une indication, pas comme un verdict (voir Limites
connues, point 3). Les épisodes éditoriaux documentés vont dans les deux sens — une
« une » anti-Le Pen dans l'entre-deux-tours de 2022, une « une » anti-Mélenchon la
même année imposée par le propriétaire, un « parti-pris Macron » contesté par la
Société des journalistes en 2017 — et aucune source consultée ne place le magazine
hors du centre. Le changement de propriété est trop récent pour la mesure : FrIdéo
retient Claude Perdriel comme propriétaire final, alors que LVMH détient le titre à
100 % depuis décembre 2025 (Wikipédia, avec Le Figaro du 30 décembre 2025).

**Sources**

1. **FrIdéo : où se situe Challenges ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 (échelle FrIdéo version 1.0, 2026-08-10, relative au panel de 30 médias) — <https://frenchnewslab.org/fr/medias/challenges> — « Score −0,10 dans la bande "centre" (intervalle −0,84…+0,63) : l'intervalle contient zéro, 4 familles de preuves sur 9 seulement ; l'étiquette est une indication, pas un verdict. »
2. **Challenges (article encyclopédique)** — Wikipédia (avec les articles de presse cités en notes), 2026 — <https://fr.wikipedia.org/wiki/Challenges> — « Magazine économique fondé en 1982, devenu newsmag généraliste en 2021 ; détenu à 100 % par LVMH depuis décembre 2025 ; en 2017, des journalistes déploraient que leur journal "roule pour Macron", et en 2022 une "une" anti-Mélenchon imposée par Claude Perdriel a créé des remous au sein de la rédaction. »
3. **La présidentielle à Challenges : les « observations » de la société des journalistes (SDJ)** — Acrimed, 2017-03-31 — <https://www.acrimed.org/La-presidentielle-a-Challenges-les-observations> — « La SDJ dénonce le parti-pris du site en faveur d'Emmanuel Macron et les interventions du directeur de la publication auprès de l'équipe web après un article critique à l'égard de Macron. »

**Audience.** ACPM presse magazine 2025/2026 : DSH 232 050 exemplaires ; le site
Challenges.fr suit le classement unifié des sites web ACPM.

**Flux vérifiés (2026-10-10, issue #72).** `latest` <https://www.challenges.fr/rss.xml>
— 200, 50 articles, ~3 j, images sur tous les articles. Flux unique du média, toutes
rubriques confondues (le hors-nuit se filtre à la classification, issue #4) ; titres et
dates en CDATA (corrigé côté parseur, voir le dépôt). Chaque article porte un marqueur
`rssplus:free` (0/1) : un indicateur de paywall du média lui-même.

**Paywall / TDM.** Partiellement payant ; **réservation TDM publiée** :
`/.well-known/tdmrep.json` redirige vers `/tdmrep.json`, qui publie `tdm-reservation: 1`
pour tout le site (vérifié le 2026-10-10). Le site bloque par ailleurs GPTBot, CCBot et
PerplexityBot (vérifié le 2026-10-10) : un blocage anti-IA, distinct de la réservation
TDM. La PRD prévoyait « aucune réservation détectée » le 2026-10-10 : une sonde sans
suivi de redirection la manquait ; c'est la sonde de `pnpm verify` (fetch, redirections
suivies) qui fait foi.

### Le Point — Centre droit

**Placement.** Bande `center-right` de FrIdéo → **Centre droit**.

**Désaccords entre sources.** L'intervalle de confiance de FrIdéo (−0,09…+1,22)
contient zéro : les données seules ne départagent pas le centre, et la bande
« centre droit » est lue comme une indication (15 des 30 médias de FrIdéo sont dans
ce cas ; voir Limites connues, point 3). Les notations tierces concordent néanmoins
sur l'ancrage centre-droit : Media Bias/Fact Check note « Right-Center » et Lucide
« Centre-droit ». Aucune source consultée ne place Le Point à gauche ; l'héritage
libéral-conservateur du titre (fondé en 1972 par des journalistes de L'Express) borne
le placement sans le pousser à Droite, FrIdéo le séparant nettement de Le Figaro
(+0,56 contre +1,02).

**Sources**

1. **FrIdéo : où se situe Le Point ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/le-point> — « Score +0,56 dans la bande "centre droit" (intervalle −0,09…+1,22) : l'intervalle contient zéro, la bande doit être lue comme une indication, non comme un verdict ; 5 familles de preuves sur 9 ; propriétaire final François Pinault (Artémis). »
2. **Le Point – Bias and Credibility** — Media Bias/Fact Check, 2024 — <https://mediabiasfactcheck.com/le-point-bias/> — « Noté "Right-Center" sur la base de la sélection de sujets et de positions éditoriales favorisant modérément la droite, tout en présentant des points de vue divers ; fiabilité factuelle notée "High". »
3. **Le Point : orientation politique, propriétaire et fiabilité** — Lucide, 2026 — <https://lucideinfo.fr/medias/le-point> — « Repère éditorial "Centre-droit" ; ligne libérale-conservatrice ; propriété : François-Henri Pinault (Kering, luxe). »

**Audience.** ACPM presse magazine 2025/2026 : 20e rang, 263 528 exemplaires France
payée (hebdomadaire, DSH).

**Flux vérifiés (2026-10-10).** `latest`
<https://www.lepoint.fr/arc/outboundfeeds/rss/?outputType=xml> — 200, 100 articles,
~2 j, toutes les entrées avec image. Endpoint de syndication Arc XP, non documenté
publiquement par Le Point — le même mécanisme qui a débloqué Libération (issue #11).
Les flux historiques (`/feeds/rss.xml`, `/feed`, `/actualites.rss`) restent bloqués
(403, vérifié le 2026-10-10 et le 2026-10-10), ainsi que les pages du site, servies
 derrière un anti-bot ; seul l'endpoint de syndication y échappe. 100 articles au
plus par fenêtre d'environ 2 j ; il pourrait être restreint ou supprimé sans préavis
(voir Limites connues).

**Paywall / TDM.** Partiellement payant ; réservation TDM indéterminée : la sonde
`tdmrep.json` est bloquée par l'anti-bot (403) comme le reste du site.

### L'Opinion — Centre droit

**Placement.** Bande `center-right` de FrIdéo → **Centre droit**.

**Désaccords entre sources.** Le désaccord fondateur est écrit : Nicolas Beytout
revendique un journal « libéral, mais pas de droite », quand Marianne décrit une ligne
« néolibérale ». L'intervalle de confiance de FrIdéo (−0,05…+1,25) contient zéro :
les données seules ne départagent pas le centre, et la bande « centre droit » est
retenue par convention (voir Limites connues, point 3) — toutes les familles de
preuves couvertes pointent à droite du centre (propriété +0,42, charte +0,77,
profilage encyclopédique +0,54, lexical +0,64), et la bande est cohérente avec le
voisinage FrIdéo du titre (entre Le Point et le JDD).

**Sources**

1. **FrIdéo : où se situe L'Opinion ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 (échelle FrIdéo version 1.0, 2026-08-10, relative au panel de 30 médias) — <https://frenchnewslab.org/fr/medias/l-opinion> — « Score +0,60 dans la bande "centre droit" (intervalle −0,05…+1,25) : l'intervalle contient zéro, 5 familles de preuves sur 9 ; propriétaire final Bettencourt / Nicolas Beytout / Ken Fisher. »
2. **L'Opinion (quotidien français) (article encyclopédique)** — Wikipédia (avec les articles de presse cités en notes), 2026 — <https://fr.wikipedia.org/wiki/L%27Opinion_(quotidien_fran%C3%A7ais)> — « Le journal revendique être pro-business » ; sa ligne est définie « libérale, pro-européenne, pro-business » par son fondateur ; « il suit une ligne qui s'affirme "néolibérale" selon Marianne » ; « la majorité des articles du site internet sont réservés aux abonnés ».
3. **« La ligne éditoriale de mon journal sera libérale, probusiness et proeuropéenne »** — Xavier Ternisien, Le Monde, 2013-04-05 — <https://www.lemonde.fr/actualite-medias/article/2013/04/08/nicolas-beytout-la-ligne-editoriale-de-mon-journal-sera-liberale-probusiness-et-proeuropeenne_3155791_3236.html> — « Avoir une ligne "pro-business", c'est défendre l'idée que l'entreprise est le meilleur lieu pour produire la richesse » (Nicolas Beytout, déclaration fondatrice du quotidien).

**Audience.** L'Opinion est membre ACPM ; audience LDP de 633 000 au premier
semestre 2026 (S1 2026). Pas de diffusion France payée certifiée dans les classements
utilisés ici.

**Flux vérifiés (2026-10-10, issue #72).** `latest`
<https://www.lopinion.fr/index.rss> — 200, 250 articles, ~9 j, images sur tous les
articles. Flux index « temps réel » du média, le plus complet disponible : seul un
extrait de la journée (~17 articles sur 24 h) traverse la fenêtre de collecte.

**Paywall / TDM.** En grande partie payant (la majorité des articles du site sont
réservés aux abonnés, vidéos, blogs et tribunes restent en libre accès — Wikipédia) ;
pas de `tdmrep.json` (404). Le site bloque GPTBot, CCBot et PerplexityBot (vérifié le
2026-10-10) : un blocage anti-IA, pas une réservation TDM.

### Le Figaro — Droite

**Placement.** Bande `right` de FrIdéo → **Droite**.

**Désaccords entre sources.** Media Bias/Fact Check le note « RIGHT-CENTER » (centre
droit) quand FrIdéo le range dans la bande « droite » (intervalle +0,50…+1,55, excluant
zéro) ; le journal se définit « de droite et de centre droit ». Par ailleurs, des articles
documentent un rapprochement avec l'extrême droite sous la direction d'Alexis Brézet
(Wikipédia, 2021-2024, avec la lettre de la rédaction de juillet 2024). Nous retenons
Droite, la position que le journal revendique lui-même.

**Sources**

1. **FrIdéo : où se situe Le Figaro ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/le-figaro> — « Score +1,02 dans la bande "droite" (intervalle +0,50…+1,55), 7 familles de preuves : le classement à droite est soutenu par les données. »
2. **Le Figaro (article encyclopédique, section « Ligne éditoriale »)** — Wikipédia (avec les articles de presse cités en notes), 2026 — <https://fr.wikipedia.org/wiki/Le_Figaro> — « Le Figaro, d'après son directeur, se considère comme un journal de droite et de centre droit » ; sa ligne est issue des familles gaulliste, libérale et conservatrice.
3. **La rédaction du Figaro demande à sa direction de clarifier le positionnement politique** — Ouest-France (reprise AFP), 2024-07-02 — <https://www.ouest-france.fr/medias/la-redaction-du-figaro-demande-a-sa-direction-de-clarifier-le-positionnement-politique-52ca739e-f75e-4e50-874c-da12028d7ab4> — Une centaine de journalistes du Figaro ont écrit à leur direction après un éditorial jugé favorable au RN, pour demander des clarifications sur le positionnement du journal (juillet 2024).
4. **Le Figaro – Bias and Credibility** — Media Bias/Fact Check, 2026 — <https://mediabiasfactcheck.com/le-figaro/> — Noté « RIGHT-CENTER BIAS » (centre droit), quand FrIdéo le range dans la bande « droite ».

**Audience.** ACPM quotidien nationaux 2025/2026 : 2e rang, 397 194 exemplaires France
payée ; LeFigaro.fr : 4e rang des sites, 125,9 M de visites (août 2026).

**Flux vérifiés (2026-10-10).** `une` <https://www.lefigaro.fr/rss/figaro_actualites.xml>
— 200, 19 articles, ~9 h, images sur 18 articles ; `latest`
<https://www.lefigaro.fr/rss/figaro_flash-actu.xml> — 200, 20 articles, ~3 h, images sur
19 articles.

**Paywall / TDM.** Partiellement payant ; **réservation TDM publiée**
(`tdm-reservation: 1`).

### CNews — Droite

**Placement.** Bande `right` de FrIdéo → **Droite**.

**Désaccords entre sources.** Une partie des sources parle d'« extrême droite »
(Wikipédia, rapport RSF de novembre 2025 sur les temps d'antenne) quand l'Arcom refuse
cette qualification tout en sanctionnant un « déséquilibre manifeste et durable » dans
l'expression des courants de pensée. Notre échelle n'a pas de case extrême droite (hors
périmètre, voir la PRD) : la bande `far-right` éventuelle serait rattachée à Droite. Nous
retenons Droite, en publiant le désaccord.

**Sources**

1. **FrIdéo : où se situe CNews ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/cnews> — « Score +0,96 dans la bande "droite" (intervalle +0,28…+1,64) : statistiquement indistinguable du Figaro sur cette échelle. »
2. **Pluralisme des courants de pensée et d'opinion : mise en demeure de CNews** — Arcom (autorité de régulation de la communication audiovisuelle et numérique), 2026-06 — <https://www.arcom.fr/presse/pluralisme-des-courants-de-pensee-et-dopinion-mise-en-demeure-de-cnews> — L'Arcom a mis en demeure CNews de se conformer à l'exigence d'expression pluraliste des courants de pensée et d'opinion, constatant un « déséquilibre manifeste et durable » dans ses débats.
3. **CNews (article encyclopédique, section « Ligne éditoriale »)** — Wikipédia (avec les rapports RSF et articles cités en notes), 2026 — <https://fr.wikipedia.org/wiki/CNews> — Ligne éditoriale « très ancrée à droite et conservatrice, avec une orientation marquée de plus en plus à l'extrême droite ».

**Audience.** 22e rang des sites web ACPM, 30,2 M de visites en août 2026 (Cnews.fr) ;
chaîne d'information en continu du groupe Canal+ (Vincent Bolloré).

**Flux vérifiés (2026-10-10).** `latest` <https://www.cnews.fr/rss.xml> — 200, 100
articles, ~28 h, images partout.

**Paywall / TDM.** Gratuit ; pas de `tdmrep.json` (404).

### Europe 1 — Droite

**Placement.** Hors panel FrIdéo. Trois sources décrivent le virage à droite de la
station depuis 2021 → **Droite** pour la station actuelle.

**Désaccords entre sources.** Arnaud Lagardère dément toute « volonté idéologique » et la
station défend son virage par ses audiences (Puremédias, 2025) ; la presse spécialisée et
Wikipédia documentent le virage. Avant 2021, la station était classée au centre : notre
classement vaut pour la ligne actuelle, il n'est pas un jugement rétroactif.

**Sources**

1. **Europe 1, des yéyés à la droite conservatrice** — Le Monde, rubrique Médias, 2021-07-28 — <https://www.lemonde.fr/actualite-medias/article/2021/07/28/europe-1-des-yeyes-a-la-droite-conservatrice_6089737_3236.html> — Après le rachat de Lagardère par Vincent Bolloré, Le Monde décrit le virage d'Europe 1 vers une droite conservatrice, marquée par les éditorialistes et les rendez-vous partagés avec CNews.
2. **À Europe 1, le virage à droite toute met à l'épreuve les salariés** — Télérama, 2024 — <https://www.telerama.fr/radio/a-europe-1-le-virage-a-droite-toute-met-a-l-epreuve-les-salaries-7021993.php> — Télérama documente le « fléchissement réactionnaire » de la station (arrivée de Cyril Hanouna, figures de CNews) et les tensions internes qu'il provoque.
3. **Europe 1 (article encyclopédique, section « Ligne éditoriale »)** — Wikipédia (avec les articles de presse cités en notes), 2026 — <https://fr.wikipedia.org/wiki/Europe_1> — « À partir de 2021 […] l'influence [de Vincent Bolloré] sur la ligne éditoriale est jugée grandissante, traduisant un virage éditorial à droite, voire à l'extrême droite. »
4. **« Pas de volonté idéologique » : Arnaud Lagardère se défend du changement de ligne éditoriale d'Europe 1** — Puremédias, 2025 — <https://www.ozap.com/actu/pas-de-volonte-ideologique-arnaud-lagardere-se-defend-du-changement-de-ligne-editoriale-d-europe-1/649742> — La direction conteste toute « volonté idéologique » et défend la ligne par ses audiences (2,65 millions d'auditeurs par jour) : c'est le point de vue opposé à celui de la presse spécialisée.

**Audience.** 75e rang des sites web ACPM, 4,7 M de visites en août 2026 (Europe1.fr) ;
radio généraliste écoutée par 2,65 millions d'auditeurs par jour (vague Médiamétrie citée
par Puremédias).

**Flux vérifiés (2026-10-10).** `latest` <https://www.europe1.fr/rss.xml> — 200, 50
articles, ~21 h, images partout.

**Paywall / TDM.** Gratuit ; pas de `tdmrep.json` (404).

### Le JDD — Droite

**Placement.** Bande `right` de FrIdéo → **Droite**, pour la rédaction actuelle.

**Désaccords entre sources.** Avant juin 2023, le JDD se situait au centre : FrIdéo mesure
−0,16 sur janvier 2022 – juin 2023, puis +0,30 juste après l'arrivée de Geoffroy Lejeune
et +0,57 un an plus tard. Le classement Droite reflète le journal depuis 2023 ; le
changement est daté et mesuré, et nous ne l'appliquons pas rétroactivement.

**Sources**

1. **FrIdéo : où se situe JDD ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/jdd> — « Score +0,95 dans la bande "droite" (intervalle +0,31…+1,60) » ; l'article documente le changement : −0,16 avant juin 2023, +0,30 juste après, +0,57 un an plus tard.
2. **« Nous n'avons pas gagné » : les journalistes du JDD mettent fin à 40 jours de grève** — France 24, 2023-08-01 — <https://www.france24.com/fr/france/20230801-nous-n-avons-pas-gagn%C3%A9-les-journalistes-du-jdd-mettent-fin-%C3%A0-40-jours-de-gr%C3%A8ve> — La rédaction a fait 40 jours de grève contre la nomination de Geoffroy Lejeune (ex-directeur de Valeurs actuelles) à la tête du journal, entérinée le 1er août 2023.
3. **La fin de la grève au « Journal du dimanche » laisse un goût amer** — Le Monde, 2023-08-01 — <https://www.lemonde.fr/economie/article/2023/08/01/la-fin-de-la-greve-au-journal-du-dimanche-laisse-un-gout-amer_6184121_3234.html> — Le Monde confirme la fin du conflit et le contexte de reprise en main éditoriale de l'hebdomadaire.

**Audience.** ACPM presse du 7e jour 2025/2026 : 9e rang, 118 153 exemplaires France
payée ; LeJDD.fr : 88e rang des sites, 3,4 M de visites (août 2026).

**Flux vérifiés (2026-10-10).** `une` <https://www.lejdd.fr/rss/a-la-une.xml> — 200, 9
articles, ~11 h, **sans image** ; `latest` <https://www.lejdd.fr/rss.xml> — 200, 50
articles, ~1,5 jour, images partout. Flux le plus complet, toutes rubriques (séries et ciné
compris) : le hors-nuit est retiré par la classification (#4), jamais par le choix du flux.
Le flux `rss/politique.xml` (50 articles, ~7 jours) reste l'alternative si un filtrage amont
devenait nécessaire.

**Paywall / TDM.** Partiellement payant ; pas de `tdmrep.json` (404).

### Valeurs actuelles — Droite

**Placement.** Bande `far-right` de FrIdéo → rattachée à **Droite** (pas de case extrême
droite dans notre échelle).

**Désaccords entre sources.** La nuance fait débat, pas le côté : Le Figaro cite des
descriptions « classé à l'extrême droite » et « réputé clairement à droite » ; Le Monde
(2012) le décrit « conservateur, plus à droite que celle du Figaro ». Nous publions le
désaccord et retenons Droite, la bande `far-right` ne pouvant être représentée ici.

**Sources**

1. **FrIdéo : où se situe Valeurs actuelles ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/valeurs-actuelles> — « Score +1,87, le plus à droite des 30 médias du panel (intervalle +1,28…+2,46), sur 6 familles de preuves. »
2. **Valeurs actuelles (article encyclopédique, section « Positionnement politique »)** — Wikipédia (avec les articles cités en notes), 2026 — <https://fr.wikipedia.org/wiki/Valeurs_actuelles> — Selon Le Monde (2012), Valeurs actuelles a une ligne « conservatrice, plus à droite que celle du Figaro » ; selon Le Figaro lui-même, il est « tantôt décrit comme classé à l'extrême droite », « réputé clairement à droite ».

**Audience.** ACPM presse magazine 2025/2026 : 89e rang, 61 124 exemplaires France
payée.

**Flux vérifiés (2026-10-10).** `latest` <https://www.valeursactuelles.com/feed> — 200,
10 articles, ~5 h, **sans image**. Le flux historique « /rss » ne contient aucune date ;
« /feed » sert les mêmes articles avec dates.

**Paywall / TDM.** Partiellement payant ; pas de `tdmrep.json` (404).

---

## Médias exclus

| Média | Raison (vérifiée le 2026-10-10) |
|---|---|
| Les Échos | **Flux bloqués.** `lesechos.fr/rss/*` répond **403** (une, actualités, rubriques) ; le site tout entier est servi derrière Akamai, qui bloque aussi la page d'accueil (vérifié le 2026-10-10). |

Le Point est cité ici pour mémoire : il était exclu pour la même raison technique
(flux 403, vérifié le 2026-10-10) et est entré dans l'Édition le 2026-10-10, quand un
endpoint de syndication Arc XP, non couvert par l'anti-bot, a été trouvé — le même
mécanisme que Libération (issue #11). Les Échos est cité ici pour que le lecteur
puisse vérifier qu'il s'agit d'une raison technique, jamais d'un jugement sur sa
ligne éditoriale. Son orientation est recherchée comme celle des autres, et son
dossier sera ajouté le jour où ses flux redeviennent accessibles. (Libération en est
sortie le 2026-10-10 : le flux de syndication Arc XP, vérifié en même temps que le
blocage DataDome persistait sur les `/rss/` historiques, a permis son inclusion —
issue #11.)

---

## Limites connues

1. **Le Parisien n'a pas de dates dans ses flux** (titre et lien uniquement) : ses
   articles sont datés depuis le slug de leur URL, à la journée près — sans heure affichée
   — et restent sans image ni chapô (ADR-0007 ; traité côté pipeline, issue #12).
2. **FrIdéo ne couvre ni Europe 1 ni Courrier international** ; leur placement repose sur
   d'autres sources, explicitées dans leurs dossiers.
3. **La bande suit la mesure, pas la preuve** : quand l'intervalle de confiance contient
   zéro (15 des 30 de FrIdéo), la bande est retenue par convention, pas par preuve ; les
   dossiers le disent. Depuis le découpage en cinq bandes (issue #46), cela ne fusionne
   plus des médias de part et d'autre du centre dans une même case — mais la bande
   « centre gauche » ou « centre droit » d'un média sans départage reste une convention.
4. **La perception diffère de la mesure** : TF1 Info est perçu à droite par les enquêtes
   d'audience sans que les autres familles de preuves le confirment ; BFMTV et Le Monde
   font l'objet de descriptions contradictoires. Tout est publié, rien n'est lissé.
5. **Les flux de Libération et du Point sont des endpoints de syndication Arc XP**,
   non documentés publiquement par les journaux : 50 articles au plus (~9 h de
   couverture), aucune image pour Libération ; 100 articles au plus (~2 j), images
   incluses pour Le Point. Ils pourraient être restreints ou supprimés sans préavis.
   Repli étudié (issue #11) : Google News RSS `site:liberation.fr` (articles frais,
   mais liens redirecteurs `news.google.com`, sans vrais teasers ni images) —
   inférieur, à n'utiliser que si l'endpoint Arc disparaît.
6. **Les chiffres d'audience vieillissent** : ils sont datés (ACPM 2025/2026, août 2026)
   et doivent être revus à chaque campagne de mise à jour de la configuration, comme les
   vérifications de flux (`pnpm --filter @prisme/pipeline verify`).
7. **Les réservations TDM sont informatives** (ADR-0003) : Prisme ne lit que les titres et
   chapeaux publiés dans les flux RSS, qu'il ne stocke jamais.
8. **Le hors-nuit n'est jamais filtré par le choix du flux** : on collecte le flux le plus
   complet de chaque média (météo, recettes, séries compris), et la classification de
   l'issue #4 retire le `not_news` avant l'Édition. En attendant #4, ce contenu reste
   visible dans l'Édition : état transitoire assumé, à ne pas publier avant que #4 ne
   tourne (les pages de sujets sont figées définitivement une fois publiées).
