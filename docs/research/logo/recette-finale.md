# Logotype Prisme — recette finale

Configuration retenue à l'issue de l'exploration (`type-exploration.html`,
`convergent-ou-divergent.md` dans ce dossier), **révision 2 — Fraunces** (détail de
la révision en fin de document). Variante **divergente** : les bords du mot s'ouvrent
vers l'extérieur, comme la dispersion d'un prisme.

Casse : **« PRISME »** tout en capitales — adoptée après le rendu réel dans l'UI
(option de repli devenue principale). Le mélange de hauteurs de « Prisme » (P
majuscule + x-heights) se lisait comme du tremblement sous le skew ; en capitales, le
mot tient comme un bloc et l'éventail devient un geste sur un mot solide.

## Réglages retenus

| Paramètre | Valeur |
|---|---|
| Casse | **« PRISME »** tout en capitales |
| Fonte | **Fraunces** (variable, `SOFT 0, WONK 0`) |
| Graisse | **Bold (700)** |
| Angle max (1ʳᵉ et dernière lettre) | **8°** |
| Courbe du dégradé | **linéaire (courbe 1)** — chaque lettre un cran sur le même arc |
| Tracking | **0** (l'interlettrage natif de Fraunces est déjà généreux) |
| opsz | 14 en nav, 32 en display |

Pourquoi ces choix :

- **Fraunces** : révision 2. La version Inter Extra Bold à 20° lisait « futuriste »
  (verdict du rendu réel : Star Wars). Fraunces Bold lit **manchette de presse** — le
  registre juste pour un média d'actualité. La fonte est variable (axes `opsz`,
  `wght`, `SOFT`, `WONK`) ; le script instancie les glyphs exacts, comme avant.
- **Bold 700, pas Black** : à 900 les contrepoinches serif se ferment ; à 700 le mot
  est massif et respire, jusqu'à 14px de navbar.
- **Angle max 8°** : réduit de 20° (révision 2). À 20° le skew hurlait ; à 8° il
  murmure. Le fan devient un accent : le bloc tient, l'œil attentif attrape la dérive
  de la fin du mot. Limite notée au rendu réel : **sous ~16px (navbar, favicon),
  l'éventail est imperceptible** — le geste ne vit réellement qu'au display et, pour
  le mark, dans la signature d'un P signé plutôt que d'un P générique. Le logo
  complet n'est affiché qu'à la navbar aujourd'hui : le mot reste volontairement
  sage là où il est petit.
- **Tracking 0** : l'interlettrage natif de Fraunces est généreux ; l'ajout d'air
  (0.08em, la règle Inter) desserrait artificiellement le mot.
- **WONK 0** : vérifié **sans effet sur les glyphes P R I S M E** (outlines identiques
  WONK 0 vs 1, opsz 14 et 32, capitales comme bas-de-casse) — les alternates
  fantaisistes de Fraunces vivent dans d'autres lettres. Figé à 0 pour l'exactitude.
- **Courbe linéaire (courbe 1)** : inchangé de la révision 1 — la réfraction est
  continue, chaque lettre suit le même arc.
- **PRISME en capitales** : inchangé — le mot tient comme un bloc et le skew lit
  comme un geste, pas comme du jitter.

## Angles par lettre

À angle max 8° et courbe linéaire (négatif = penche à gauche, vers l'extérieur).
**Sans compensation optique** : la formule ne dépend que de la position de la lettre.

| P | R | I | S | M | E |
|---|---|---|---|---|---|
| +8° | +4.8° | +1.6° | −1.6° | −4.8° | −8° |

Formule : `angle(i) = 8° × (1 − 2·i/5)` pour i = 0..5.

## Reproduction dans Figma

Figma ne sait pas cisailer via l'interface — utiliser le plugin **Skew** ou
**Skewdat** (gratuits, Community), lettre par lettre :

1. Créer six textes indépendants `P`, `R`, `I`, `S`, `M`, `E` — Fraunces Bold,
   même taille, même `y` (le cisaillement ne déplace rien verticalement)
2. Appliquer les angles du tableau ci-dessus
3. Tracking 0 — l'espacement natif de Fraunces suffit

## Favicon & icônes d'app

Retenu : **le P à l'angle du wordmark** (+8°, le haut penche à gauche) — Fraunces
Bold, même matrice de skew que la première lettre du logotype (prototypes dans
`favicon-prototypes.html`).

L'argument fondateur reste valable : pour Prisme, **l'absence d'inclinaison n'est pas
neutre, c'est le centre** — un P droit nous positionnerait politiquement au centre,
exactement ce que l'icône ne doit pas dire. Le P incliné à l'angle du wordmark
garantit la cohérence marque/mot : la première lettre de la navbar EST l'icône.

Note du rendu réel (révision 2) : à +8° et en Fraunces (P plus large que haut), le
favicon se lit d'abord comme un P serif massif — l'inclinaison est un détail. Accepté
au vu du produit : l'icône signe, elle ne raconte pas.

Décisions d'exploration notées (historique) :

- le **mini-éventail P·R·I** est une impasse : à 16px le dégradé d'angle devient du
  bruit, la forme ne se lit plus
- **pas de couleur** dans l'icône : noir et blanc, 100% typographique
- tailles produites : 192/512 px (manifest "any"), maskable 192/512,
  apple-touch 180 px — toutes carrées par construction (`generate-icons.ts` compose
  le mark au centre d'une toile carrée ; le P Fraunces, plus large que haut, entre
  dans le carré par sa largeur)

## Implémentation web

Pas de HTML par lettre : les assets sont des **SVG générés** par
`web/scripts/generate-brand-svg.py` (outlines Fraunces exactes, matrices affines, un
`<path>` par lettre), écrits dans `web/src/assets/brand/` :

- `prisme-wordmark-nav.svg` (tracking 0, opsz 14) — inline dans `Base.astro` via
  `?raw`, hauteur 14px, `fill="currentColor"` suit le thème
- `prisme-wordmark-display.svg` (tracking 0, opsz 32) — usage hero/à-propos
- `prisme-mark.svg` (P, +8°, opsz 14) — **source unique de la géométrie** :
  `favicon.ts` (data URIs clair/sombre, pad 0.18) et `PrismeMark.tsx` le dérivent par
  import `?raw`, `generate-icons.ts` le rasterise en PNG (carrés, non rognés)

Régénération après tout changement de recette :
`python3 web/scripts/generate-brand-svg.py && pnpm --filter @prisme/web generate:icons`.

## Historique des révisions

- **Révision 1 — Inter Extra Bold, 20°, tracking adaptatif** : la première recette
  complète. Rejetée au rendu réel : lisait « futuriste / Star Wars », un registre
  produit-tech pour un média de presse.
- **Révision 2 — Fraunces Bold, 8°, tracking 0** (actuelle) : l'esprit manchette de
  presse. La personnalité est rationnée à un seul attribut (l'angle), réduit au
  minimum perceptible au display ; en petit, le nom est volontairement sage. Option
  neutralité totale (fonte système, zéro geste) examinée et écartée : sur un site
  noir & blanc sans autres signaux de marque, le nom serait le seul élément
  reconnaissable — le rendre générique le ferait lire comme du placeholder.