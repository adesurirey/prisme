# Orientations politiques des médias de Prisme

Recherche sourcée derrière le classement Gauche / Centre / Droite des **22 médias** de
Prisme (issue #2). La version typée de ce document est
`packages/domain/src/outlets.ts`, importée par le pipeline et le site ; les deux doivent
rester identiques (les tests du module font respecter les règles de preuve).

- **Méthode et règle de placement** ci-dessous, puis un dossier par média.
- **Vérifications** (flux RSS, réservations TDM) effectuées le **2026-10-06** avec un
  User-Agent de navigateur normal, et le **2026-10-07** pour Libération (issue #11). Chiffres ACPM : millésime **2025/2026** pour la presse
  (diffusion France payée certifiée), **août 2026** pour les sites (visites mensuelles).
- Conformément à l'ADR-0001, le Leaning appartient au média, jamais à un article. Les
  notes et citations de ce document sont écrites pour être **publiables telles quelles**
  sur `/pourquoi-ce-classement`.

---

## Méthode

### Ce que nous cherchons

Pour chaque média : une place sur trois cases (**Gauche / Centre / Droite**), justifiée
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

FrIdéo décrit sept bandes ; Prisme n'en a que trois (la PRD exclut de distinguer
l'extrême gauche et l'extrême droite). La règle, appliquée à tous les médias couverts :

| Bande FrIdéo | Leaning Prisme |
|---|---|
| `far-left`, `left` | **Gauche** |
| `center-left`, `center`, `center-right` | **Centre** |
| `right`, `far-right` | **Droite** |

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
| L'Humanité | Gauche | −2,41 (extrême gauche) | 7e PQN, 40 996 ex. | Gratuit | non |
| Le Monde | Centre | −0,71 (centre gauche) | 1er PQN, 564 586 ex. | Partiellement payant | indéterminé (402) |
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
| Le Figaro | Droite | +1,02 (droite) | 2e PQN, 397 194 ex. | Partiellement payant | **oui** |
| CNews | Droite | +0,96 (droite) | 22e site, 30,2 M visites | Gratuit | non |
| Europe 1 | Droite | hors panel | 75e site, 4,7 M visites | Gratuit | non |
| Le JDD | Droite | +0,95 (droite) | 9e 7e jour, 118 153 ex. | Partiellement payant | non |
| Valeurs actuelles | Droite | +1,87 (extrême droite) | 89e magazine, 61 124 ex. | Partiellement payant | non |

PQN = presse quotidienne nationale, PQR = presse quotidienne régionale, 7e jour =
hebdomadaires du dimanche, magazine = presse magazine (classements ACPM 2025/2026).
« visites » = classement unifié des sites web grand public ACPM, août 2026.

---

## Les 22 médias

### L'Obs — Gauche

**Placement.** Bande `left` de FrIdéo → Gauche.

**Désaccords entre sources.** Aucun désaccord notable ; les deux sources pointent à
gauche.

**Sources**

1. **FrIdéo : où se situe Le Nouvel Obs ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/le-nouvel-obs> — « Score −0,89 dans la bande "gauche" (intervalle −1,54…−0,24) : le classement à gauche est soutenu par les données, 5 familles de preuves sur 9. »
2. **Le Nouvel Obs (article encyclopédique)** — Wikipédia (avec les ouvrages et articles cités en notes), 2026 — <https://fr.wikipedia.org/wiki/Le_Nouvel_Obs> — « Historiquement situé à gauche et d'inspiration mendésiste puis sociale-démocrate, le titre revendique depuis 2020 une ligne de gauche progressiste. »

**Audience.** ACPM presse magazine 2025/2026 : 38e rang, 162 242 exemplaires France
payée ; Nouvelobs.com : 46e rang des sites, 10,5 M de visites (août 2026).

**Flux vérifiés (2026-10-06).** `latest` <https://www.nouvelobs.com/rss.xml> — 200,
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

**Flux vérifiés (2026-10-06).** `latest` <https://www.huffingtonpost.fr/rss/all_headline.xml>
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

**Flux vérifiés (2026-10-07).** `latest`
<https://www.liberation.fr/arc/outboundfeeds/rss/?outputType=xml> — 200, 50 articles,
~9 h, aucune image. Flux officiel de syndication de la plateforme Arc XP (Washington
Post), servi sur le domaine de Libération. Les flux `/rss/` historiques restent bloqués
par DataDome (403, vérifié le 2026-10-06 et le 2026-10-07, issue #11) : c'est ce flux qui
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

**Flux vérifiés (2026-10-06).** `latest` <https://www.mediapart.fr/articles/feed> — 200,
10 articles, ~12 h, images sur tous les articles.

**Paywall / TDM.** Abonnement (intégral) ; pas de `tdmrep.json` (404).

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

**Flux vérifiés (2026-10-06).** `latest` <https://www.humanite.fr/feed> — 200, 20
articles, ~2 h, images sur tous les articles. Flux très fréquent.

**Paywall / TDM.** Gratuit ; pas de `tdmrep.json` (404).

### Le Monde — Centre

**Placement.** Bande `center-left` de FrIdéo → **Centre**.

**Désaccords entre sources.** Cas le plus discuté du panel. FrIdéo range Le Monde dans
« centre gauche » (intervalle −1,23…−0,18, excluant zéro) et Media Bias/Fact Check le note
« LEFT-CENTER » ; le journal se définit comme indépendant des partis et plusieurs
descriptions le tiennent pour centriste (Lucide le dit « centre-gauche »). Notre règle de
placement range la bande `center-left` dans Centre : c'est une conséquence annoncée de la
règle, pas un jugement sur le journal. Ceux qui placent Le Monde à gauche ne sont pas
« contredits » ici : la divergence est documentée et la règle est publique.

**Sources**

1. **FrIdéo : où se situe Le Monde ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/le-monde> — « Score −0,71 dans la bande "centre gauche" (intervalle −1,23…−0,18), 7 familles de preuves. »
2. **Le Monde – Bias and Credibility** — Media Bias/Fact Check, 2026 — <https://mediabiasfactcheck.com/le-monde/> — Noté « LEFT-CENTER BIAS » (centre gauche).
3. **Le Monde (article encyclopédique, section « Positionnement politique »)** — Wikipédia (avec les ouvrages cités en notes, dont Eveno 2001), 2026 — <https://fr.wikipedia.org/wiki/Le_Monde> — Le Monde se veut indépendant des partis ; son histoire est décrite entre engagement à gauche (soutien à l'Union de la gauche dans les années 1970) et revendication d'ouverture à plusieurs courants.
4. **Le Monde : orientation politique, propriétaire et fiabilité** — Lucide (observatoire de médias), 2026 — <https://lucideinfo.fr/medias/le-monde> — Repère éditorial : « Centre-gauche » ; propriété : Niel / Pigasse / Křetínský / Fonds pour l'indépendance de la presse.

**Audience.** 1er quotidien national : ACPM 2025/2026, 564 586 exemplaires France payée ;
LeMonde.fr : 7e rang des sites, 95,5 M de visites (août 2026).

**Flux vérifiés (2026-10-06).** `une` <https://www.lemonde.fr/rss/une.xml> — 200, 16
articles, ~15 h, images partout ; `latest` <https://www.lemonde.fr/rss/en_continu.xml> —
200, 60 articles, ~27 h, images partout.

**Paywall / TDM.** Partiellement payant ; réservation TDM **indéterminée** :
`lemonde.fr/.well-known/tdmrep.json` répond 402 « Accès restreint ».

### franceinfo — Centre

**Placement.** Bande `center-left` de FrIdéo, mais intervalle contenant zéro → **Centre**.

**Désaccords entre sources.** Aucun départage : FrIdéo (le média le mieux couvert du
panel, 8 familles) place franceinfo dans « centre gauche » sans que l'intervalle exclue
zéro. Le statut de service public milite pour le Centre ; la règle de placement donne le
même résultat.

**Sources**

1. **FrIdéo : où se situe Franceinfo ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/franceinfo> — « Score −0,41, bande "centre gauche" mais intervalle −0,93…+0,11 contenant zéro : non résolu. »
2. **France Info (offre globale) (article encyclopédique)** — Wikipédia, 2026 — <https://fr.wikipedia.org/wiki/France_Info_(offre_globale)> — France Info est l'offre d'information publique portée par France Télévisions et Radio France, dont les conventions imposent indépendance, exactitude et pluralisme.

**Audience.** 3e rang des sites web ACPM (grand public), 136,5 M de visites en août 2026
(Franceinfo.fr).

**Flux vérifiés (2026-10-06).** `latest` <https://www.francetvinfo.fr/titres.rss> — 200,
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

**Flux vérifiés (2026-10-06).** `une` <https://www.ouest-france.fr/rss/une> — 200, 10
articles, ~30 min, images partout ; `latest` <https://www.ouest-france.fr/rss-en-continu.xml>
— 200, 10 articles, ~30 min, images partout. **Les deux flux servent les mêmes 10
articles** (vérifié le 2026-10-06) : le flux « en continu » n'apporte rien de plus.

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

**Flux vérifiés (2026-10-06).** `latest` <https://www.bfmtv.com/rss/news-24-7/> — 200,
30 articles, ~13 h, images partout.

**Paywall / TDM.** Gratuit ; réservation TDM **indéterminée** (la sonde est bloquée par un
pare-feu, 403).

### 20 Minutes — Centre

**Placement.** Bande `center-left` de FrIdéo, intervalle contenant zéro → **Centre**.

**Désaccords entre sources.** La charte revendique la neutralité, Media Bias/Fact Check
note « LEFT-CENTER », FrIdéo « centre gauche » sans départage. La bande `center-left` étant
rattachée à Centre dans notre échelle, nous retenons Centre.

**Sources**

1. **FrIdéo : où se situe 20 Minutes ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/20-minutes> — « Score −0,31, bande "centre gauche" mais intervalle −0,82…+0,19 contenant zéro : non résolu. »
2. **La charte de « 20 Minutes »** — 20 Minutes, 2026 — <https://www.20minutes.fr/charte-20minutes> — « L'indépendance et la neutralité politiques et religieuses sont dans les fondements même de la pratique éditoriale de 20 Minutes » (charte du média, actionnaires Sipa Ouest-France et Groupe Rossel).
3. **20 Minutes – Bias and Credibility** — Media Bias/Fact Check, 2026 — <https://mediabiasfactcheck.com/20-minutes/> — Noté « LEFT-CENTER BIAS » (centre gauche).

**Audience.** 8e rang des sites web ACPM (grand public), 90,3 M de visites en août 2026
(20minutes.fr). Presse gratuite : pas de diffusion payée certifiée ACPM.

**Flux vérifiés (2026-10-06).** `une` <https://www.20minutes.fr/feeds/rss-une.xml> — 200,
30 articles, ~6 jours, images partout. Le flux « une » accumule les choix de la journée
sur plusieurs jours : il sert de front page par défaut. Pas de flux « latest » : les
autres URL `/feeds/*` répondent 403 (vérifié le 2026-10-06).

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

**Flux vérifiés (2026-10-06).** `latest` <https://feeds.leparisien.fr/leparisien/rss> —
200, 100 articles, **aucune date ni image** (titre et lien uniquement), temps couvert :
non mesurable. Les articles sont datés par le collecteur depuis le slug de leur URL
(JJ-MM-AAAA, ~96 % des items ; datés à la collecte pour le reste — ADR-0007, issue #12) :
ils entrent dans la fenêtre des 24 h sans heure affichée. Ils restent sans image ni
chapô : pas de photo quand Le Parisien est seul sur un sujet, classification sur le titre
seul. L'ancien flux « en-continu » répond 200 avec 0 article, et « rss/une » sert des
archives de 2019 (vérifié le 2026-10-06).

**Paywall / TDM.** Partiellement payant ; **réservation TDM publiée**
(`tdm-reservation: 1`), avec une politique par agent (GPTBot, ClaudeBot…).

### TF1 Info — Centre

**Placement.** Bande `center-right` de FrIdéo, intervalle contenant zéro → **Centre**.

**Désaccords entre sources.** Les enquêtes d'audience perçoivent TF1 Info à droite
(+1,30 sur cette famille FrIdéo, le signal le plus à droite du panel) ; les autres
familles le placent au centre et l'intervalle global contient zéro. Nous retenons Centre,
faute de départage, et notons la perception.

**Sources**

1. **FrIdéo : où se situe TF1 INFO ?** — Amr Sobhy, Le French News Lab (ICNLSP 2026), 2026 — <https://frenchnewslab.org/fr/medias/tf1-info> — « Score +0,36, bande "centre droit" mais intervalle −0,31…+1,03 contenant zéro : non résolu, alors que la famille "orientation perçue en enquêtes" le place nettement à droite (+1,30). »
2. **LCI / TF1 Info (article encyclopédique)** — Wikipédia, 2026 — <https://fr.wikipedia.org/wiki/LCI> — Chaîne d'information du Groupe TF1 (privé, groupe Bouygues), devenue la marque d'information « TF1 Info » ; aucune ligne partisane n'y est revendiquée.

**Audience.** Absente du classement ACPM des sites ; retenue comme marque d'information de
la première chaîne de télévision privée française (Groupe TF1), audience mesurée par
Médiamétrie plutôt que par l'ACPM.

**Flux vérifiés (2026-10-06).** `latest` <https://www.tf1info.fr/feeds/rss-une.xml> — 200,
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

**Flux vérifiés (2026-10-06).** `latest` <https://www.rfi.fr/fr/rss> — 200, 23 articles,
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

**Flux vérifiés (2026-10-06).** `latest` <https://www.france24.com/fr/rss> — 200, 24
articles, ~4 h, images sur 22 articles.

**Paywall / TDM.** Gratuit ; **réservation TDM publiée** (`tdm-reservation: 1`) ; une
sonde de contrôle peut être filtrée par le pare-feu du site (403 observé une fois).

### Courrier international — Centre

**Placement.** Hors panel FrIdéo. Trois sources convergentes mais pas identiques ;
aucune ne le place dans la moitié gauche de notre échelle à trois cases → **Centre**.

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

**Flux vérifiés (2026-10-06).** `latest`
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

**Flux vérifiés (2026-10-06).** `latest` <https://www.lexpress.fr/rss/alaune.xml> — 200,
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

**Flux vérifiés (2026-10-06).** `latest` <https://www.la-croix.com/rss> — 200, 50
articles, ~25 h, images partout. Flux général, toutes rubriques (religion et culture
comprises) : les rubriques sont tranchées par la classification (#4), pas par le choix du
flux. Le flux `/rss/france` (actualité nationale) existe si un périmètre restreint devenait
souhaitable.

**Paywall / TDM.** Partiellement payant ; pas de `tdmrep.json` (404).

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

**Flux vérifiés (2026-10-06).** `une` <https://www.lefigaro.fr/rss/figaro_actualites.xml>
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

**Flux vérifiés (2026-10-06).** `latest` <https://www.cnews.fr/rss.xml> — 200, 100
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

**Flux vérifiés (2026-10-06).** `latest` <https://www.europe1.fr/rss.xml> — 200, 50
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

**Flux vérifiés (2026-10-06).** `une` <https://www.lejdd.fr/rss/a-la-une.xml> — 200, 9
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

**Flux vérifiés (2026-10-06).** `latest` <https://www.valeursactuelles.com/feed> — 200,
10 articles, ~5 h, **sans image**. Le flux historique « /rss » ne contient aucune date ;
« /feed » sert les mêmes articles avec dates.

**Paywall / TDM.** Partiellement payant ; pas de `tdmrep.json` (404).

---

## Médias exclus

| Média | Raison (vérifiée le 2026-10-06) |
|---|---|
| Marianne | **Hors périmètre** (les 22 médias de la PRD). Ses flux RSS fonctionnent pourtant (`marianne.net/rss` et `/feed` répondent 200 avec du RSS valide, vérifié trois fois le 2026-10-06) : l'exclusion est un choix de périmètre, pas une exclusion technique (issue #10). |
| Le Point | **Flux bloqués.** `lepoint.fr/feeds/rss.xml`, `/feed` et `/actualites.rss` répondent **403**. |
| Les Échos | **Flux bloqués.** `lesechos.fr/rss/*` répond **403** (une, actualités, rubriques). |

Les trois sont cités ici pour que le lecteur puisse vérifier qu'il s'agit de raisons
techniques ou de périmètre, jamais de jugements sur leur ligne éditoriale. Leur
orientation n'est pas recherchée tant qu'ils ne sont pas dans l'Édition. (Libération en
est sortie le 2026-10-07 : le flux de syndication Arc XP, vérifié en même temps que le
blocage DataDome persistait sur les `/rss/` historiques, a permis son inclusion —
issue #11.)

---

## Limites connues

1. **Le Parisien n'a pas de dates dans ses flux** (titre et lien uniquement) : ses
   articles sont datés depuis le slug de leur URL, à la journée près — sans heure affichée
   — et restent sans image ni chapô (ADR-0007 ; traité côté pipeline, issue #12).
2. **FrIdéo ne couvre ni Europe 1 ni Courrier international** ; leur placement repose sur
   d'autres sources, explicitées dans leurs dossiers.
3. **Le « centre » est une case large** : elle accueille `center-left`, `center` et
   `center-right`. Les médias dont l'intervalle de confiance contient zéro (15 des 30 de
   FrIdéo) sont classés par convention, pas par preuve ; leurs dossiers le disent.
4. **La perception diffère de la mesure** : TF1 Info est perçu à droite par les enquêtes
   d'audience sans que les autres familles de preuves le confirment ; BFMTV et Le Monde
   font l'objet de descriptions contradictoires. Tout est publié, rien n'est lissé.
5. **Le flux de Libération est un endpoint de syndication Arc XP**, non documenté
   publiquement par le journal : 50 articles au plus (~9 h de couverture), aucune image,
   et il pourrait être restreint ou supprimé sans préavis. Repli étudié (issue #11) :
   Google News RSS `site:liberation.fr` (articles frais, mais liens redirecteurs
   `news.google.com`, sans vrais teasers ni images) — inférieur, à n'utiliser que si
   l'endpoint Arc disparaît.
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
