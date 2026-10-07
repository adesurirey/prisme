# Prisme

Prisme shows each day’s front-page news from the major French outlets, and how
each political leaning covers it — same story, every leaning, side by side.

## How it works

Every build (four a day via GitHub Actions) runs the pipeline, then commits the
result to `data/` — the git repo is the database, and CI publishes it as a
static site.

```mermaid
flowchart LR
    A["**Collect**\nevery Outlet’s RSS feed"] --> B["**Classify**\nDecision model — Kind + Section"]
    B --> C["**Group**\nGrouping model — new Articles into Stories"]
    C --> D["**Rank**\nfront pages, Coverage, recency → Edition"]
    D --> E["**Summarize**\nFlash-Lite — Summaries + Differences"]

    classDef io fill:#f6f8fa,stroke:#d0d7de,stroke-width:1px
    classDef model fill:#fff,stroke:#57606a,stroke-width:1.5px,stroke-dasharray:4 3
    class A,D io
    class B,C,E model
```

Dashed: a model decides. Plain: deterministic.

Three cheap models run the show; each pinned for traceability.

| Step | Model | Provider |
| --- | --- | --- |
| Classify (Kind + Section) and Membership checks | Jev (`typesafe/jev-1.13`) | OpenRouter — chosen by a hand-labeled benchmark |
| Group | Flash-Lite (`gemini-3.5-flash-lite`) | Gemini free tier |
| Summarize | Flash-Lite (`gemini-3.5-flash-lite`) | Gemini free tier |

Leanings are set by hand, one per Outlet, backed by sources — never classified
by a model. Builds without model keys still succeed: Articles stay unclassified
and ungrouped rather than the build failing.
