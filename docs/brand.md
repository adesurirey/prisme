# Prisme — Brand brief

The single reference for Prisme's name, mission, voice and user-facing copy.
Read it before writing or changing any string a reader sees: taglines, page
titles, meta descriptions, badges, legal pages, error states.

The UI is French; this brief and all code/data names are English (see
GLOSSARY.md). Official catchlines are quoted verbatim in French — copy them
exactly, do not paraphrase.

## Catch line

<<<<<<< HEAD
> **L'actualité sous toutes ses couleurs.**

A prism splits one white light into its components. Prisme splits each day's
news into the components of the French political spectrum — the same colors
the UI paints on Gauche/Centre/Droite badges. The line also echoes the idiom
*voir quelque chose sous toutes ses couleurs*: see something in full.
=======
> **L’actualité sous toutes ses couleurs.**

A prism splits one white light into its components. Prisme splits each day's
news into the components of the French political spectrum — and *couleurs*
is literal as well as figurative: the three colors the UI paints on the
Gauche/Centre/Droite dots, bars and favicon are the line, drawn.
>>>>>>> e6c7274 (docs(brand): add brand brief and adopt the catch line)

## Descriptor

> La même actualité, vue par tous les bords politiques.

Used where a reader needs a literal explanation rather than a signature:
meta descriptions, landing copy, directory listings. It carries the promise
the short catch line drops — *la même* — that every reader sees the same
Stories, with no cherry-picking.

## Mission

Prisme shows each day's front-page news from the major French outlets, and
how each political Leaning covers it — same Story, every Leaning, side by
side — so readers can see the news whole and make up their own minds.

Expanded: Prisme collects what Outlets themselves put *à la une*, groups it
into Stories, and for every Story shows its Coverage, per-Leaning Summaries
and Differences. Prisme describes the press; it never judges it, scores it
or ranks it.

## Position

- **Stance — neutral instrument.** Prisme is a lens, not a referee. It shows
  what each Leaning publishes and stops there. Tone: precise, calm,
  almost scientific.
- **Reader — politically engaged general readers.** People who read the news
  daily and lean somewhere, but are curious and distrust echo chambers.
  Simple French; no media-studies jargon in the UI.
- **Differentiator.** Not aggregation (many do that) but the Prism: Coverage,
<<<<<<< HEAD
  Blindspots, Summaries and Differences for every Story. The Blindspot badge
  — *the Story everyone covers except them* — is the most distinctive asset
  in the product.
=======
  per-Leaning Summaries and Differences for every Story — plus Blindspots
  where a Leaning is silent. The Blindspot badge — *the Story everyone
  covers except them* — is the most distinctive asset in the product.
>>>>>>> e6c7274 (docs(brand): add brand brief and adopt the catch line)

## The both-sides answer

The first criticism Prisme will face is *both-sides-ism*. The brand line is
fixed:

> Showing how each side frames a Story is not saying both sides are equally
> right. It is saying readers deserve to see what each publishes, in their
> own words, before deciding.

Consistent with that: Prisme never ranks Outlets by reliability, never
labels an Article as true or false, and never classifies Articles by Leaning
(ADR-0001). Where the press is silent, Prisme names the silence
(Blindspot) — that is a description of declared Front pages, never an
accusation.

## Voice and tone

- **Precise.** Only what the product can prove: Front pages are declared,
  never inferred; Coverage counts reporting Outlets; Undated Articles show
  without a time of day. Say "we show", not "we know".
- **Calm and concrete.** Short declarative sentences. Verbs over adjectives.
  No exclamation marks, no hype, no outrage.
- **Reader-respecting.** Never tell the reader what to conclude. "Faites
  votre propre idée" is the underlying promise — state it through design and
  restraint, not slogans.
<<<<<<< HEAD
- **French, lightly.** The UI is French and idiomatic; avoid anglicisms
  (say *relevant* ideas in French: *à la une*, *raisonnement*, not
  *fake news*, *fact-check*).
=======
- **French, lightly.** The UI is French and idiomatic; avoid anglicisms —
  write *à la une*, *éditorial*, *vérification*, not *fake news*,
  *fact-check*, *homepage*.
>>>>>>> e6c7274 (docs(brand): add brand brief and adopt the catch line)

Never do: sarcasm, moralizing, "the truth about…", scoring Outlets,
promising neutrality as *absence of perspective* — Prisme's neutrality is
about *showing every perspective*.

## Word discipline

Glossary terms are law — see GLOSSARY.md for the full list and the
*Avoid* column. Highlights agents most often get wrong:

- Say **Leaning**, never *bias*, *side*, *orientation*. Leaning belongs to
  Outlets, never to Articles.
- Say **Decision model** / **Grouping model**, never *AI* alone,
  *classifier*, *judge*.
- Say **Front page**, never *homepage* or *headlines*.
- Say **Story** (a news event), never *topic*, *cluster* or *event*.
- Say **Edition**, never *issue*, *digest* or *daily*.

<<<<<<< HEAD
=======
## Visual identity

The UI already embodies the brand; these rules keep it that way.

- **Prisme has no brand color.** Prisme is the white light; the spectrum
  belongs to the press. Never introduce a decorative accent color — the only
  colors in the UI are the three Leaning colors (Gauche, Centre, Droite),
  used by the dots, the Coverage bar, the Blindspot dot and the favicon.
- **Color means something.** If a pixel is colored, it encodes a Leaning.
  Monochrome chrome, hairlines, generous whitespace (Linear-like).
- **The Leaning palette is lightness-architected.** Gauche `#e0415e`, Centre
  `#dfa414`, Droite `#2e7ce4` (light mode) — the gold sits clearly lighter
  than the two darker ends so segments separate wherever they touch (bars,
  dots, the favicon). Dark mode lifts all three (`#f28498`, `#e3b341`,
  `#63a8ea`). Never flatten the three to the same darkness — adjacent
  segments would blur into one strip.
- **The masthead is wordmark-only.** The header carries the black Fraunces
  PRISME and nothing else — the most credible pattern for a publication.
- **The favicon is the dot.** A single dot with a diagonal gradient —
  Gauche upper-left, Centre through the middle, Droite lower-right — where
  each color holds its hue across a zone and the seams blend quickly. Not
  whole-dot semi-transparent blending (it averages to mud at tab size)
  and not hard lobes (they break the circle). No triangle (it reads as a
  warning icon), no letter mark. Scheme-aware like the site: the dark
  palette swaps in via prefers-color-scheme.
- **The home page is the brand.** Its document title is just "Prisme";
  its visible H1 is the date — the page is an edition, and the date is the
  boldest freshness claim a masthead can make. Every other page carries a
  descriptive title with the "· Prisme" suffix and leaves the announcing
  to the home page.
- **Two typefaces, two registers.** Fraunces (variable, with its optical
  size axis) is the signature: the wordmark — uppercase, weight 900,
  tightly set — and nowhere else. Inter is everything the reader works
  with: titles, body, chrome, badges. Headlines are a scanning surface —
  their job is comparison, not voice — so they stay in Inter and never
  compete with the news they carry.
- **French typographic craft is brand craft.** Typographic apostrophe (’);
  thin no-break space (U+202F) before `:`, `;`, `?` and inside « guillemets ».
  A product about rigueur cannot have sloppy typography.
- **Hierarchy never comes from illegibility.** Every text carrying
  information meets AA contrast at its rendered size (`--faint` exists for
  decorative use only).

>>>>>>> e6c7274 (docs(brand): add brand brief and adopt the catch line)
## Identity in one line

Same Stories for everyone, every Leaning side by side, no verdicts.
