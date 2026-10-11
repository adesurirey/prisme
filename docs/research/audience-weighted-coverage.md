# Audience par groupe de couverture, et pondérer la couverture ?

> Recherche (2026-10), derrière l'issue #84. Question : les trois groupes de
> couverture (Gauche / Centre / Droite, ADR-0010) sont-ils homogènes en audience ?
> Si non, la couverture — aujourd'hui un simple comptage de médias distincts
> (`packages/domain/src/coverage.ts`) — devrait-elle aussi représenter
> l'exposition, c'est-à-dire ce à quoi les gens sont effectivement exposés ?

**Tl;dr.** Les groupes sont très inégaux en audience totale (~4,6 % / ~80 % /
~15,7 %), mais presque équilibrés en audience médiane par média. Un seul média
du Centre (Ouest-France) atteint ~4× tout le groupe Gauche combiné. Recommandation :
garder le comptage (il mesure le pluralisme éditorial) et ajouter un second
indicateur d'exposition, avec des poids par média dans la config typée et une
compression log/sqrt de l'échelle.

---

## 1. Chiffres source

Tous les chiffres proviennent du dossier des 30 médias
(`docs/research/outlet-leanings.md`) : ACPM millésime 2025/2026 pour la presse
(diffusion France payée certifiée) et classement unifié des sites grand public
août 2026 (visites mensuelles), complétés par Semrush (estimations, non
certifiées) et déclarations sous serment pour Blast. Pour éviter de compter
deux fois un même média (papier + web), un chiffre de portée mensuelle par
média est retenu — priorité au web certifié, qui est l'usage dominant.

### Portée mensuelle retenue par média

| Média | Groupe | Portée retenue (M/mois) | Unité / source |
|---|---|---:|---|
| Ouest-France | Centre | 185,5 | visites ACPM |
| franceinfo | Centre | 136,5 | visites ACPM |
| Le Figaro | Droite | 125,9 | visites ACPM |
| BFMTV | Centre | 118,7 | visites ACPM |
| Le Monde | Centre | 95,5 | visites ACPM |
| 20 Minutes | Centre | 90,3 | visites ACPM |
| Le Parisien | Centre | 61,9 | visites ACPM |
| CNews | Droite | 30,2 | visites ACPM |
| Le HuffPost | Gauche | 17,9 | visites ACPM |
| Libération | Gauche | 15,9 | visites ACPM |
| L'Obs | Gauche | 10,5 | visites ACPM |
| RFI | Centre | 13,6 | visites ACPM |
| France 24 | Centre | 9,5 | visites ACPM |
| Courrier international | Centre | 7,9 | visites ACPM |
| L'Express | Centre | 6,7 | visites ACPM |
| Europe 1 | Droite | 4,7 | visites ACPM |
| Marianne | Centre | 4,8 | visites marianne.net (ACPM dossier) |
| Le JDD | Droite | 3,4 | visites ACPM |
| L'Humanité | Gauche | 3,3 | visites ACPM |
| La Croix | Centre | 3,5 | visites ACPM |
| Slate.fr | Centre gauche | 2,4 | téléchargements podcasts ACPM |
| L'Opinion | Centre droit | 0,63 | LDP ACPM S1 2026 |
| Mediapart | Gauche | ~0,26 | abonnés (déc. 2025) — trafic réel supérieur |
| Le Point | Centre | 0,26 | diffusion papier seule |
| Challenges | Centre | 0,23 | diffusion papier seule (DSH) |
| Atlantico | Droite | 0,36 | Semrush, estimé |
| Blast | Gauche | 0,36 | Semrush, estimé |
| Causeur | Droite | 0,24 | Semrush, estimé |
| Valeurs actuelles | Droite | 0,06 | diffusion papier seule |
| TF1 Info | Centre | **non quantifié** | Médiamétrie, hors ACPM — vraisemblablement des dizaines de M |

## 2. Estimation par groupe

| | Gauche (6) | Centre (17) | Droite (7) |
|---|---:|---:|---:|
| **Total** | ~48 M | ~840 M | ~165 M |
| **Part** | **~4,6 %** | **~80 %** | **~15,7 %** |
| Moyenne/média | ~8 M | ~49 M | ~23,5 M |
| Médiane/média | ~10,5 M | ~9,5 M | ~4,7 M |
| Max | HuffPost 17,9 M | Ouest-France 185,5 M | Figaro 125,9 M |
| Min | Blast ~0,36 M | Challenges 0,23 M | Causeur 0,24 M |

- **Spread intra-parc : ~750×** (Causeur 242 k → Ouest-France 185,5 M).
- **Un seul média du Centre (Ouest-France) atteint ~4× tout le groupe Gauche combiné** ;
  Le Monde + Ouest-France à eux deux pèsent plus que Gauche × 5,7.

## 3. Lecture

1. **Par média, les groupes sont presque équilibrés** (médianes 10,5 / 9,5 / 4,7 M).
   L'inégalité brute vient de la **taille des groupes** (6 / 17 / 7) et de la
   **queue lourde** du Centre (5 géants ≈ 75 % du total du groupe).
2. **Le comptage 1-1-1 n'est pas un 1-1-1 en exposition.** Une Story couverte par
   un média de chaque groupe, avec Ouest-France côté centre, correspond à une
   exposition d'environ 5 % / 80 % / 15 % — pas 33/33/33.
3. Les unités sont hétérogènes (visites, diffusion, abonnés, podcasts, Semrush) et
   le biais est uniformément **à la baisse** pour les médias non certifiés
   (Mediapart, Blast, TF1 Info, Le Point, Challenges, VA) : les totaux ci-dessus
   sont des planchers raisonnables, pas des mesures fines.

## 4. Que faire de la couverture ?

### Ne pas remplacer le comptage

Le comptage de médias distincts mesure le **pluralisme éditorial** : combien de
rédactions différentes ont jugé le sujet digne d'une couverture (news, live ou
opinion — ADR-0011), indépendamment de leur taille. C'est un choix de produit,
pas un accident. Les Blindspots en dépendent. Y substituer une pondération
d'audience détruirait cette signification.

### Ajouter un second indicateur : l'exposition

Pour chaque Story, une **part d'exposition par groupe** :

```
exposition[g] = Σ poids(audience des médias distincts du groupe g rapportant)
                / Σ poids(audience de tous les médias distincts rapportant)
```

Affichée en second, à côté de la barre de couverture (ex. « y sont exposés :
12 % gauche / 70 % centre / 18 % droite »). Le cas des trois médias dont un
géant devient visible.

Les poids vivent dans la config typée, sourcés comme le Leaning (ADR-0001) :

```ts
audience: { value: 185_500_000, unit: 'visits', source: 'ACPM', asOf: '2026-08' }
```

(Champs à affiner ; l'important est de garder l'unité et la source, les unités
n'étant pas comparables entre elles — voir §1.)

### Compression de l'échelle — à décider

- **Brut** : exposition pure. Mais un média vaut un groupe entier (Ouest-France
  ≈ 4× Gauche) : un groupe devient « couvert » dès qu'un géant écrit une ligne,
  et un blindspot survivrait à dix petits médias. Le régimer bascule le sens
  des indicateurs.
- **Log/sqrt (recommandé)** : influence tempérée par le pluralisme. Poids
  ∝ log10(portée), soit ~2–2,5 décades d'écart au lieu de ~750× ; l'ordre de
  grandeur entre médias est préservé, la domination d'un seul média non.

### Données à compléter avant implémentation

5 médias n'ont pas de chiffre de portée défendable : TF1 Info (Médiamétrie, à
consigner), Slate (podcasts — unité à part), Mediapart et Blast (abonnés, le
trafic réel est plus élevé), Valeurs actuelles (papier seul). À traiter dans la
config typée (unité + source explicites), pas en conversions silencieuses.
