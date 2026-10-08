import type { Outlet } from './index.ts';

/**
 * The sourced Outlet config (issue #2): the source of truth for the pipeline
 * and for /pourquoi-ce-classement. Research, source quotes and the method live
 * in `docs/research/outlet-leanings.md`; this module is the typed encoding of
 * it, and `outlets.test.ts` enforces the evidence rules.
 *
 * Leaning is per Outlet, set by hand, backed by cited sources (ADR-0001).
 * Field names are English; publishable values (takeaways, notes, evidence) are
 * French, as shown on the site. Quotes from sources stay citation-length:
 * the site never republishes Outlet text (ADR-0003).
 *
 * Placement rule: FrIdéo's seven bands are folded into Prisme's three Leanings
 * — `far-left`/`left` → gauche, `center-left`/`center`/`center-right` → centre,
 * `right`/`far-right` → droite. Outlets not covered by FrIdéo are placed from
 * the other sources, with the disagreement written down.
 */

/** One cited public source behind an Outlet's Leaning. */
export interface LeaningSource {
  /** Title as published. */
  title: string;
  /** Author or organisation. */
  author: string;
  /** Publication date (ISO date, year, or empty string when unknown). */
  date: string;
  url: string;
  /** One-line takeaway in French, publishable on the site. */
  takeaway: string;
}

/** Why the Outlet is in the Edition: audience evidence, or editorial significance. */
export interface Readership {
  /** ACPM rank/figure, monthly visits, subscriber count… in French, publishable. */
  evidence: string;
  /** Where the figure comes from. */
  url?: string;
}

/** Which role a feed plays for the Front page (see GLOSSARY.md). */
export type FeedKind = 'une' | 'latest';

/** One feed's verified state, checked with a normal browser User-Agent. */
export interface FeedCheck {
  kind: FeedKind;
  url: string;
  /** ISO date of the verification. */
  checkedAt: string;
  /** HTTP status, 0 when the fetch itself failed. */
  status: number;
  /** Items in the feed at check time. */
  items: number;
  /** Time covered by the feed's items (empty when the feed carries no dates). */
  covers: string;
  /** Whether items carry feed images (hotlinked, never stored — ADR-0003). */
  images: 'none' | 'some' | 'all';
  /** Recorded quirks: missing dates, firehose feeds, duplicate content… */
  note?: string;
}

/** Whether the Outlet reserves text and data mining (EU DSM art. 4). */
export interface TdmReservation {
  /**
   * True when `/.well-known/tdmrep.json` publishes a reservation, false when the
   * Outlet publishes none, null when the probe itself is blocked (undetermined).
   */
  reserved: boolean | null;
  /** ISO date of the check. */
  checkedAt: string;
  /** What was actually observed (blocked probe, reservation policy…). */
  note?: string;
}

export interface OutletConfig extends Outlet {
  // `site` (the Outlet website) is inherited from Outlet; it is what the TDM
  // probe and the site's outlet links use.
  /** At least two independent, citable sources (enforced by tests). */
  leaningSources: LeaningSource[];
  /** Why this Leaning, including where sources disagree. Publishable French. */
  leaningNote: string;
  readership: Readership;
  /** Verification evidence for each declared feed. */
  feedChecks: FeedCheck[];
  /** Informational only — the collector reads RSS headlines and teasers (ADR-0003). */
  tdm: TdmReservation;
}

/** An Outlet kept out of the Edition, with the reason and the date checked. */
export interface ExcludedOutlet {
  id: string;
  name: string;
  /** Why it is out, in French, publishable. */
  reason: string;
  /** ISO date the reason was verified. */
  checkedAt: string;
}

const CHECKED = '2026-10-06';

/** Issue #11: Libération's Arc XP outbound feed verified a day after the rest. */
const CHECKED_11 = '2026-10-07';

/** Le Point's Arc XP outbound feed, found the same way as Libération's. */
const CHECKED_LE_POINT = '2026-10-07';

/** The Outlets of the Edition, grouped by Leaning. The perimeter is open (issue #10). */
export const outlets: OutletConfig[] = [
  // ——— Gauche ———
  {
    id: 'lobs',
    name: "L'Obs",
    leaning: 'gauche',
    paywall: 'partial',
    site: 'https://www.nouvelobs.com',
    feeds: { latest: 'https://www.nouvelobs.com/rss.xml' },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe Le Nouvel Obs ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/le-nouvel-obs',
        takeaway:
          'Score −0,89 dans la bande « gauche » (intervalle −1,54…−0,24) : le classement à gauche est soutenu par les données, 5 familles de preuves sur 9.',
      },
      {
        title: 'Le Nouvel Obs (article encyclopédique)',
        author: 'Wikipédia (avec les ouvrages et articles cités en notes)',
        date: '2026',
        url: 'https://fr.wikipedia.org/wiki/Le_Nouvel_Obs',
        takeaway:
          "« Historiquement situé à gauche et d'inspiration mendésiste puis sociale-démocrate, le titre revendique depuis 2020 une ligne de gauche progressiste ».",
      },
    ],
    leaningNote:
      'Placé à gauche : la bande « gauche » de FrIdéo correspond à notre case Gauche, et le magazine revendique lui-même une ligne de gauche progressiste. Aucun désaccord notable entre les sources.',
    readership: {
      evidence:
        'ACPM presse magazine 2025/2026 : 38e rang, 162 242 exemplaires France payée ; Nouvelobs.com : 46e rang des sites, 10,5 M de visites (août 2026).',
      url: 'https://www.acpm.fr/classements/pmag',
    },
    feedChecks: [
      {
        kind: 'latest',
        url: 'https://www.nouvelobs.com/rss.xml',
        checkedAt: CHECKED,
        status: 200,
        items: 200,
        covers: '~6 jours',
        images: 'some',
        note: 'Flux volumineux (200 articles) : seul un extrait de la journée arrive à la fenêtre des 24 h (80 articles sur 200 portent une image).',
      },
    ],
    tdm: {
      reserved: false,
      checkedAt: CHECKED,
      note: 'Pas de tdmrep.json (404).',
    },
  },
  {
    id: 'huffpost',
    name: 'Le HuffPost',
    leaning: 'gauche',
    paywall: 'none',
    site: 'https://www.huffingtonpost.fr',
    feeds: { latest: 'https://www.huffingtonpost.fr/rss/all_headline.xml' },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe Le HuffPost ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/le-huffpost',
        takeaway:
          "Score −1,00 dans la bande « gauche » (intervalle −1,81…−0,18) : intervalle large, le média n'est couvert que par 4 familles de preuves.",
      },
      {
        title: 'Le HuffPost (article encyclopédique)',
        author: 'Wikipédia (avec les sources citées en notes)',
        date: '2026',
        url: 'https://fr.wikipedia.org/wiki/Le_HuffPost',
        takeaway:
          "La ligne éditoriale du HuffPost est « généralement classée à gauche » — l'article renvoie surtout à l'édition américaine et à ses contributeurs (2011-2012).",
      },
    ],
    leaningNote:
      "Placé à gauche : les deux sources pointent à gauche, avec deux réserves écrites ici — FrIdéo ne dispose que de 4 familles de preuves (intervalle large), et la référence de Wikipédia porte sur l'édition américaine du HuffPost.",
    readership: {
      evidence:
        'ACPM sites web grand public : 33e rang, 17,9 M de visites en août 2026 (Huffingtonpost.fr).',
      url: 'https://www.acpm.fr/classements/united-web-sites-gp',
    },
    feedChecks: [
      {
        kind: 'latest',
        url: 'https://www.huffingtonpost.fr/rss/all_headline.xml',
        checkedAt: CHECKED,
        status: 200,
        items: 20,
        covers: '~6 h',
        images: 'all',
        note: 'Unique flux RSS : tous les titres en continu, sans sélection « à la une ».',
      },
    ],
    tdm: {
      reserved: false,
      checkedAt: CHECKED,
      note: 'Pas de tdmrep.json (404).',
    },
  },
  {
    id: 'liberation',
    name: 'Libération',
    leaning: 'gauche',
    paywall: 'partial',
    site: 'https://www.liberation.fr',
    feeds: {
      latest: 'https://www.liberation.fr/arc/outboundfeeds/rss/?outputType=xml',
    },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe Libération ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/liberation',
        takeaway:
          'Score −1,08 dans la bande « gauche » (intervalle −1,60…−0,56) : le classement à gauche est soutenu par les données, 7 familles de preuves sur 9, rang 4 sur 30.',
      },
      {
        title: 'Libération, journal (article encyclopédique)',
        author: 'Wikipédia (avec les ouvrages et articles cités en notes)',
        date: '2026',
        url: 'https://fr.wikipedia.org/wiki/Lib%C3%A9ration_(journal)',
        takeaway:
          '« On est le journal de toutes les gauches. Avec un clivage au sein de la rédaction : les plus jeunes sont plutôt LFI, les anciens sont sociaux-démocrates » (Alexandra Schwartzbrod, directrice adjointe de la rédaction, 2023) ; Serge July : « Sa sensibilité est de gauche » (2019).',
      },
      {
        title: 'Libération (Paris) – Bias and Credibility',
        author: 'Media Bias/Fact Check',
        date: '2026',
        url: 'https://mediabiasfactcheck.com/liberation-paris-bias/',
        takeaway:
          'Noté « Left-Center » sur la base de la sélection de sujets et de positions éditoriales favorisant modérément la gauche ; fiabilité factuelle notée « High ».',
      },
      {
        title: 'Libération : orientation politique, propriétaire et fiabilité',
        author: 'Lucide',
        date: '2026',
        url: 'https://lucideinfo.fr/medias/liberation',
        takeaway:
          'Repère éditorial « Centre-gauche », à partir de la ligne éditoriale observée : le seul désaccord de placement de notre dossier.',
      },
    ],
    leaningNote:
      "Placé à gauche : la bande « gauche » de FrIdéo correspond à notre case Gauche, et la rédaction se définit elle-même comme « le journal de toutes les gauches ». Désaccord documenté : Media Bias/Fact Check le note « Left-Center » et Lucide « Centre-gauche » ; FrIdéo, qui fusionne neuf familles de preuves dont ces notations, le place en bande « gauche » avec un intervalle qui exclut zéro. Les critiques d'Acrimed (« quotidien de Rothschild », célébration du néolibéralisme) contestent la ligne depuis la gauche, ce qui conforte le placement et non l'inverse.",
    readership: {
      evidence:
        'ACPM presse quotidienne nationale 2025/2026 : 5e rang, 119 943 exemplaires France payée ; Liberation.fr : 35e rang des sites, 15,9 M de visites (août 2026).',
      url: 'https://www.acpm.fr/classements/pqn',
    },
    feedChecks: [
      {
        kind: 'latest',
        url: 'https://www.liberation.fr/arc/outboundfeeds/rss/?outputType=xml',
        checkedAt: CHECKED_11,
        status: 200,
        items: 50,
        covers: '~9 h',
        images: 'none',
        note: "Flux officiel de syndication de la plateforme Arc XP, servi sur le domaine de Libération : les flux /rss/ historiques restent bloqués par DataDome (403, vérifié le 2026-10-06, issue #11). 50 articles au plus, fenêtre d'environ 9 h, aucune image.",
      },
    ],
    tdm: {
      reserved: false,
      checkedAt: CHECKED_11,
      note: 'Pas de tdmrep.json (404, la page répond depuis le serveur de Libération malgré DataDome).',
    },
  },
  {
    id: 'mediapart',
    name: 'Mediapart',
    leaning: 'gauche',
    paywall: 'full',
    site: 'https://www.mediapart.fr',
    feeds: { latest: 'https://www.mediapart.fr/articles/feed' },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe Mediapart ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/mediapart',
        takeaway:
          "Score −1,63 dans la bande « extrême gauche » (intervalle −2,19…−1,08), 7 familles de preuves : l'un des deux médias les plus à gauche du panel.",
      },
      {
        title: 'Mediapart (article encyclopédique)',
        author: 'Wikipédia (avec les articles et ouvrages cités en notes)',
        date: '2026',
        url: 'https://fr.wikipedia.org/wiki/Mediapart',
        takeaway:
          "« Le site […] a une ligne éditoriale orientée à gauche » ; Mediapart se présente comme un journal d'enquêtes indépendant.",
      },
    ],
    leaningNote:
      "Placé à gauche : notre échelle n'a pas de case « extrême gauche » (hors périmètre, voir la PRD), la bande « far-left » de FrIdéo est donc rattachée à Gauche.",
    readership: {
      evidence:
        "257 383 abonnés individuels et collectifs au 31 décembre 2025 (+10 % en un an) — pas de diffusion papier certifiée ACPM : l'audience est celle d'un pure player abonné.",
      url: 'https://infographics.mediapart.fr/custom-pages/assets/documents/rapport-activite-2025/Mediapart_2025_en_chiffres.pdf',
    },
    feedChecks: [
      {
        kind: 'latest',
        url: 'https://www.mediapart.fr/articles/feed',
        checkedAt: CHECKED,
        status: 200,
        items: 10,
        covers: '~12 h',
        images: 'all',
      },
    ],
    tdm: {
      reserved: false,
      checkedAt: CHECKED,
      note: 'Pas de tdmrep.json (404).',
    },
  },
  {
    id: 'humanite',
    name: "L'Humanité",
    leaning: 'gauche',
    paywall: 'none',
    site: 'https://www.humanite.fr',
    feeds: { latest: 'https://www.humanite.fr/feed' },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe L'Humanité ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/l-humanite',
        takeaway:
          'Score −2,41, le plus à gauche des 30 médias du panel (intervalle −3,06…−1,76), sur 5 familles de preuves.',
      },
      {
        title: "L'Humanité (article encyclopédique)",
        author: 'Wikipédia (avec les travaux historiques cités en notes)',
        date: '2026',
        url: 'https://fr.wikipedia.org/wiki/L%27Humanit%C3%A9',
        takeaway:
          "Fondé en 1904 par Jean Jaurès, le quotidien est l'« organe central du Parti communiste français » : sa ligne éditoriale suit la ligne du parti.",
      },
    ],
    leaningNote:
      "Placé à gauche : rattachement historique au PCF assumé, et position la plus à gauche de l'échelle FrIdéo. La bande « far-left » est rattachée à Gauche, notre échelle n'ayant pas de case extrême gauche.",
    readership: {
      evidence:
        'ACPM quotidien nationaux 2025/2026 : 7e rang, 40 996 exemplaires France payée ; Humanite.fr : 91e rang des sites, 3,3 M de visites (août 2026). Retenu pour sa signification éditoriale (quotidien historique de la gauche communiste) plus que pour son audience.',
      url: 'https://www.acpm.fr/classements/pqn',
    },
    feedChecks: [
      {
        kind: 'latest',
        url: 'https://www.humanite.fr/feed',
        checkedAt: CHECKED,
        status: 200,
        items: 20,
        covers: '~2 h',
        images: 'all',
        note: 'Flux très fréquent (une vingtaine de publications toutes les 2-3 heures).',
      },
    ],
    tdm: {
      reserved: false,
      checkedAt: CHECKED,
      note: 'Pas de tdmrep.json (404).',
    },
  },

  // ——— Centre ———
  {
    id: 'le-monde',
    name: 'Le Monde',
    leaning: 'centre',
    paywall: 'partial',
    site: 'https://www.lemonde.fr',
    feeds: {
      une: 'https://www.lemonde.fr/rss/une.xml',
      latest: 'https://www.lemonde.fr/rss/en_continu.xml',
    },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe Le Monde ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/le-monde',
        takeaway:
          "Score −0,71 dans la bande « centre gauche » (intervalle −1,23…−0,18), 7 familles de preuves : le seul point de l'échelle qui le place nettement à gauche du centre du panel.",
      },
      {
        title: 'Le Monde – Bias and Credibility',
        author: 'Media Bias/Fact Check',
        date: '2026',
        url: 'https://mediabiasfactcheck.com/le-monde/',
        takeaway:
          'Noté « LEFT-CENTER BIAS » (centre gauche) par Media Bias/Fact Check.',
      },
      {
        title:
          'Le Monde (article encyclopédique, section « Positionnement politique »)',
        author: 'Wikipédia (avec les ouvrages cités en notes, dont Eveno 2001)',
        date: '2026',
        url: 'https://fr.wikipedia.org/wiki/Le_Monde',
        takeaway:
          "Le Monde se veut indépendant des partis ; son histoire est décrite entre engagement à gauche (soutien à l'Union de la gauche dans les années 1970) et revendication d'ouverture à plusieurs courants.",
      },
      {
        title: 'Le Monde : orientation politique, propriétaire et fiabilité',
        author: 'Lucide (observatoire de médias)',
        date: '2026',
        url: 'https://lucideinfo.fr/medias/le-monde',
        takeaway:
          "Repère éditorial : « Centre-gauche » ; propriété : Niel / Pigasse / Křetínský / Fonds pour l'indépendance de la presse.",
      },
    ],
    leaningNote:
      "Placé à Centre, avec désaccord documenté : FrIdéo le range dans « centre gauche » (intervalle excluant zéro) et Media Bias/Fact Check le note « LEFT-CENTER », tandis que le journal se définit comme indépendant et que plusieurs descriptions le tiennent pour centriste. Notre échelle à trois cases (Gauche / Centre / Droite) range la bande « centre gauche » dans Centre : c'est la règle annoncée, pas un jugement sur le journal.",
    readership: {
      evidence:
        '1er quotidien national : ACPM 2025/2026, 564 586 exemplaires France payée ; LeMonde.fr : 7e rang des sites, 95,5 M de visites (août 2026).',
      url: 'https://www.acpm.fr/classements/pqn',
    },
    feedChecks: [
      {
        kind: 'une',
        url: 'https://www.lemonde.fr/rss/une.xml',
        checkedAt: CHECKED,
        status: 200,
        items: 16,
        covers: '~15 h',
        images: 'all',
      },
      {
        kind: 'latest',
        url: 'https://www.lemonde.fr/rss/en_continu.xml',
        checkedAt: CHECKED,
        status: 200,
        items: 60,
        covers: '~27 h',
        images: 'all',
      },
    ],
    tdm: {
      reserved: null,
      checkedAt: CHECKED,
      note: "Indéterminé : lemonde.fr/.well-known/tdmrep.json répond 402 « Accès restreint » ; aucune réservation n'a pu être lue.",
    },
  },
  {
    id: 'marianne',
    name: 'Marianne',
    leaning: 'centre',
    paywall: 'partial',
    site: 'https://www.marianne.net',
    feeds: {
      latest: 'https://www.marianne.net/rss.xml',
    },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe Marianne ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/marianne',
        takeaway:
          "Score −0,65 dans la bande « centre gauche » (intervalle −1,24…−0,06), 6 familles de preuves : l'un des désaccords les plus nets du panel, la propriété le plaçant à droite du centre quand les familles réseau et contenu le placent à gauche.",
      },
      {
        title:
          'La saga de « Marianne », hebdomadaire « anti-pensée unique », ses convulsions et son lent glissement conservateur',
        author: 'Le Monde',
        date: '2024-06-21',
        url: 'https://www.lemonde.fr/economie/article/2024/06/21/la-saga-de-marianne-hebdo-anti-pensee-unique-ses-convulsions-et-son-lent-glissement-conservateur_6242147_3234.html',
        takeaway:
          "Décrit comme un « lent glissement conservateur » : la ligne du magazine a dérivé à droite au fil des changements d'actionnariat et de direction, sans se résoudre à un ancrage net.",
      },
      {
        title: 'Marianne (article encyclopédique)',
        author: 'Wikipédia',
        date: '2026',
        url: 'https://fr.wikipedia.org/wiki/Marianne_(magazine)',
        takeaway:
          "Perçu comme de gauche à sa création (1997), le magazine s'engage au cours des années 2010 vers une ligne éditoriale souverainiste ; diffusion 127 872 exemplaires (2024).",
      },
    ],
    leaningNote:
      "Placé à Centre, avec désaccord documenté : FrIdéo le range dans « centre gauche » (intervalle excluant zéro), mais la propriété (Křetínský) et la période récente sont décrites comme un glissement à droite — Le Monde parle d'un « lent glissement conservateur », Wikipédia d'un engagement souverainiste depuis les années 2010. La mesure agrégée (réseau de liens, contenu lexical 2024-2025) reste à gauche du centre : notre règle place la bande dans Centre, et ce glissement restera à suivre à chaque campagne de mise à jour de la configuration.",
    readership: {
      evidence:
        'ACPM magazines 2025/2026 : 100 527 exemplaires France payée ; marianne.net : 4,8 M de visites par mois.',
      url: 'https://www.acpm.fr/les-membres/support/4028424417-1-1/marianne-1',
    },
    feedChecks: [
      {
        kind: 'latest',
        url: 'https://www.marianne.net/rss.xml',
        checkedAt: '2026-10-07',
        status: 200,
        items: 20,
        covers: '~32 h',
        images: 'all',
        note: "Flux général, toutes rubriques : les rubriques sont tranchées par la classification (#4), pas par le choix du flux. Fragile aux robots : `marianne.net/rss` répond 403 (page HTML de blocage) sans en-têtes de navigateur complets, puis 301 vers rss.xml — à surveiller à chaque vérification. Depuis le 2026-10-08 (issue #35) : l'arête AWS WAF de marianne.net répond 405 (`x-amzn-waf-action: captcha`) aux adresses IP des runners GitHub, quel que soit le User-Agent ou les en-têtes — le flux contribue zéro article aux éditions construites en CI, alors qu'il répond 200 localement. Vérifié depuis un runner (probe curl + Node fetch, run 37777088410).",
      },
    ],
    tdm: {
      reserved: true,
      checkedAt: '2026-10-07',
      note: 'Réservation publiée (`tdm-reservation: 1` pour /) avec une politique `https://www.marianne.net/tdm-policy.json`.',
    },
  },
  {
    id: 'franceinfo',
    name: 'franceinfo',
    leaning: 'centre',
    paywall: 'none',
    site: 'https://www.francetvinfo.fr',
    feeds: { latest: 'https://www.francetvinfo.fr/titres.rss' },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe Franceinfo ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/franceinfo',
        takeaway:
          "Score −0,41, bande « centre gauche » mais intervalle −0,93…+0,11 contenant zéro : le média le mieux couvert du panel (8 familles) n'en est pas moins non résolu.",
      },
      {
        title: 'France Info (offre globale) (article encyclopédique)',
        author: 'Wikipédia',
        date: '2026',
        url: 'https://fr.wikipedia.org/wiki/France_Info_(offre_globale)',
        takeaway:
          "France Info est l'offre d'information publique portée par France Télévisions et Radio France, dont les conventions imposent indépendance, exactitude et pluralisme.",
      },
    ],
    leaningNote:
      "Placé à Centre : média de service public, dont la mission est l'information pluraliste ; FrIdéo le situe dans « centre gauche » mais sans départage (l'intervalle contient zéro). Nous retenons Centre, conformément à la règle de placement.",
    readership: {
      evidence:
        '3e rang des sites web ACPM (grand public), 136,5 M de visites en août 2026 (Franceinfo.fr).',
      url: 'https://www.acpm.fr/classements/united-web-sites-gp',
    },
    feedChecks: [
      {
        kind: 'latest',
        url: 'https://www.francetvinfo.fr/titres.rss',
        checkedAt: CHECKED,
        status: 200,
        items: 33,
        covers: '~24 h',
        images: 'all',
      },
    ],
    tdm: {
      reserved: true,
      checkedAt: CHECKED,
      note: 'Réservation publiée (tdm-reservation: 1, tdm-policy sur franceinfo.fr).',
    },
  },
  {
    id: 'ouest-france',
    name: 'Ouest-France',
    leaning: 'centre',
    paywall: 'partial',
    site: 'https://www.ouest-france.fr',
    feeds: {
      une: 'https://www.ouest-france.fr/rss/une',
      latest: 'https://www.ouest-france.fr/rss-en-continu.xml',
    },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe Ouest-France ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/ouest-france',
        takeaway:
          'Score −0,16, bande « centre » (intervalle −0,81…+0,49) : au milieu du panel, sans orientation résolue.',
      },
      {
        title: 'Ouest-France (article encyclopédique)',
        author: 'Wikipédia (avec les fiches ACPM citées en notes)',
        date: '2026',
        url: 'https://fr.wikipedia.org/wiki/Ouest-France',
        takeaway:
          "Positionnement politique indiqué dans l'article : « Centre-droit, Démocratie chrétienne » ; premier quotidien payant français en diffusion depuis 1975.",
      },
    ],
    leaningNote:
      'Placé à Centre, avec désaccord documenté : Wikipédia le décrit « centre-droit, démocratie chrétienne », là où FrIdéo ne le départage pas du centre. La démocratie chrétienne se lit des deux côtés du centre ; nous retenons Centre.',
    readership: {
      evidence:
        '1er quotidien français toute catégorie : ACPM presse quotidienne régionale 2025/2026, 580 981 exemplaires France payée (rang 1) ; ouest-france.fr : 1er rang des sites, 185,5 M de visites (août 2026).',
      url: 'https://www.acpm.fr/classements/pqr',
    },
    feedChecks: [
      {
        kind: 'une',
        url: 'https://www.ouest-france.fr/rss/une',
        checkedAt: CHECKED,
        status: 200,
        items: 10,
        covers: '~30 min',
        images: 'all',
      },
      {
        kind: 'latest',
        url: 'https://www.ouest-france.fr/rss-en-continu.xml',
        checkedAt: CHECKED,
        status: 200,
        items: 10,
        covers: '~30 min',
        images: 'all',
        note: 'Sert exactement les mêmes 10 articles que le flux « une » (vérifié le 2026-10-06).',
      },
    ],
    tdm: {
      reserved: true,
      checkedAt: CHECKED,
      note: 'Réservation publiée pour « / » (tdm-reservation: 1) ; « /shopping/ » et « /tourisme/ » ne sont pas réservés.',
    },
  },
  {
    id: 'bfmtv',
    name: 'BFMTV',
    leaning: 'centre',
    paywall: 'none',
    site: 'https://www.bfmtv.com',
    feeds: { latest: 'https://www.bfmtv.com/rss/news-24-7/' },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe BFMTV ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/bfmtv',
        takeaway:
          'Score +0,07, bande « centre » (intervalle −0,55…+0,69) : strictement au milieu du panel, sans orientation résolue.',
      },
      {
        title: 'Les 50 engagements de BFMTV (charte de déontologie)',
        author: 'BFMTV (groupe RMC-BFM)',
        date: '2024',
        url: 'https://www.bfmtv.com/static/nxt-bfmtv/pdf/charte-deontologie-bfmtv.pdf',
        takeaway:
          "« BFMTV s'engage à garantir le pluralisme et à diffuser une information exacte et conforme à la réalité, qui proscrit toute présentation partiale des faits » (engagements 29-30).",
      },
      {
        title: "BFM-TV (dossier d'analyse)",
        author: 'Acrimed (observatoire des médias)',
        date: '2020',
        url: 'https://www.acrimed.org/+-BFM-TV-+',
        takeaway:
          'Acrimed décrit au contraire une chaîne qui « met la barre (très) à droite » sur certains choix éditoriaux (« Après Conflans, toujours moins de pluralisme sur BFM-TV », déc. 2020).',
      },
    ],
    leaningNote:
      'Placé à Centre, avec désaccord documenté : la charte de la chaîne revendique impartialité et neutralité, Acrimed documente des biais à droite, FrIdéo situe BFMTV au milieu du panel (avec des signaux contradictoires selon les familles de preuves). Nous retenons Centre, qui est aussi la position la plus fréquemment attribuée au média.',
    readership: {
      evidence:
        "5e rang des sites web ACPM (grand public), 118,7 M de visites en août 2026 (Bfmtv.com) ; première chaîne d'information en continu française par son audience web.",
      url: 'https://www.acpm.fr/classements/united-web-sites-gp',
    },
    feedChecks: [
      {
        kind: 'latest',
        url: 'https://www.bfmtv.com/rss/news-24-7/',
        checkedAt: CHECKED,
        status: 200,
        items: 30,
        covers: '~13 h',
        images: 'all',
      },
    ],
    tdm: {
      reserved: null,
      checkedAt: CHECKED,
      note: 'Indéterminé : la sonde sur bfmtv.com est bloquée par un pare-feu (403).',
    },
  },
  {
    id: '20-minutes',
    name: '20 Minutes',
    leaning: 'centre',
    paywall: 'none',
    site: 'https://www.20minutes.fr',
    feeds: { une: 'https://www.20minutes.fr/feeds/rss-une.xml' },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe 20 Minutes ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/20-minutes',
        takeaway:
          'Score −0,31, bande « centre gauche » mais intervalle −0,82…+0,19 contenant zéro : non résolu.',
      },
      {
        title: 'La charte de « 20 Minutes »',
        author: '20 Minutes',
        date: '2026',
        url: 'https://www.20minutes.fr/charte-20minutes',
        takeaway:
          "« L'indépendance et la neutralité politiques et religieuses sont dans les fondements même de la pratique éditoriale de 20 Minutes » (charte du média, actionnaires Sipa Ouest-France et Groupe Rossel).",
      },
      {
        title: '20 Minutes – Bias and Credibility',
        author: 'Media Bias/Fact Check',
        date: '2026',
        url: 'https://mediabiasfactcheck.com/20-minutes/',
        takeaway:
          'Noté « LEFT-CENTER BIAS » (centre gauche) par Media Bias/Fact Check.',
      },
    ],
    leaningNote:
      'Placé à Centre, avec désaccord documenté : la charte revendique la neutralité, Media Bias/Fact Check note « LEFT-CENTER », FrIdéo « centre gauche » sans départage. La bande « centre gauche » étant rattachée à Centre dans notre échelle, nous retenons Centre.',
    readership: {
      evidence:
        '8e rang des sites web ACPM (grand public), 90,3 M de visites en août 2026 (20minutes.fr). Presse gratuite : pas de diffusion payée certifiée ACPM.',
      url: 'https://www.acpm.fr/classements/united-web-sites-gp',
    },
    feedChecks: [
      {
        kind: 'une',
        url: 'https://www.20minutes.fr/feeds/rss-une.xml',
        checkedAt: CHECKED,
        status: 200,
        items: 30,
        covers: '~6 jours',
        images: 'all',
        note: 'Le flux « une » accumule les choix de la journée sur plusieurs jours : il sert de front page par défaut. Pas de flux « latest » : les autres URL /feeds/* répondent 403 (vérifié le 2026-10-06).',
      },
    ],
    tdm: {
      reserved: false,
      checkedAt: CHECKED,
      note: 'Pas de tdmrep.json (404).',
    },
  },
  {
    id: 'le-parisien',
    name: 'Le Parisien',
    leaning: 'centre',
    paywall: 'partial',
    site: 'https://www.leparisien.fr',
    feeds: { latest: 'https://feeds.leparisien.fr/leparisien/rss' },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe Le Parisien ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/le-parisien',
        takeaway:
          "Score +0,10, bande « centre » (intervalle −0,40…+0,61) : non résolu ; FrIdéo précise que Le Parisien et BFMTV ne sont pas départagés par l'échelle.",
      },
      {
        title: 'Le Parisien – Bias and Credibility',
        author: 'Media Bias/Fact Check',
        date: '2026',
        url: 'https://mediabiasfactcheck.com/le-parisien/',
        takeaway:
          'Noté « RIGHT-CENTER BIAS » (centre droit) par Media Bias/Fact Check.',
      },
      {
        title: 'Le Parisien (article encyclopédique)',
        author: 'Wikipédia (avec les chiffres ACPM cités en notes)',
        date: '2026',
        url: 'https://fr.wikipedia.org/wiki/Le_Parisien',
        takeaway:
          "« La ligne éditoriale est généraliste, s'intéressant particulièrement aux faits divers et à l'actualité locale » ; détenu par Bernard Arnault (LVMH) depuis 2015.",
      },
    ],
    leaningNote:
      'Placé à Centre, avec désaccord documenté : Media Bias/Fact Check le note « centre droit » quand FrIdéo ne le départage pas du centre et que le journal se définit comme généraliste. À surveiller : Wikipédia mentionne des tractations entre Bernard Arnault et Vincent Bolloré fin 2025 pour la vente du titre.',
    readership: {
      evidence:
        "ACPM 2025/2026 : 196 365 exemplaires France payée (2e rang presse quotidienne régionale ; 261 437 avec le couplage « Le Parisien + Aujourd'hui en France ») ; LeParisien.fr : 12e rang des sites, 61,9 M de visites (août 2026).",
      url: 'https://www.acpm.fr/classements/pqr',
    },
    feedChecks: [
      {
        kind: 'latest',
        url: 'https://feeds.leparisien.fr/leparisien/rss',
        checkedAt: CHECKED,
        status: 200,
        items: 100,
        covers: '',
        images: 'none',
        note: "Flux minimal : titre et lien uniquement, aucune image. Date de publication lue depuis le slug de l'URL (JJ-MM-AAAA, ~96 % des items ; ADR-0007) ; les rares items sans date dans l'URL sont datés à la collecte tant que le flux est à jour. Sans image ni chapô : couverture sans photo, classification sur le titre seul. L'ancien flux « en-continu » répond 200 avec 0 article, et « rss/une » sert des archives de 2019.",
      },
    ],
    tdm: {
      reserved: true,
      checkedAt: CHECKED,
      note: 'Réservation publiée (tdm-reservation: 1) avec une politique par agent (GPTBot, ClaudeBot…).',
    },
  },
  {
    id: 'tf1-info',
    name: 'TF1 Info',
    leaning: 'centre',
    paywall: 'none',
    site: 'https://www.tf1info.fr',
    feeds: { latest: 'https://www.tf1info.fr/feeds/rss-une.xml' },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe TF1 INFO ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/tf1-info',
        takeaway:
          'Score +0,36, bande « centre droit » mais intervalle −0,31…+1,03 contenant zéro : non résolu, alors que la famille « orientation perçue en enquêtes » le place nettement à droite (+1,30).',
      },
      {
        title: 'LCI / TF1 Info (article encyclopédique)',
        author: 'Wikipédia',
        date: '2026',
        url: 'https://fr.wikipedia.org/wiki/LCI',
        takeaway:
          "Chaîne d'information du Groupe TF1 (privé, groupe Bouygues), devenue la marque d'information « TF1 Info » ; aucune ligne partisane n'y est revendiquée.",
      },
    ],
    leaningNote:
      "Placé à Centre, avec désaccord documenté : les enquêtes d'audience perçoivent TF1 Info à droite (+1,30 sur cette famille FrIdéo), mais les autres familles de preuves le placent au centre et l'intervalle global contient zéro. Nous retenons Centre, faute de départage.",
    readership: {
      evidence:
        "Absente du classement ACPM des sites ; retenue comme marque d'information de la première chaîne de télévision privée française (Groupe TF1), audience mesurée par Médiamétrie plutôt que par l'ACPM.",
    },
    feedChecks: [
      {
        kind: 'latest',
        url: 'https://www.tf1info.fr/feeds/rss-une.xml',
        checkedAt: CHECKED,
        status: 200,
        items: 100,
        covers: '~3 jours',
        images: 'all',
        note: 'Malgré son nom, ce flux est un feu complet (JT, émissions, recettes, météo) : traité en flux « latest », 10 articles récents pour la front page.',
      },
    ],
    tdm: {
      reserved: true,
      checkedAt: CHECKED,
      note: 'Réservation publiée (tdm-reservation: 1, tdm-policy sur tf1info.fr).',
    },
  },
  {
    id: 'rfi',
    name: 'RFI',
    leaning: 'centre',
    paywall: 'none',
    site: 'https://www.rfi.fr',
    feeds: { latest: 'https://www.rfi.fr/fr/rss' },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe RFI ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/rfi',
        takeaway:
          'Score −0,11, bande « centre » (intervalle −0,61…+0,40) : au milieu du panel, sans orientation résolue.',
      },
      {
        title: 'Nos engagements — Déontologie',
        author: 'France Médias Monde (société mère de RFI et France 24)',
        date: '2026',
        url: 'https://www.francemediasmonde.com/fr/nos-engagements',
        takeaway:
          "« RFI, France 24 et MCD portent un engagement commun : apporter une information libre, indépendante, experte, équilibrée et pluraliste », encadré par une charte d'éthique et de déontologie.",
      },
      {
        title: 'Radio France internationale (article encyclopédique)',
        author: 'Wikipédia',
        date: '2026',
        url: 'https://fr.wikipedia.org/wiki/Radio_France_internationale',
        takeaway:
          "Radio publique française d'information internationale, éditée par France Médias Monde, société de l'audiovisuel extérieur de l'État.",
      },
    ],
    leaningNote:
      "Placé à Centre : média public international, tenu par sa charte à l'équilibre et au pluralisme ; FrIdéo ne le départage pas du centre.",
    readership: {
      evidence:
        '38e rang des sites web ACPM, 13,6 M de visites en août 2026 (Rfi.fr) ; audience mondiale (132 relais FM/DAB+, 1 950 radios partenaires selon France Médias Monde).',
      url: 'https://www.acpm.fr/classements/united-web-sites-gp',
    },
    feedChecks: [
      {
        kind: 'latest',
        url: 'https://www.rfi.fr/fr/rss',
        checkedAt: CHECKED,
        status: 200,
        items: 23,
        covers: '~14 h',
        images: 'all',
      },
    ],
    tdm: {
      reserved: true,
      checkedAt: CHECKED,
      note: 'Réservation publiée (tdm-reservation: 1) ; une sonde de contrôle peut être filtrée par le pare-feu du site (403 observé une fois).',
    },
  },
  {
    id: 'france-24',
    name: 'France 24',
    leaning: 'centre',
    paywall: 'none',
    site: 'https://www.france24.com',
    feeds: { latest: 'https://www.france24.com/fr/rss' },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe France 24 ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/france-24',
        takeaway:
          'Score −0,03, bande « centre » (intervalle −0,53…+0,48) : le média le plus proche du centre du panel.',
      },
      {
        title: 'Nos engagements — Déontologie',
        author: 'France Médias Monde (société mère de RFI et France 24)',
        date: '2026',
        url: 'https://www.francemediasmonde.com/fr/nos-engagements',
        takeaway:
          '« RFI, France 24 et MCD portent un engagement commun : apporter une information libre, indépendante, experte, équilibrée et pluraliste ».',
      },
      {
        title: 'France 24 (article encyclopédique)',
        author: 'Wikipédia',
        date: '2026',
        url: 'https://fr.wikipedia.org/wiki/France_24',
        takeaway:
          "Quatre chaînes d'information continue du service public audiovisuel extérieur français (France Médias Monde), diffusées dans 577 millions de foyers.",
      },
    ],
    leaningNote:
      'Placé à Centre : média public international, tenu par la charte de France Médias Monde ; FrIdéo le situe au centre exact du panel.',
    readership: {
      evidence:
        '48e rang des sites web ACPM, 9,5 M de visites en août 2026 (France24.com) ; diffusion mondiale dans 577 millions de foyers (France Médias Monde).',
      url: 'https://www.acpm.fr/classements/united-web-sites-gp',
    },
    feedChecks: [
      {
        kind: 'latest',
        url: 'https://www.france24.com/fr/rss',
        checkedAt: CHECKED,
        status: 200,
        items: 24,
        covers: '~4 h',
        images: 'some',
      },
    ],
    tdm: {
      reserved: true,
      checkedAt: CHECKED,
      note: 'Réservation publiée (tdm-reservation: 1) ; une sonde de contrôle peut être filtrée par le pare-feu du site (403 observé une fois).',
    },
  },
  {
    id: 'courrier-international',
    name: 'Courrier international',
    leaning: 'centre',
    paywall: 'partial',
    site: 'https://www.courrierinternational.com',
    feeds: { latest: 'https://www.courrierinternational.com/feed/all/rss.xml' },
    leaningSources: [
      {
        title: 'Courrier international (article encyclopédique)',
        author: 'Wikipédia (avec les chiffres ACPM cités en notes)',
        date: '2026',
        url: 'https://fr.wikipedia.org/wiki/Courrier_international',
        takeaway:
          "« Sa ligne éditoriale social-démocrate vise à offrir un regard étranger sur l'actualité » ; hebdomadaire du groupe Le Monde, diffusion 161 069 exemplaires (2021).",
      },
      {
        title: 'Courrier International — profil de média',
        author: 'eurotopics (Bertelsmann Stiftung)',
        date: '2026',
        url: 'https://www.eurotopics.net/fr/148466/courrier-international',
        takeaway:
          'Orientation politique indiquée : « libéral » ; diffusion 159 000 exemplaires (2022), modèle « articles en partie payants ».',
      },
      {
        title:
          'Courrier International : orientation politique, propriétaire et fiabilité',
        author: 'Lucide (observatoire de médias)',
        date: '2026',
        url: 'https://lucideinfo.fr/medias/courrier-international',
        takeaway:
          "Repère éditorial : « Centre-gauche » ; propriété : Fonds pour l'indépendance de la presse → groupe Le Monde.",
      },
    ],
    leaningNote:
      "Placé à Centre, avec désaccord documenté : « social-démocrate » (Wikipédia), « libéral » (eurotopics), « centre-gauche » (Lucide). Courrier international n'est pas couvert par FrIdéo ; aucune de ces descriptions ne le place dans la moitié « gauche » de notre échelle à trois cases, et le titre se définit par son ouverture internationale plutôt que par un positionnement partisan. Nous retenons Centre.",
    readership: {
      evidence:
        'ACPM presse magazine 2025/2026 : 39e rang, 162 073 exemplaires France payée ; CourrierInternational.com : 56e rang des sites, 7,9 M de visites (août 2026).',
      url: 'https://www.acpm.fr/classements/pmag',
    },
    feedChecks: [
      {
        kind: 'latest',
        url: 'https://www.courrierinternational.com/feed/all/rss.xml',
        checkedAt: CHECKED,
        status: 200,
        items: 20,
        covers: '~6 h',
        images: 'all',
      },
    ],
    tdm: {
      reserved: false,
      checkedAt: CHECKED,
      note: 'Pas de tdmrep.json (404).',
    },
  },
  {
    id: 'lexpress',
    name: "L'Express",
    leaning: 'centre',
    paywall: 'partial',
    site: 'https://www.lexpress.fr',
    feeds: { latest: 'https://www.lexpress.fr/rss/alaune.xml' },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe L'Express ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/l-express',
        takeaway:
          'Score +0,18, bande « centre » (intervalle −0,43…+0,78) : non résolu, 6 familles de preuves.',
      },
      {
        title:
          "L'Express (article encyclopédique, section « Ligne éditoriale »)",
        author: 'Wikipédia (avec les ouvrages et articles cités en notes)',
        date: '2026',
        url: 'https://fr.wikipedia.org/wiki/L%27Express',
        takeaway:
          'Hebdomadaire fondé en 1953, historiquement classé du centre gauche (mendésiste, social-libéral) au centre droit selon les époques et les directions.',
      },
    ],
    leaningNote:
      "Placé à Centre, avec désaccord documenté : les descriptions historiques vont du « centre gauche » mendésiste des origines au « centre droit » libéral des dernières décennies. FrIdéo ne le départage pas du centre aujourd'hui. Nous retenons Centre, en signalant que c'est l'un des médias les plus discutés de ce classement.",
    readership: {
      evidence:
        'ACPM presse magazine 2025/2026 : 54e rang, 118 937 exemplaires France payée ; Lexpress.fr : 62e rang des sites, 6,7 M de visites (août 2026).',
      url: 'https://www.acpm.fr/classements/pmag',
    },
    feedChecks: [
      {
        kind: 'latest',
        url: 'https://www.lexpress.fr/rss/alaune.xml',
        checkedAt: CHECKED,
        status: 200,
        items: 100,
        covers: '~5,5 jours',
        images: 'all',
        note: 'Flux « à la une » volumineux (100 articles) : traité en flux « latest », 10 articles récents pour la front page.',
      },
    ],
    tdm: {
      reserved: false,
      checkedAt: CHECKED,
      note: 'Pas de tdmrep.json (404).',
    },
  },
  {
    id: 'la-croix',
    name: 'La Croix',
    leaning: 'centre',
    paywall: 'partial',
    site: 'https://www.la-croix.com',
    feeds: { latest: 'https://www.la-croix.com/rss' },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe La Croix ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/la-croix',
        takeaway:
          'Score +0,13, bande « centre » (intervalle −0,52…+0,77) : non résolu ; FrIdéo note que la « tradition catholique » du titre le range au centre droit pour les sources de tradition, au centre pour les preuves directes.',
      },
      {
        title: 'La Croix : orientation politique, propriétaire et fiabilité',
        author: 'Lucide (observatoire de médias)',
        date: '2026-08-12',
        url: 'https://lucideinfo.fr/medias/la-croix',
        takeaway:
          'Repère éditorial : « Centre-droit » ; propriété : groupe Bayard (association des Assomptionnistes), qui publie aussi sa charte éditoriale.',
      },
      {
        title: 'La Croix (article encyclopédique)',
        author: 'Wikipédia (avec les chiffres ACPM cités en notes)',
        date: '2026',
        url: 'https://fr.wikipedia.org/wiki/La_Croix',
        takeaway:
          "Quotidien catholique d'information politique et générale, édité par le groupe Bayard depuis sa fondation en 1883 ; diffusion 91 762 exemplaires (2022).",
      },
    ],
    leaningNote:
      "Placé à Centre, avec désaccord documenté : Lucide le dit « centre-droit », FrIdéo non résolu, et l'héritage chrétien-démocrate peut se lire de part et d'autre du centre. Nous retenons Centre, en cohérence avec la bande « centre » de FrIdéo.",
    readership: {
      evidence:
        'ACPM quotidien nationaux 2025/2026 : 6e rang, 73 595 exemplaires France payée ; La-croix.com : 86e rang des sites, 3,5 M de visites (août 2026).',
      url: 'https://www.acpm.fr/classements/pqn',
    },
    feedChecks: [
      {
        kind: 'latest',
        url: 'https://www.la-croix.com/rss',
        checkedAt: CHECKED,
        status: 200,
        items: 50,
        covers: '~25 h',
        images: 'all',
        note: 'Flux général, toutes rubriques (religion et culture comprises) : les rubriques sont tranchées par la classification (#4), pas par le choix du flux. Le flux /rss/france (actualité nationale) existe si un périmètre restreint devenait souhaitable.',
      },
    ],
    tdm: {
      reserved: false,
      checkedAt: CHECKED,
      note: 'Pas de tdmrep.json (404).',
    },
  },
  {
    id: 'le-point',
    name: 'Le Point',
    leaning: 'centre',
    paywall: 'partial',
    site: 'https://www.lepoint.fr',
    feeds: {
      latest: 'https://www.lepoint.fr/arc/outboundfeeds/rss/?outputType=xml',
    },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe Le Point ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/le-point',
        takeaway:
          'Score +0,56, bande « centre droit » (intervalle −0,09…+1,22) qui contient zéro : placement non résolu par les données seules ; 5 familles de preuves sur 9, propriétaire final François Pinault (Artémis).',
      },
      {
        title: 'Le Point – Bias and Credibility',
        author: 'Media Bias/Fact Check',
        date: '2024-11-09',
        url: 'https://mediabiasfactcheck.com/le-point-bias/',
        takeaway:
          'Noté "Right-Center" sur la base de la sélection de sujets et de positions éditoriales favorisant modérément la droite, tout en présentant des points de vue divers ; fiabilité factuelle notée "High".',
      },
      {
        title: 'Le Point : orientation politique, propriétaire et fiabilité',
        author: 'Lucide (observatoire de médias)',
        date: '2026-08-13',
        url: 'https://lucideinfo.fr/medias/le-point',
        takeaway:
          'Repère éditorial « Centre-droit » ; ligne libérale-conservatrice ; propriété : François-Henri Pinault (Kering, luxe).',
      },
    ],
    leaningNote:
      "Placé à Centre, en cohérence avec la bande « centre droit » de FrIdéo. Désaccord à noter : l'intervalle de FrIdéo contient zéro, donc les données seules ne départagent pas le centre — le placement suit la convention décrite dans les limites connues. Les notations tierces concordent sur l'ancrage centre-droit (Media Bias/Fact Check « Right-Center », Lucide « Centre-droit ») et aucune source consultée ne le place à gauche ; l'héritage libéral-conservateur du titre (fondé en 1972 par des journalistes de L'Express) borne le placement sans le pousser à Droite, où FrIdéo le distingue nettement de Le Figaro (+0,56 contre +1,02).",
    readership: {
      evidence:
        'ACPM presse magazine 2025/2026 : 20e rang, 263 528 exemplaires France payée (hebdomadaire, DSH).',
      url: 'https://www.acpm.fr/classements/pmag',
    },
    feedChecks: [
      {
        kind: 'latest',
        url: 'https://www.lepoint.fr/arc/outboundfeeds/rss/?outputType=xml',
        checkedAt: CHECKED_LE_POINT,
        status: 200,
        items: 100,
        covers: '~2 j',
        images: 'all',
        note: 'Endpoint de syndication Arc XP, non documenté publiquement par Le Point (même mécanisme que Libération, issue #11) : 100 articles au plus (~2 j de couverture), tous avec image. Les pages du site restent bloquées par un anti-bot (403) mais pas cet endpoint ; il pourrait être restreint ou supprimé sans préavis.',
      },
    ],
    tdm: {
      reserved: null,
      checkedAt: CHECKED_LE_POINT,
      note: 'Indéterminé : la sonde sur lepoint.fr est bloquée par un anti-bot (403), le flux de syndication seul répond.',
    },
  },

  // ——— Droite ———
  {
    id: 'le-figaro',
    name: 'Le Figaro',
    leaning: 'droite',
    paywall: 'partial',
    site: 'https://www.lefigaro.fr',
    feeds: {
      une: 'https://www.lefigaro.fr/rss/figaro_actualites.xml',
      latest: 'https://www.lefigaro.fr/rss/figaro_flash-actu.xml',
    },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe Le Figaro ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/le-figaro',
        takeaway:
          'Score +1,02 dans la bande « droite » (intervalle +0,50…+1,55), 7 familles de preuves : le classement à droite est soutenu par les données.',
      },
      {
        title:
          'Le Figaro (article encyclopédique, section « Ligne éditoriale »)',
        author: 'Wikipédia (avec les articles de presse cités en notes)',
        date: '2026',
        url: 'https://fr.wikipedia.org/wiki/Le_Figaro',
        takeaway:
          "« Le Figaro, d'après son directeur, se considère comme un journal de droite et de centre droit » ; sa ligne est issue des familles gaulliste, libérale et conservatrice.",
      },
      {
        title:
          'La rédaction du Figaro demande à sa direction de clarifier le positionnement politique',
        author: "Ouest-France (reprise d'AFP)",
        date: '2024-07-02',
        url: 'https://www.ouest-france.fr/medias/la-redaction-du-figaro-demande-a-sa-direction-de-clarifier-le-positionnement-politique-52ca739e-f75e-4e50-874c-da12028d7ab4',
        takeaway:
          'Une centaine de journalistes du Figaro ont écrit à leur direction après un éditorial jugé favorable au RN, pour demander des clarifications sur le positionnement du journal (juillet 2024).',
      },
      {
        title: 'Le Figaro – Bias and Credibility',
        author: 'Media Bias/Fact Check',
        date: '2026',
        url: 'https://mediabiasfactcheck.com/le-figaro/',
        takeaway:
          'Noté « RIGHT-CENTER BIAS » (centre droit) par Media Bias/Fact Check, quand FrIdéo le range dans la bande « droite ».',
      },
    ],
    leaningNote:
      "Placé à Droite : le journal se définit « de droite et de centre droit » et FrIdéo le range dans la bande « droite » (intervalle excluant zéro). Désaccord documenté : Media Bias/Fact Check le note « RIGHT-CENTER » (centre droit) et des articles documentent un rapprochement avec l'extrême droite sous la direction d'Alexis Brézet (Wikipédia, 2021-2024).",
    readership: {
      evidence:
        'ACPM quotidien nationaux 2025/2026 : 2e rang, 397 194 exemplaires France payée ; LeFigaro.fr : 4e rang des sites, 125,9 M de visites (août 2026).',
      url: 'https://www.acpm.fr/classements/pqn',
    },
    feedChecks: [
      {
        kind: 'une',
        url: 'https://www.lefigaro.fr/rss/figaro_actualites.xml',
        checkedAt: CHECKED,
        status: 200,
        items: 19,
        covers: '~9 h',
        images: 'some',
      },
      {
        kind: 'latest',
        url: 'https://www.lefigaro.fr/rss/figaro_flash-actu.xml',
        checkedAt: CHECKED,
        status: 200,
        items: 20,
        covers: '~3 h',
        images: 'some',
      },
    ],
    tdm: {
      reserved: true,
      checkedAt: CHECKED,
      note: 'Réservation publiée (tdm-reservation: 1).',
    },
  },
  {
    id: 'cnews',
    name: 'CNews',
    leaning: 'droite',
    paywall: 'none',
    site: 'https://www.cnews.fr',
    feeds: { latest: 'https://www.cnews.fr/rss.xml' },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe CNews ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/cnews',
        takeaway:
          'Score +0,96 dans la bande « droite » (intervalle +0,28…+1,64) : statistiquement indistinguable du Figaro sur cette échelle.',
      },
      {
        title:
          "Pluralisme des courants de pensée et d'opinion : mise en demeure de CNews",
        author:
          'Arcom (autorité de régulation de la communication audiovisuelle et numérique)',
        date: '2026-06',
        url: 'https://www.arcom.fr/presse/pluralisme-des-courants-de-pensee-et-dopinion-mise-en-demeure-de-cnews',
        takeaway:
          "L'Arcom a mis en demeure CNews de se conformer à l'exigence d'expression pluraliste des courants de pensée et d'opinion, constatant un « déséquilibre manifeste et durable » dans ses débats.",
      },
      {
        title: 'CNews (article encyclopédique, section « Ligne éditoriale »)',
        author: 'Wikipédia (avec les rapports RSF et articles cités en notes)',
        date: '2026',
        url: 'https://fr.wikipedia.org/wiki/CNews',
        takeaway:
          "Ligne éditoriale « très ancrée à droite et conservatrice, avec une orientation marquée de plus en plus à l'extrême droite » ; un rapport de RSF (nov. 2025) a analysé les temps d'antenne de la chaîne.",
      },
    ],
    leaningNote:
      "Placé à Droite : FrIdéo bande « droite » (intervalle excluant zéro), mise en demeure de l'Arcom pour défaut de pluralisme, description encyclopédique d'une ligne conservatrice. Désaccord documenté : une partie des sources parle d'« extrême droite » quand l'Arcom refuse cette qualification ; notre échelle n'a pas de case extrême droite (hors périmètre, voir la PRD), nous retenons donc Droite.",
    readership: {
      evidence:
        "22e rang des sites web ACPM, 30,2 M de visites en août 2026 (Cnews.fr) ; chaîne d'information en continu du groupe Canal+ (Vincent Bolloré).",
      url: 'https://www.acpm.fr/classements/united-web-sites-gp',
    },
    feedChecks: [
      {
        kind: 'latest',
        url: 'https://www.cnews.fr/rss.xml',
        checkedAt: CHECKED,
        status: 200,
        items: 100,
        covers: '~28 h',
        images: 'all',
      },
    ],
    tdm: {
      reserved: false,
      checkedAt: CHECKED,
      note: 'Pas de tdmrep.json (404).',
    },
  },
  {
    id: 'europe-1',
    name: 'Europe 1',
    leaning: 'droite',
    paywall: 'none',
    site: 'https://www.europe1.fr',
    feeds: { latest: 'https://www.europe1.fr/rss.xml' },
    leaningSources: [
      {
        title: 'Europe 1, des yéyés à la droite conservatrice',
        author: 'Le Monde, rubrique Médias',
        date: '2021-07-28',
        url: 'https://www.lemonde.fr/actualite-medias/article/2021/07/28/europe-1-des-yeyes-a-la-droite-conservatrice_6089737_3236.html',
        takeaway:
          "Après le rachat de Lagardère par Vincent Bolloré, Le Monde décrit le virage d'Europe 1 vers une droite conservatrice, marquée par les éditorialistes et les rendez-vous partagés avec CNews.",
      },
      {
        title:
          "À Europe 1, le virage à droite toute met à l'épreuve les salariés",
        author: 'Télérama',
        date: '2024',
        url: 'https://www.telerama.fr/radio/a-europe-1-le-virage-a-droite-toute-met-a-l-epreuve-les-salaries-7021993.php',
        takeaway:
          "Télérama documente le « fléchissement réactionnaire » de la station (arrivée de Cyril Hanouna, figures de CNews) et les tensions internes qu'il provoque.",
      },
      {
        title:
          'Europe 1 (article encyclopédique, section « Ligne éditoriale »)',
        author: 'Wikipédia (avec les articles de presse cités en notes)',
        date: '2026',
        url: 'https://fr.wikipedia.org/wiki/Europe_1',
        takeaway:
          "« À partir de 2021 […] l'influence [de Vincent Bolloré] sur la ligne éditoriale est jugée grandissante, traduisant un virage éditorial à droite, voire à l'extrême droite ».",
      },
      {
        title:
          "« Pas de volonté idéologique » : Arnaud Lagardère se défend du changement de ligne éditoriale d'Europe 1",
        author: 'Puremédias',
        date: '2025',
        url: 'https://www.ozap.com/actu/pas-de-volonte-ideologique-arnaud-lagardere-se-defend-du-changement-de-ligne-editoriale-d-europe-1/649742',
        takeaway:
          "La direction conteste toute « volonté idéologique » et défend la ligne par ses audiences (2,65 millions d'auditeurs par jour) : c'est le point de vue opposé à celui de la presse spécialisée.",
      },
    ],
    leaningNote:
      "Placé à Droite pour la station actuelle (post-2021), avec désaccord documenté : Arnaud Lagardère dément toute « volonté idéologique » et la station défend son virage par ses audiences (Puremédias, 2025) ; la presse spécialisée et Wikipédia documentent ce virage. Europe 1 n'est pas couvert par FrIdéo. Avant 2021, la station était classée au centre : le classement vaut pour la ligne actuelle.",
    readership: {
      evidence:
        "75e rang des sites web ACPM, 4,7 M de visites en août 2026 (Europe1.fr) ; radio généraliste écoutée par 2,65 millions d'auditeurs par jour (vague Médiamétrie citée par Puremédias).",
      url: 'https://www.acpm.fr/classements/united-web-sites-gp',
    },
    feedChecks: [
      {
        kind: 'latest',
        url: 'https://www.europe1.fr/rss.xml',
        checkedAt: CHECKED,
        status: 200,
        items: 50,
        covers: '~21 h',
        images: 'all',
      },
    ],
    tdm: {
      reserved: false,
      checkedAt: CHECKED,
      note: 'Pas de tdmrep.json (404).',
    },
  },
  {
    id: 'le-jdd',
    name: 'Le JDD',
    leaning: 'droite',
    paywall: 'partial',
    site: 'https://www.lejdd.fr',
    feeds: {
      une: 'https://www.lejdd.fr/rss/a-la-une.xml',
      latest: 'https://www.lejdd.fr/rss.xml',
    },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe JDD ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/jdd',
        takeaway:
          "Score +0,95 dans la bande « droite » (intervalle +0,31…+1,60). L'article documente le changement : −0,16 avant juin 2023, +0,30 juste après, +0,57 un an plus tard.",
      },
      {
        title:
          "« Nous n'avons pas gagné » : les journalistes du JDD mettent fin à 40 jours de grève",
        author: 'France 24',
        date: '2023-08-01',
        url: 'https://www.france24.com/fr/france/20230801-nous-n-avons-pas-gagn%C3%A9-les-journalistes-du-jdd-mettent-fin-%C3%A0-40-jours-de-gr%C3%A8ve',
        takeaway:
          'La rédaction a fait 40 jours de grève contre la nomination de Geoffroy Lejeune (ex-directeur de Valeurs actuelles) à la tête du journal, entérinée le 1er août 2023.',
      },
      {
        title:
          'La fin de la grève au « Journal du dimanche » laisse un goût amer',
        author: 'Le Monde',
        date: '2023-08-01',
        url: 'https://www.lemonde.fr/economie/article/2023/08/01/la-fin-de-la-greve-au-journal-du-dimanche-laisse-un-gout-amer_6184121_3234.html',
        takeaway:
          'Le Monde confirme la fin du conflit et le contexte de reprise en main éditoriale du hebdomadaire (groupe Lagardère, Vincent Bolloré).',
      },
    ],
    leaningNote:
      "Placé à Droite pour la rédaction actuelle, avec désaccord documenté : avant juin 2023, le JDD se situait au centre (FrIdéo mesure −0,16 sur janvier 2022 – juin 2023). Le classement Droite reflète le journal depuis l'arrivée de Geoffroy Lejeune (2023) ; le changement est daté et mesuré, pas anachronique.",
    readership: {
      evidence:
        'ACPM presse du 7e jour 2025/2026 : 9e rang, 118 153 exemplaires France payée ; LeJDD.fr : 88e rang des sites, 3,4 M de visites (août 2026).',
      url: 'https://www.acpm.fr/classements/p7j',
    },
    feedChecks: [
      {
        kind: 'une',
        url: 'https://www.lejdd.fr/rss/a-la-une.xml',
        checkedAt: CHECKED,
        status: 200,
        items: 9,
        covers: '~11 h',
        images: 'none',
      },
      {
        kind: 'latest',
        url: 'https://www.lejdd.fr/rss.xml',
        checkedAt: CHECKED,
        status: 200,
        items: 50,
        covers: '~1,5 jour',
        images: 'all',
        note: "Flux le plus complet, toutes rubriques (séries et ciné compris) : le hors-nuit est retiré par la classification (#4), jamais par le choix du flux. Le flux rss/politique.xml (50 articles, ~7 jours) reste l'alternative si un filtrage amont devenait nécessaire.",
      },
    ],
    tdm: {
      reserved: false,
      checkedAt: CHECKED,
      note: 'Pas de tdmrep.json (404).',
    },
  },
  {
    id: 'valeurs-actuelles',
    name: 'Valeurs actuelles',
    leaning: 'droite',
    paywall: 'partial',
    site: 'https://www.valeursactuelles.com',
    feeds: { latest: 'https://www.valeursactuelles.com/feed' },
    leaningSources: [
      {
        title:
          "FrIdéo : où se situe Valeurs actuelles ? (échelle d'idéologie de 30 médias français)",
        author: 'Amr Sobhy, Le French News Lab (ICNLSP 2026)',
        date: '2026',
        url: 'https://frenchnewslab.org/fr/medias/valeurs-actuelles',
        takeaway:
          'Score +1,87, le plus à droite des 30 médias du panel (intervalle +1,28…+2,46), sur 6 familles de preuves.',
      },
      {
        title:
          'Valeurs actuelles (article encyclopédique, section « Positionnement politique »)',
        author: 'Wikipédia (avec les articles cités en notes)',
        date: '2026',
        url: 'https://fr.wikipedia.org/wiki/Valeurs_actuelles',
        takeaway:
          "Selon Le Monde (2012), Valeurs actuelles a une ligne « conservatrice, plus à droite que celle du Figaro » ; selon Le Figaro lui-même, il est « tantôt décrit comme classé à l'extrême droite », « réputé clairement à droite ».",
      },
    ],
    leaningNote:
      "Placé à Droite, avec désaccord documenté sur la nuance : les sources parlent d'« extrême droite » (Le Figaro, en citation) ou de « clairement à droite ». Notre échelle n'a pas de case extrême droite (hors périmètre, voir la PRD) ; la bande « far-right » de FrIdéo est donc rattachée à Droite, ce qui correspond aussi à la description « conservatrice » du Monde.",
    readership: {
      evidence:
        'ACPM presse magazine 2025/2026 : 89e rang, 61 124 exemplaires France payée.',
      url: 'https://www.acpm.fr/classements/pmag',
    },
    feedChecks: [
      {
        kind: 'latest',
        url: 'https://www.valeursactuelles.com/feed',
        checkedAt: CHECKED,
        status: 200,
        items: 10,
        covers: '~5 h',
        images: 'none',
        note: 'Le flux historique « /rss » ne contient aucune date ; « /feed » sert les mêmes articles avec dates, mais sans image.',
      },
    ],
    tdm: {
      reserved: false,
      checkedAt: CHECKED,
      note: 'Pas de tdmrep.json (404).',
    },
  },
];

/** Outlets kept out of the Edition, with the reason and the date checked. */
export const excludedOutlets: ExcludedOutlet[] = [
  {
    id: 'lesechos',
    name: 'Les Échos',
    reason:
      'Flux RSS bloqués : lesechos.fr/rss/* répond 403 (une, actualités, rubriques), vérifié le 2026-10-06.',
    checkedAt: CHECKED,
  },
];

/**
 * The public Outlet shape written to `data/outlets.json`: identity and feeds
 * only. Sources, notes and checks stay in this module and on the site.
 */
export function publicOutlets(): Outlet[] {
  return outlets.map(({ id, name, leaning, paywall, site, feeds }) => ({
    id,
    name,
    leaning,
    paywall,
    site,
    feeds,
  }));
}
