import { describe, expect, it } from 'vitest';
import { parseFeed } from './feeds.ts';

describe('parseFeed', () => {
  it('parses an RSS item into headline, url, date and teaser', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0"><channel>
        <title>Un outlet</title>
        <item>
          <title>Une info importante</title>
          <link>https://exemple.fr/article-1</link>
          <pubDate>Mon, 06 Oct 2025 10:00:00 +0200</pubDate>
          <description>Le chapeau de l'article.</description>
        </item>
      </channel></rss>`;

    const { items } = parseFeed(xml);

    expect(items).toHaveLength(1);
    expect(items[0].headline).toBe('Une info importante');
    expect(items[0].url).toBe('https://exemple.fr/article-1');
    expect(items[0].publishedAt).toBe('2025-10-06T08:00:00.000Z');
    expect(items[0].teaser).toBe("Le chapeau de l'article.");
    expect(items[0].imageUrl).toBeUndefined();
  });

  it('parses an Atom entry (published, href link, CDATA title)', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title><![CDATA[Grève dans les transports]]></title>
          <link rel="alternate" href="https://exemple.fr/greve"/>
          <published>2025-10-06T09:30:00Z</published>
          <summary>Les lignes perturbées.</summary>
        </entry>
      </feed>`;

    const { items } = parseFeed(xml);

    expect(items).toHaveLength(1);
    expect(items[0].headline).toBe('Grève dans les transports');
    expect(items[0].url).toBe('https://exemple.fr/greve');
    expect(items[0].publishedAt).toBe('2025-10-06T09:30:00.000Z');
    expect(items[0].teaser).toBe('Les lignes perturbées.');
  });

  it('extracts the image from an enclosure or media:content', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0"
           xmlns:media="http://search.yahoo.com/mrss/"><channel>
        <item>
          <title>Avec image</title>
          <link>https://exemple.fr/a</link>
          <enclosure url="https://exemple.fr/photo.jpg" type="image/jpeg" length="123"/>
        </item>
        <item>
          <title>Image media:content</title>
          <link>https://exemple.fr/b</link>
          <media:content url="https://exemple.fr/med.jpg" medium="image"/>
        </item>
        <item>
          <title>Image media:thumbnail</title>
          <link>https://exemple.fr/c</link>
          <media:thumbnail url="https://exemple.fr/thumb.jpg"/>
        </item>
        <item>
          <title>Sans image</title>
          <link>https://exemple.fr/d</link>
        </item>
      </channel></rss>`;

    const { items } = parseFeed(xml);

    expect(items[0].imageUrl).toBe('https://exemple.fr/photo.jpg');
    expect(items[1].imageUrl).toBe('https://exemple.fr/med.jpg');
    expect(items[2].imageUrl).toBe('https://exemple.fr/thumb.jpg');
    expect(items[3].imageUrl).toBeUndefined();
  });

  it('gives an empty publishedAt when neither the item nor its URL carries a date', () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item><title>Sans date</title><link>https://exemple.fr/x</link></item>
      </channel></rss>`;

    const { items } = parseFeed(xml);

    expect(items[0].publishedAt).toBe('');
    expect(items[0].dayPrecision).toBeUndefined();
  });

  it('falls back to atom content when there is no summary', () => {
    const xml = `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Titre</title>
          <link href="https://exemple.fr/y"/>
          <content type="html">&lt;p&gt;Un paragraphe.&lt;/p&gt;</content>
        </entry>
      </feed>`;

    expect(parseFeed(xml).items[0].teaser).toContain('Un paragraphe.');
  });

  it('decodes HTML entities in headline, url and teaser', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0"><channel>
        <item>
          <title><![CDATA[Novak Djokovic d&#xE9;croche &#xE0; P&#xE9;kin]]></title>
          <link>https://exemple.fr/a?x=1&amp;y=2</link>
          <description><![CDATA[&lt;p&gt;Un &amp; deux&lt;/p&gt;]]></description>
        </item>
      </channel></rss>`;

    const { items } = parseFeed(xml);

    expect(items[0].headline).toBe('Novak Djokovic décroche à Pékin');
    expect(items[0].url).toBe('https://exemple.fr/a?x=1&y=2');
    expect(items[0].teaser).toBe('<p>Un & deux</p>');
  });

  it('exposes the channel lastBuildDate as updatedAt', () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <lastBuildDate>Tue, 07 Oct 2026 14:06:16 +0200</lastBuildDate>
        <item><title>X</title><link>https://exemple.fr/x</link></item>
      </channel></rss>`;

    expect(parseFeed(xml).updatedAt).toBe('2026-10-07T12:06:16.000Z');
  });

  it('gives an empty updatedAt when the channel has no build date', () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item><title>X</title><link>https://exemple.fr/x</link></item>
      </channel></rss>`;

    expect(parseFeed(xml).updatedAt).toBe('');
  });
});

describe('parseFeed — Undated Articles (ADR-0007)', () => {
  it('dates an undated item to the start of its Publication day, read from the URL (summer, +02:00)', () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item><title>Le Parisien</title><link>https://www.leparisien.fr/international/les-inepties-de-la-france-07-10-2026-NBXYDQGVGJACZD47XKSIMXKNGM.php</link></item>
      </channel></rss>`;

    const { items } = parseFeed(xml);

    // 7 October 2026, 00:00:00 Paris (UTC+2) = 6 October 22:00 UTC.
    expect(items[0].publishedAt).toBe('2026-10-06T22:00:00.000Z');
    expect(items[0].dayPrecision).toBe(true);
  });

  it('handles the winter offset (+01:00) and the /archives/ slug shape', () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item><title>Archives</title><link>https://www.leparisien.fr/archives/5-decembre-on-vend-25-de-velos-en-plus-28-11-2019-8204574.php</link></item>
      </channel></rss>`;

    const { items } = parseFeed(xml);

    // 28 November 2019, 00:00:00 Paris (UTC+1) = 27 November 23:00 UTC.
    expect(items[0].publishedAt).toBe('2019-11-27T23:00:00.000Z');
    expect(items[0].dayPrecision).toBe(true);
  });

  it('dates an undated Atom entry from its URL too', () => {
    const xml = `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Titre</title>
          <link href="https://www.leparisien.fr/sports/une-histoire-03-10-2026-ABC123.php"/>
        </entry>
      </feed>`;

    const { items } = parseFeed(xml);

    expect(items[0].publishedAt).toBe('2026-10-02T22:00:00.000Z');
    expect(items[0].dayPrecision).toBe(true);
  });

  it('keeps the feed date as exact time when both a date and a dated URL exist', () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item>
          <title>Daté</title>
          <link>https://www.leparisien.fr/sports/histoire-07-10-2026-ABC123.php</link>
          <pubDate>Wed, 07 Oct 2026 08:30:00 +0200</pubDate>
        </item>
      </channel></rss>`;

    const { items } = parseFeed(xml);

    expect(items[0].publishedAt).toBe('2026-10-07T06:30:00.000Z');
    expect(items[0].dayPrecision).toBeUndefined();
  });

  it('ignores date-like URL segments that are not a DD-MM-YYYY publication day', () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item><title>Faux</title><link>https://exemple.fr/99-99-2026-abc</link></item>
        <item><title>Page</title><link>https://exemple.fr/page/2</link></item>
      </channel></rss>`;

    const { items } = parseFeed(xml);

    expect(items[0].publishedAt).toBe('');
    expect(items[0].dayPrecision).toBeUndefined();
    expect(items[1].publishedAt).toBe('');
  });

  it('rejects impossible calendar dates in the URL', () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item><title>Février 30</title><link>https://www.leparisien.fr/x/histoire-30-02-2026-ABC123.php</link></item>
      </channel></rss>`;

    const { items } = parseFeed(xml);

    expect(items[0].publishedAt).toBe('');
    expect(items[0].dayPrecision).toBeUndefined();
  });
});
