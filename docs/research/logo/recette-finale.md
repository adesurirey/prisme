# Logotype Prisme — recette finale

Configuration retenue à l'issue de l'exploration (`type-exploration.html`,
`convergent-ou-divergent.md` dans ce dossier). Variante **divergente** : les bords
du mot s'ouvrent vers l'extérieur, comme la dispersion d'un prisme.

Casse retenue : **« Prisme »** — P majuscule, reste en bas-de-casse. Option de repli
préférée : **« PRISME »** tout en capitales (plus identifiable à très petite taille,
mais plus imposante). La recherche continue avec « Prisme » : à décliner dans l'UI du
site, et revenir à l'exploration si le rendu déçoit.

## Réglages retenus

| Paramètre | Valeur |
|---|---|
| Casse | **« Prisme »** (P majuscule, reste en bas-de-casse) |
| Fonte | **Inter** (variable), fallback `system-ui` |
| Graisse | **Extra Bold (800)** |
| Angle max (1ʳᵉ et dernière lettre) | **20°** |
| Courbe du dégradé | **linéaire** (chaque lettre est un cran sur un même arc) |
| Tracking | **adaptatif** : 0.08em sous ~32px, 0.04em au-dessus |

Pourquoi ces choix :

- **Inter** : lisible à toute taille, ADN tech/data cohérent avec le produit ; SF Pro
  (fonte système Mac) a été testée mais rend quasiment identique à Inter Black et son
  licence interdit l'usage web hors plateformes Apple — Inter embarqué + fallback
  `system-ui` donne le meilleur des deux mondes. Libre Franklin manquait de netteté au
  E à petite taille ; Fraunces (didone à haut contraste) se brouille sous 24px.
- **Extra Bold plutôt que Black** : à 900 les contrepoinches se ferment et le skew à
  20° fait se toucher les diagonales ; à 800 les formes respirent, surtout en petit.
- **Courbe linéaire** : la réfraction est continue — chaque lettre suit le même arc
  plutôt qu'un noyau rigide au centre.
- **Tracking adaptatif** : à petite taille l'air compense le désalignement des lettres
  penchées (0.08em) ; en display les gros corps demandent moins d'interlettrage
  (0.04em), sinon le mot se désolidarise.
- **« Prisme » plutôt que PRISME** : plus subtil, plus humain, moins imposant — le
  rythme des hauteurs (P capitale, puis x-heights) donne une silhouette vivante.
  PRISME reste l'option de repli : silhouette plus robuste à très petite taille, mais
  plus criarde.

## Angles par lettre

À angle max 20° et courbe linéaire, angle de chaque lettre (négatif = penche à
gauche, vers l'extérieur). **Sans compensation optique** : la formule ne dépend que
de la position de la lettre dans le mot, pas de la hauteur du glyphe. Une variante
avec compensation optique (surcroît d'angle pour les x-heights, preset « Prisme
équilibré » dans l'outil d'exploration) existe mais est écartée pour l'instant — à
réessayer si le rendu UI déçoit.

| P | r | i | s | m | e |
|---|---|---|---|---|---|
| +20° | +12° | +4° | −4° | −12° | −20° |

Formule : `angle(i) = 20° × (2.5 − i) / 2.5` pour i = 0..5, arrondi à l'entier.

## Reproduction dans Figma

Figma ne sait pas cisailer via l'interface — utiliser le plugin **Skew** ou
**Skewdat** (gratuits, Community), lettre par lettre :

1. Créer six textes indépendants `P`, `r`, `i`, `s`, `m`, `e` — Inter Extra Bold,
   même taille, même `y` (les baslines s'alignent automatiquement : le cisaillement
   ne déplace rien verticalement)
2. Appliquer les angles du tableau ci-dessus
3. Crénage : laisser l'espacement par défaut + le tracking retenu, puis ajuster à
   l'œil — le R et le M « avancent » en haut vers leurs voisins

## Favicon & icônes d'app

Retenu : **le P droit** — la capitale seule, Inter Extra Bold, sans skew
(prototypes dans `favicon-prototypes.html`).

Décisions d'exploration notées :

- le **P skewé** (12°, penché à droite) a été testé : l'ADN du logo survit en app
  icon mais coûte de la netteté à 16px — écarté au profit de la simplicité
- le **mini-éventail P·R·I** (P à l'angle du logo, R droit, I à l'angle du E) est une
  impasse : à 16px le dégradé d'angle devient du bruit, la forme ne se lit plus
- le P du favicon penche à **droite** quand il penche (l'opposé du P du wordmark) :
  isolée de son contexte, une lettre penchée à gauche risquerait une lecture
  politique — raisonnement qui a aussi motivé l'abandon du skew pour l'icône
- **pas de couleur** dans l'icône : noir et blanc, 100% typographique
- tailles à produire : 16, 32, 48 px (favicon), 180 px (apple-touch), avec les
  marges de safe-area pour les icônes masquables Android
- la version définitive se découpe sur mesure à partir des courbes d'Inter Extra
  Bold (contour unique, pas un texte rendu)

## Implémentation web

```html
<style>
  .prisme-logo {
    font-family: "Inter", system-ui, sans-serif;
    font-weight: 800;
    font-size: 24px;              /* navbar */
    letter-spacing: 0.08em;
  }
  .prisme-logo span { display: inline-block; transform-origin: 0 100%; }
  /* variantes display */
  .prisme-logo--hero { font-size: 72px; letter-spacing: 0.04em; }

  .prisme-logo .l-p { transform: skewX( 20deg); }
  .prisme-logo .l-r { transform: skewX( 12deg); }
  .prisme-logo .l-i { transform: skewX(  4deg); }
  .prisme-logo .l-s { transform: skewX( -4deg); }
  .prisme-logo .l-m { transform: skewX(-12deg); }
  .prisme-logo .l-e { transform: skewX(-20deg); }
</style>
<span class="prisme-logo" aria-label="Prisme">
  <span class="l-p">P</span><span class="l-r">r</span><span class="l-i">i</span><span
  class="l-s">s</span><span class="l-m">m</span><span class="l-e">e</span>
</span>
```

- `transform-origin: 0 100%` (coin bas-gauche de chaque lettre) : la ligne de base
  reste droite, seul l'inclinaison varie
- Accessibilité : `aria-label="Prisme"` sur le conteneur, `aria-hidden="true"` sur les
  lettres si le lecteur d'écran les lit séparément
- Charger Inter en **variable** (`wght 400–900`) pour l'UI et le logo avec une seule
  fonte ; le fallback `system-ui` prend le relais avant chargement et hors ligne