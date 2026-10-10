# Prisme — Brand brief

The single reference for Prisme's name, mission, voice and user-facing copy.
Read it before writing or changing any string a reader sees: taglines, page
titles, meta descriptions, badges, legal pages, error states.

The UI is French; this brief and all code/data names are English (see
GLOSSARY.md). Official catchlines are quoted verbatim in French — copy them
exactly, do not paraphrase.

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
  per-Leaning Summaries and Differences for every Story — plus Blindspots
  where a Leaning is silent. The Blindspot badge — *the Story everyone
  covers except them* — is the most distinctive asset in the product.

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
  never inferred; Coverage counts Outlets on a story, editorials included; Undated Articles show
  without a time of day. Say "we show", not "we know".
- **Calm and concrete.** Short declarative sentences. Verbs over adjectives.
  No exclamation marks, no hype, no outrage.
- **Reader-respecting.** Never tell the reader what to conclude. "Faites
  votre propre idée" is the underlying promise — state it through design and
  restraint, not slogans.
- **French, lightly.** The UI is French and idiomatic; avoid anglicisms —
  write *à la une*, *éditorial*, *vérification*, not *fake news*,
  *fact-check*, *homepage*.

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

## Visual identity

The UI already embodies the brand; these rules keep it that way.

- **Prisme has no brand color.** Prisme is the white light; the spectrum
  belongs to the press. Never introduce a decorative accent color — the only
  colors in the UI are the three Coverage group colors (Gauche, Centre,
  Droite), used by the dots, the Coverage bar, the Blindspot dot and the
  favicon, plus the one exception below. A granular band (Centre gauche,
  Centre droit) lives in the label text only — its dot wears its group's
  color.
- **Color means something.** If a pixel is colored, it encodes a Leaning —
  or, as the single exception (ADR-0014), the Trending Story badge: sarcelle
  (`--trending`) means "this Story is climbing", nothing else.
  Monochrome chrome, hairlines, generous whitespace (Linear-like).

