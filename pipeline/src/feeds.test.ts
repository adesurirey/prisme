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

    const items = parseFeed(xml);

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

    const items = parseFeed(xml);

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

    const items = parseFeed(xml);

    expect(items[0].imageUrl).toBe('https://exemple.fr/photo.jpg');
    expect(items[1].imageUrl).toBe('https://exemple.fr/med.jpg');
    expect(items[2].imageUrl).toBe('https://exemple.fr/thumb.jpg');
    expect(items[3].imageUrl).toBeUndefined();
  });

  it('gives an empty publishedAt when the feed has no date', () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item><title>Sans date</title><link>https://exemple.fr/x</link></item>
      </channel></rss>`;

    expect(parseFeed(xml)[0].publishedAt).toBe('');
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

    expect(parseFeed(xml)[0].teaser).toContain('Un paragraphe.');
  });
});
