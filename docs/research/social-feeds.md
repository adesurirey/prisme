# Flux d'actualité et d'opinion hors presse : YouTube, Podcasts, X

Recherche exploratoire pour élargir le périmètre de Prisme au-delà des médias
« mainstream » certifiés ACPM (issue #10 laisse le périmètre ouvert). Trois
catégories passées au crible : **YouTube**, **podcasts natifs**, **X/Twitter**.
Chiffres collectés le **2026-10-08**.

Pour chaque candidat : audience (avec le certificateur le plus proche d'ACPM),
notoriété éditoriale (presse de référence qui en parle), faisabilité RSS —
critère dur, puisque le pipeline ne fonctionne qu'à partir de flux.

---

## Rappel des contraintes du pipeline

- **Audience équivalente ACPM** : pour YouTube → abonnés (classements Inside
  Créateurs / VideoTrends, données publiques YouTube) ; pour les podcasts →
  classement **ACPM EAR > Podcast** (existe, certifié, mensuel) ; pour X → rien
  d'équivalent (compteurs de followers seulement).
- **Flux RSS** : les podcasts ont tous un flux RSS natif (c'est la technologie du
  médium). Les chaînes YouTube ont un **feed Atom public par chaîne**
  (`https://www.youtube.com/feeds/videos.xml?channel_id=…`, 15 derniers uploads,
  sans clé API) — techniquement trivial à ajouter au collector. **X n'a plus de
  flux RSS fiable** (Nitter mort, RSS-Bridge fragile et fragile au scraping).
- **Leaning** : règle ADR-0001 inchangée — ≥ 2 sources citées par média. Beaucoup
  de ces médias n'ont pas encore de dossier FrIdéo (qui couvre 30 médias
  nationaux pressés), il faut donc des sources ad hoc (BFM, Le Monde, INA,
  Wikipedia notées, enquêtes d'observatoires comme OJIM).

---

## 1. Podcasts natifs — catégorie la plus mûre

Le médium est **natif RSS** (aucune ingénierie), et ACPM mesure l'audience
podcast : classement certifié 824 programmes, ~144 M de téléchargements/mois
tous podcasts français (ACPM août 2026). Le podcaster big-box du classement :

### Classement ACPM (janvier 2026, téléchargements totaux/mois)

| # | Podcast | Téléch. | Éditeur | Note |
|---|---------|---------|---------|------|
| 1 | **Les Actus du Jour – HugoDécrypte** | 2 872 489 | HugoDécrypte | Actus générales, 5 j/7 |
| 2 | La dernière | 2 183 680 | Radio Nova | Humour, hors périmètre |
| 3 | **L'Heure du Monde** | 2 076 067 | Le Monde | Déjà couvert via Le Monde |
| 4 | **Transfert** | 1 430 084 | Slate France | Récits société, pas du news pur |

### Candidats podcasts à considérer

| Podcast | Audience | Influence | Leaning (à sourcer) | Flux |
|---------|----------|-----------|---------------------|------|
| **HugoDécrypte – Les Actus du Jour** | 2,87 M téléch./mois, **#1 ACPM jan. 2026** ; 3,8 M abonnés YouTube (1,6 Md vues) ; cité comme source d'info des jeunes devant la presse (rapport Reuters Institute 2024, via 20 Minutes) | Très forte ; émission France 2 | Non-classé : digest factuel sans éditorialisation ; traiter comme un **aggregateur** à part (pas un Outlet avec Leaning ?) | RSS natif ✅ |
| **Legend (Guillaume Pley)** | ~8 M écoutes/mois (auto-déclaré), **#1 Spotify France 2025**, 3,7 M abonnés YouTube ; absent des classements ACPM (n'a pas souscrit) | Très forte : « passage obligé des politiques et patrons » (Le Figaro, 21/11/2025) ; enquête Le Monde sur l'absence de contradiction et des invités payants | Droite/critique des médias traditionnels selon BFM/OJIM, mais classé « neutre » par lui-même — dossier à construire, polémique active (TPZ, Inrocks, Le Monde) | YouTube RSS ✅ ; RSS audio via Spotify seulement (pas de flux open officiel) ⚠️ |
| **Thinkerview** (podcast audio) | ~1,33 M abonnés YouTube, 285 M vues ; BFM (05/09/2025) : « mouvances contestataires orientées à droite », audiences en hausse | Forte sur l'entretien long | Droite contestataire/souverainiste (BFM, Wikipedia, Slate) — sourçable | RSS natif ✅ (431 épisodes Apple Podcasts) |
| Blast (podcast/audio) | voir §2 | voir §2 | Gauche | RSS natif ✅ |
| Transfert (Slate) | 1,43 M téléch./mois, #4 ACPM | Forte (Raconte de la société) | Slate France : centre-gauche (à sourcer via FrIdéo/ABC) | RSS natif ✅ |

**Recommandation podcasts** : commencer par **HugoDécrypte** (audience certifiée
ACPM, flux natif, format court quotidien proche des éditions presse), puis
**Thinkerview** et **Legend** (influence réelle, mais leaning à sourcer avec
précaution : Legend est en plein scandale éditorial — Le Monde, Le Dossier,
INA — et Thinkerview est « contestataire » plutôt que news).

---

## 2. YouTube — chaînes d'information et d'opinion

Classement France (abonnés, Inside Créateurs, juillet 2026 ; VideoTrends oct.
2026) — le top 3 France TOUTES catégories : Tibo InShape 26,9 M, Squeezie
20,2 M (hors info). Les chaînes info :

| Chaîne | Abonnés | Cat. | Influence | Leaning (à sourcer) | Flux |
|--------|---------|------|-----------|---------------------|------|
| **HugoDécrypte – Actus du jour** | **3,8 M** (#115 France) | Society/Politics | #1 info jeunes ; France 2 | digest factuel | YouTube Atom ✅ |
| **Legend** | 3,7 M (#115) + 3,3 M « Guillaume Pley » | Society | entretiens politiques, Sarkozy & co ; 85 M vues/mois | polémique, voir §1 | YouTube Atom ✅ |
| **Brut** | 2,8 M (#170) ; 35 M reach/mois réseaux ; chaîne TV linéaire depuis 04/2026 | News & Politics | média n°1 réseaux sociaux 18-35 ans | « proche d'Emmanuel Macron » (OJIM, 05/2026) — à sourcer | YouTube Atom ✅ + site RSS probable |
| **BFMTV** | 2,7 M (#187) | Politics | — | déjà un Outlet (le site est couvert) ; la chaîne YouTube est un doublon | ✅ mais doublon |
| HugoDécrypte – Grands formats | 2,0 M (#282) | Society | documentaires/longs | idem HugoDécrypte | ✅ |
| **Blast** | **1,7 M** ; 480-510 M vues ; co-op (2000 sociétaires), auditionné au Sénat (04/2026) avec Basta! et StreetPress | Enquêtes | forte dans l'investigation indépendante | Gauche/antagoniste du système (selon sa propre com' et OJIM) — à sourcer (Wikipedia, ACRIMED) | ✅ |
| **Thinkerview** | 1,33 M ; 286 M vues | Entretiens | « explosion des statistiques » (BFM, 09/2025) | Droite contestataire | ✅ |
| **Le Média** | ~1,1 M (ReachRanking) | Society/Politics | pionnier des « socios », francophone | Gauche progressiste (charte citée dans sa bio) — à sourcer | ✅ |
| TPZ | 223 K | Enquêtes | virale (2,3 M vues sur enquête Legend, INA) mais petit en audience | hors seuil d'influence | ✅ |

**Recommandation YouTube** : les 5 candidats sérieux sont **HugoDécrypte**,
**Brut**, **Blast**, **Thinkerview**, **Le Média** — tous ont un feed Atom
canal public que le collector peut ingérer sans changement d'architecture
(un seul `Kind`/`Source` de plus). Brut pose la question du doublon site/YouTube
(si son site entre, préférer le flux du site).

---

## 3. X/Twitter — à écarter pour l'ingestion

Ce que montrent les données (Visibrain × Sciences Po Grenoble via Décideurs
Magazine ; Le Point 27/01/2025 ; La Loupe Politique) :

- Les plus gros comptes politiques français sont **individuels, pas médias** :
  Marine Le Pen (3 M sur X), Mélenchon (2,7 M), Ruffin, Zemmour, Attal,
  Philippe… Les comptes médias X sont essentiellement des **doublons des
  outlets déjà couverts** (Le Monde, BFMTV, etc.).
- **Techniquement : X n'expose plus de flux RSS.** Nitter est mort, RSS-Bridge
  repose sur du scraping fragile qui casse dès que X change son anti-bot. Le
  pipeline n'a aucun mécanisme fiable, gratuit et durable pour ingérer X.
- L'influence sur X est réelle (réseau principal du discours politique), mais
  elle porte sur des **personnes**, pas des médias classables par Leaning selon
  notre règle.

**Recommandation X** : ne pas ajouter. Si besoin de couvrir ce discours, la
bonne porte d'entrée reste les outlets pressés qui le relaient, ou un jour
Bluesky (flux RSS/AT Protocol possible), mais l'audience y est encore faible
en France.

---

## Synthèse : les ajouts worth it, par influence

| Rang | Média | Support | Audience chiffrée | Première démarche |
|------|-------|---------|-------------------|-------------------|
| 1 | **HugoDécrypte** | YouTube + podcast | 3,8 M YT ; 2,87 M dl/mois ACPM (#1) | Vérifier flux, décider de son statut (agregateur sans Leaning ?) |
| 2 | **Legend** | YouTube + podcast | ~8 M écoutes/mois ; #1 Spotify 2025 ; 3,7 M YT | Vérifier flux audio ; dossier Leaning à risque (enquêtes en cours) |
| 3 | **Brut** | YouTube (+ site) | 2,8 M YT ; 35 M reach/mois ; TV linéaire | Choisir site ou YouTube comme flux ; sourcer le Leaning (OJIM) |
| 4 | **Blast** | YouTube + site | 1,7 M YT ; 500 M vues ; audition Sénat | Flux site RSS probable ; Leaning gauche (ACRIMED/Wikipedia) |
| 5 | **Thinkerview** | YouTube + podcast | 1,33 M YT ; 286 M vues | RSS natif ; Leaning droite contestataire (BFM, Wikipedia) |
| 6 | **Le Média** | YouTube | ~1,1 M YT | RSS YouTube ; Leaning gauche (charte + Wikipedia) |
| — | X/Twitter | X | followers, pas d'audience certifiée | **Écarter** : pas de RSS fiable |

## Sources principales

- ACPM, classements podcasts janvier & septembre 2026 ; bilan audio T1–T3 2025
  (acpm.fr)
- Médiamétrie, EAR > Podcast, août 2026 (mediametrie.fr)
- Inside Créateurs, Top 1000 YouTubeurs France, 30/07/2026 ; VideoTrends, oct.
  2026 ; ReachRanking / Social Blade / SPEAKRJ (chaînes individuelles)
- Le Figaro, « Legend, l'émission YouTube devenue un passage obligé pour les
  décideurs », 21/11/2025 ; Le Monde, enquête « Legend », 10/2026 ; Le Dossier ;
  INA – La Revue des médias (TPZ), 08/2026
- BFM TV, « Qui se cache derrière la chaîne YouTube Thinkerview ? », 05/09/2025
- 20 Minutes, « Comment les vidéos façon HugoDécrypte secouent les médias
  traditionnels », 17/06/2024 ; Capital (France 2, 2023)
- OJIM, « Brut, le média qui s'entend bien avec Emmanuel Macron », 05/2026 ;
  Stratégies (Brut TV, rentrée 2025-2026)
- Sénat, commission culture, « Médias en ligne : Blast, Basta! et
  StreetPress », 14/04/2026
- Décideurs Magazine / Le Point / La Loupe Politique (étude Visibrain ×
  Sciences Po Grenoble sur X) ; EU Matrix (MEPs on X, 04/2025)
- Documentation technique : feed Atom YouTube
  (`youtube.com/feeds/videos.xml?channel_id=…`), gist RSS endpoints
  (Nitter/RSS-Bridge pour X, morts ou fragiles)