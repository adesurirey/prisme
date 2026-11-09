# Widgets et notifications push sur Expo — ce que mobile v1 ne doit pas compromettre

Recherche de faisabilité pour l'app mobile (issue #169), menée le **2026-11-09**
uniquement contre des sources primaires : docs Expo (y compris leur export
Markdown pour agents), JSON de métadonnées Apple Developer, registre npm,
dépôts GitHub. Date d'accès de toutes les sources : 2026-11-09.

Question directrice : état de l'art 2026 sur les widgets home screen iOS,
widgets Lock Screen iOS, widgets home screen Android, et push notifications ;
quelles approches exigent du natif ou des config plugins ; quels planchers de
plateforme ; et surtout — **mobile v1 doit-il pré-commettre quoi que ce soit**
(SDK, managed vs bare, structure de bundle, setup EAS) pour éviter une
réécriture le jour où widgets et notifications arrivent ?

---

## TL;DR — la réponse

**Non : v1 peut sortir propre, aucun pré-commitment.** Depuis le SDK 55
(février 2026), Expo fournit un module officiel **`expo-widgets`** : widgets
home screen iOS **et** Android, widgets Lock Screen, et Live Activities, écrits
en TypeScript avec des composants Expo UI (SwiftUI / Jetpack Compose), via un
config plugin intégré — **zéro Swift/Kotlin à écrire**, workflow managed (CNG)
pleinement supporté. Côté notifications, `expo-notifications` n'est **pas**
déprécié en bloc (seules des APIs précises l'ont été, voir §3), et le service
Expo push reste gratuit. Les planchers exigés par les widgets (iOS 16+) sont
déjà couverts par ceux du SDK 58 (iOS 16.4+, Android 7+), qui sont les planchers
par défaut d'un projet créé aujourd'hui.

Les seules conditions — toutes déjà satisfaites par les choix actuels du map
(issue #168) :

1. Rester en **workflow managed / CNG** (ne pas committer `ios/` ni `android/`)
   — c'est le mode pour lequel le config plugin d'`expo-widgets` est conçu.
2. Partir d'un **SDK courant** (≥ 55 ; `create-expo-app` donne le 58
   aujourd'hui) — un SDK ≤ 54 n'a pas `expo-widgets`.
3. Garder le **bundle id stable** une fois publié (`info.leprisme.app`) — le
   plugin en dérive automatiquement l'extension (`info.leprisme.app.ExpoWidgetsTarget`)
   et l'app group (`group.info.leprisme.app`) ; renommer un bundle id après
   publication est pénible pour tout le monde, widgets ou pas.
4. Tester avec des **development builds**, pas Expo Go — vraie pour le push
   (`expo-notifications`) comme pour `expo-widgets`, tous deux absents d'Expo Go.
   v1 en closed testing (TestFlight / Play internal) utilise des builds natifs
   de toute façon.

Rien à pré-commettre côté `eas.json`, structure de projet, ou repo : ajouter les
widgets plus tard = installer `expo-widgets` + sa config plugin + `expo prebuild`
+ rebuild (changement natif : passage par un build, pas par OTA). Voir §5 pour
les pièges de fraîcheur des données, qui sont d'architecture produit, pas
d'outillage.

---

## 1. Widgets : le module officiel `expo-widgets` (SDK 55+)

**Timeline** (registre npm) : canaries dès janvier 2026, première version
stable `55.0.0` le **2026-02-25** (jour du SDK 55), versionné à chaque SDK
depuis (56 le 2026-05-05, 57 le 2026-06-25, 58 le 2026-09-10). Version
courante : **58.0.27** (2026-11-03). Maintenu par l'équipe Expo dans le
monorepo `expo/expo` (`packages/expo-widgets`).

Sources : [docs `expo-widgets`](https://docs.expo.dev/versions/latest/sdk/widgets/),
[registre npm `expo-widgets`](https://registry.npmjs.org/expo-widgets),
[exemple officiel `with-widgets`](https://github.com/expo/examples/tree/master/with-widgets).

Ce qu'il couvre, sans écrire de natif :

- **iOS home screen** : familles `systemSmall` / `systemMedium` /
  `systemLarge` / `systemExtraLarge` (iPad).
- **iOS Lock Screen** : familles `accessoryCircular`, `accessoryRectangular`,
  `accessoryInline` — donc les widgets d'écran verrouillé, avec le mode de
  rendu `vibrant` (monochrome adaptatif) exposé via `environment`.
- **Live Activities** (Lock Screen + Dynamic Island) via `createLiveActivity`,
  mises à jour distantes par push APNs (§3), y compris démarrage à distance
  (push-to-start, iOS 17.2+).
- **Android home screen** : opt-in via `enableAndroid`, même API `createWidget`,
  layouts en composants `@expo/ui/jetpack-compose`. Sous le capot c'est
  **androidx.glance 1.2.0** (Glance = Compose pour AppWidgets, rendu en
  RemoteViews) — source : `packages/expo-widgets/android/build.gradle` sur le
  tag `sdk-58`.
- Widgets **interactifs** (bouton) et **configurables** (édition au
  long-press) : iOS 17+.
- Notifications Android au layout custom (`CustomNotification`) quand
  `enablePushNotifications` est activé.

Le mécanisme : un composant marqué de la directive `'widget'` est compilé par
le bundler dans **un bundle JS séparé qui tourne dans le runtime isolé de
l'extension** — pas dans le runtime React Native de l'app. Contraintes du
runtime widget (toutes documentées) : composants Expo UI uniquement (pas de
`View`/`Text` de react-native), pas de hooks, pas d'état, **pas d'asynchrone**
(donc pas de fetch), pas de références au scope du module. Toutes les données
arrivent par les props que l'app pousse (`updateSnapshot`, `updateTimeline`) ou
par l'`environment`. L'extension iOS est générée par le config plugin
(bundle id `<app>.ExpoWidgetsTarget`, app group `group.<app>` par défaut).

Limite documentée : pas d'Expo Go, development build requis ; l'exemple
officiel précise « requires a development build and **iOS 16 or later** ».
Côté Android, les timelines, widgets configurables et Live Activities sont
iOS-only ; Android n'a que `updateSnapshot`.

Maturité : module de ~9 mois, changelog très actif (58.0.27 dans la première
semaine de novembre 2026). Le programme du repo Expo (`@expo/ui`, Swift
interop) évolue vite — raison de plus pour pinner le SDK et mettre à jour par
sauts de SDK.

## 2. Approches alternatives (natif à la main via config plugins)

Avant le module officiel, et pour les cas qu'il ne couvre pas, trois voies
existent — toutes **compatibles managed/CNG via config plugins**, mais exigent
d'écrire le Swift/Kotlin soi-même :

- **`@bacons/apple-targets`** (Evan Bacon) — v5.0.0 du 2026-07-17. Génère des
  targets Apple arbitraires (widget, App Clip…) dans un dossier `targets/`
  hors de `ios/`, intégrées au prebuild. On écrit le SwiftUI WidgetKit à la
  main. Exige CocoaPods 1.16.2+, Xcode 16+, Expo SDK 53+.
  Source : [npm `@bacons/apple-targets`](https://www.npmjs.com/package/@bacons/apple-targets).
- **`@bittingz/expo-widgets`** (npm : `expo-widget`, à ne pas confondre avec
  l'officiel) — plugin qui compile **vos** fichiers Swift WidgetKit et Kotlin
  AppWidgetProvider en targets générées ; partage de données via UserDefault
  suite. Dernier publish : 3.0.3, **août 2025** — dormant depuis ~15 mois.
  Source : [registre npm `expo-widget`](https://registry.npmjs.org/expo-widget).
- **`react-native-android-widget`** (Stefan Aleksovski) — v0.26.0 du
  2026-10-29, actif (~900 étoiles). Android seul. Mécanisme différent : rend
  des **vues React Native en image** (via WebView cachée) et affiche cette
  image dans le widget ; support Expo via config plugin dédié ; v0.15+
  exige RN 0.76+. Utile si l'on veut du RN plutôt que le sous-ensemble Compose
  du module officiel — mais image ≠ layout natif, et les clics passent par un
  round-trip calibration.
  Sources : [docs](https://saleksovski.github.io/react-native-android-widget/),
  [limitations](https://saleksovski.github.io/react-native-android-widget/docs/limitations),
  [repo](https://github.com/sAleksovski/react-native-android-widget).

Verdict : pour nos besoins (widgets simples « dernières Nouveau/Brûlant/Top »),
la voie officielle `expo-widgets` a supplanté ces alternatives ; elles ne se
justifient plus que pour du natif exotique (ex. complications watchOS
hors Live Activities, effets SwiftUI non exposés par `@expo/ui`).

## 3. Notifications push : `expo-notifications` et le service Expo

**`expo-notifications` n'est pas déprécié en bloc** — c'est toujours la voie
documentée par Expo pour les tokens, la réception et les notifications locales
(version courante 58.1.8, README actif, guides push à jour). Ce qui a été
déprécié, précisément :

- **SDK 53** (v0.31.0, 2025-04-25, changelog GitHub) : `shouldShowAlert`
  remplacé par `shouldShowBanner` / `shouldShowList` (alignement sur
  `UNNotificationPresentationOptions` d'iOS 15).
- **SDK 58** (docs API actuels) : les getters Async
  (`getLastNotificationResponseAsync`, `clearLastNotificationResponseAsync`)
  remplacés par leurs équivalents sync ; le type `Subscription` remplacé par
  `EventSubscription` ; `allowAnnouncement` (ignoré par iOS) en sursis.

Sources : [CHANGELOG `expo-notifications`](https://github.com/expo/expo/blob/sdk-53/packages/expo-notifications/CHANGELOG.md),
[docs API notifications](https://docs.expo.dev/versions/latest/sdk/notifications/).

**Le service Expo push** (celui derrière les Expo push tokens) :
gratuit (« There is no cost associated with sending notifications through
Expo push notification service » — FAQ), limite **600 notifications/seconde/
projet**, livraison best-effort via FCM/APNs. L'outil
[expo.dev/notifications](https://expo.dev/notifications) permet d'envoyer des
pushes de test. Vérifié le 2026-11-09 : **il n'existe pas de produit « EAS
Push » distinct** (aucune page produit ni entrée pricing ; le terme du ticket
correspond au service Expo push + les credentials gérés côté EAS). Noter le
renommage en cours : « EAS » devient « Expo Services » dans la doc (Expo Build,
Expo Update…), **les commandes `eas` et `eas.json` gardent leur nom**.

Credentials (documentés, additifs) : iOS → push key APNs gérée par
`eas credentials` ; Android → **clé de service FCM v1** obligatoire (l'API
legacy FCM est morte ; Google impose HTTP v1). Le push n'est pas dans Expo Go :
development build requis.

Sources : [FAQ push](https://docs.expo.dev/push-notifications/faq/),
[sending](https://docs.expo.dev/push-notifications/sending-notifications/),
[setup FCM v1](https://docs.expo.dev/push-notifications/push-notifications-setup/),
[FCM v1 credentials](https://docs.expo.dev/push-notifications/fcm-credentials/),
[blog : migrating to FCM v1](https://expo.dev/blog/expo-push-notifications-migrating-to-fcm-v1),
[renommage EAS → Expo Services](https://docs.expo.dev/eas-to-expo/).

**Sans backend** (notre cas : JSON statique sur GitHub Pages) : l'envoi de
pushes ne demande pas de serveur dédié — une GitHub Action en cron qui appelle
l'API Expo (`expo-server-sdk-node`, qui gère le rate-limit 600/s) suffit. Seule
nuance : les mises à jour de **Live Activities** se font via APNs avec le push
type spécial (`apns-push-type: liveactivity`, topic
`<bundle>.push-type.liveactivity`, payload `event` start/update/end) — les docs
d'`expo-widgets` documentent le format exact côté serveur.

## 4. Planchers de plateforme

| Capability | Plancher | Source |
| --- | --- | --- |
| Expo SDK 58 (projet créé aujourd'hui) | **iOS 16.4+, Android 7+ (API 24)**, compileSdk 37, targetSdk 36, Xcode 26.4+ | docs Expo versions |
| `expo-widgets` (iOS) | **iOS 16+** (exemple officiel) ; le SDK 58 impose 16.4 de toute façon | with-widgets README |
| WidgetKit (home screen iOS) | iOS 14.0 | métadonnées Apple Developer |
| Widgets Lock Screen (familles `accessory*`) | **iOS 16.0** (le « 16.2 » du ticket est en fait 16.0) | `WidgetFamily.accessoryRectangular` introducedAt 16.0 |
| Live Activities | iOS 16.1 (ActivityKit) ; push-to-start 17.2 | ActivityKit introducedAt 16.1 + docs expo-widgets |
| Widgets interactifs / configurables | iOS 17+ | docs expo-widgets |
| Budget de refresh WidgetKit | ~40–70 rechargements/jour, soit toutes les 15–60 min | Apple, « Keeping a widget up to date » |
| Widgets Android | plancher = celui du SDK (Android 7+) ; tailles en cellules réservées Android 12+ | docs expo-widgets + docs versions |

Autrement dit : **aucun plancher que v1 n'imposerait déjà.** Le SDK 58 pose
iOS 16.4 / Android 7 par défaut ; tout ce que les widgets ajoutent au-delà
(interactif iOS 17, push-to-start 17.2) se gère à l'exécution par appareil,
pas par target de déploiement.

## 5. Les pièges (aucun bloquant, tous à connaître)

1. **Fraîcheur des données — le vrai sujet produit.** Le runtime widget ne
   peut pas fetcher (pas d'async). Le contenu d'un widget home screen est donc
   celui que **l'app a poussé à son dernier lancement** (`updateSnapshot` /
   `updateTimeline` au moment où l'app tourne). Avec notre JSON statique
   GitHub Pages, un widget affichera l'édition du dernier open de l'app — même
   régime de fraîcheur que l'app elle-même, mais figé entre deux opens. Le
   budget WidgetKit d'Apple (40–70 refresh/jour) ne change rien ici : sans
   fetch côté widget, il n'y a rien à rafraîchir. Le seul canal poussable à
   distance est le **Live Activity** (via APNs). À trancher le jour venu :
   accepter « à jour au dernier open », ou ajouter une GitHub Action qui pousse
   des Live Activities/notifications à chaque édition.
2. **Changement natif = build.** Ajouter/modifier les widgets passe par
   prebuild + rebuild (pas d'OTA). Sans incidence sur v1, mais à prévoir dans
   le rythme de release.
3. **Expo Go incompatible** avec `expo-widgets` et le push : development
   builds dès le début. Déjà le cas en closed testing.
4. **iOS-only sur Android** : timelines, widgets configurables et Live
   Activities n'existent pas côté Android (le doc le dit explicitement) ;
   prévoir un design Android qui vit avec `updateSnapshot` seul.
5. **App Groups / provisioning** : le plugin ajoute l'entitlement app group
   (`group.<bundle>`) et dérive les ids automatiquement ; les docs EAS ne
   documentent pas explicitement la synchro du capability sur l'App ID Apple
   (docs app-signing consultées : aucun mot sur les app groups). À vérifier au
   premier build avec widgets si credentials gérés — probablement automatique
   (profil régénéré au build), sinon une case à cocher dans le portail Apple.
6. **Jeunesse du module** : 9 mois, APIs encore mouvantes (le changelog montre
   des renommages récents). Pinner le SDK, upgrader par sauts de SDK, ne pas
   coupler la v1 à ses APIs.

## 6. Conclusion — ce que v1 doit (et ne doit pas) faire

**v1 ship clean.** Aucun pré-commitment : ni SDK particulier au-delà de
« courant », ni passage bare, ni structure de bundle à réserver, ni eas.json à
préparer. Les quatres garde-fous du TL;DR (managed/CNG, SDK ≥ 55, bundle id
stable après publication, dev builds) sont déjà les choix par défaut du stack
posé dans le map. Les widgets et le push s'ajoutent plus tard comme des
paquets + config plugin + rebuild, et le seul arbitrage produit à garder en
tête dès maintenant est celui du piège n° 1 (fraîcheur des widgets sans
backend).

## Sources

- Expo `expo-widgets` (docs, consultées en Markdown) :
  <https://docs.expo.dev/versions/latest/sdk/widgets/>
- Exemple officiel `with-widgets` : <https://github.com/expo/examples/tree/master/with-widgets>
- Registre npm (versions, dates, maintainers) : `expo`, `expo-widgets`,
  `expo-notifications`, `expo-widget`, `@bacons/apple-targets`,
  `react-native-android-widget`
- `expo/expo` tags `sdk-53` / `sdk-58` : `packages/expo-notifications/CHANGELOG.md`,
  `packages/expo-widgets/android/build.gradle`
- Expo docs push : overview, what-you-need-to-know, setup, sending, FAQ,
  fcm-credentials, app-signing ; `eas-to-expo`
- Outil de test push : <https://expo.dev/notifications>
- Apple Developer (JSON de métadonnées) : WidgetKit (iOS 14.0),
  `WidgetFamily.accessoryRectangular` (16.0), ActivityKit (16.1),
  « Keeping a widget up to date » (budget de refresh)
- `react-native-android-widget` : docs + page Limitations
  <https://saleksovski.github.io/react-native-android-widget/>
