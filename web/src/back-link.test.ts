// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  backOnClick,
  installBackLink,
  parseHomeUrls,
  referrerHome,
  shouldUseBack,
} from './back-link';

/**
 * The back-to-index link's rules: a plain click becomes history.back()
 * only when the reader was just on one of the link's home pages (referrer
 * matches a home URL, ignoring a trailing slash) and there is a history
 * entry to go back to (a tab opened in a new tab has the referrer but an
 * empty history); any other arrival or any modified click (middle,
 * modifiers) follows the real href — retargeted to the home the reader
 * came from when it is one of the known homes.
 */

const SITE = window.location.origin;
const indexUrl = `${SITE}/`;
const feedUrl = `${SITE}/le-fil/`;
const liveUrl = `${SITE}/en-direct/`;
const homeUrls = [indexUrl, feedUrl, liveUrl];

describe('shouldUseBack', () => {
  it('matches a referrer that is the index', () => {
    expect(shouldUseBack(indexUrl, indexUrl)).toBe(true);
  });

  it('ignores a trailing-slash difference on the index path', () => {
    expect(shouldUseBack(`${SITE}`, indexUrl)).toBe(true);
  });

  it('rejects a referrer from a Story page', () => {
    expect(shouldUseBack(`${SITE}/sujet/x/`, indexUrl)).toBe(false);
  });

  it('rejects an empty referrer', () => {
    expect(shouldUseBack('', indexUrl)).toBe(false);
  });

  it('rejects an external referrer', () => {
    expect(shouldUseBack('https://elsewhere.example/', indexUrl)).toBe(false);
  });

  it('tolerates an unparseable referrer', () => {
    expect(shouldUseBack('not a url', indexUrl)).toBe(false);
  });
});

describe('backOnClick', () => {
  // The reader arrived from a home page, so the history stub carries a
  // previous entry (length 2); length 1 is a fresh tab with nowhere back.
  const historyFromHome = () => ({ back: vi.fn(), length: 2 });

  it('calls history.back() and reports it for a qualifying click', () => {
    const history = historyFromHome();
    expect(backOnClick(indexUrl, indexUrl, history)).toBe(true);
    expect(history.back).toHaveBeenCalledTimes(1);
  });

  it('follows the href when the tab has no history to go back to', () => {
    // New tab opened from the index: the referrer is set, but back() would
    // be a silent no-op — the click must fall through to the real link.
    const history = { back: vi.fn(), length: 1 };
    expect(backOnClick(indexUrl, indexUrl, history)).toBe(false);
    expect(history.back).not.toHaveBeenCalled();
  });

  it('leaves history alone for a non-qualifying arrival', () => {
    const history = historyFromHome();
    expect(backOnClick('', indexUrl, history)).toBe(false);
    expect(history.back).not.toHaveBeenCalled();
  });
});

describe('parseHomeUrls', () => {
  it('parses the JSON array of home URLs', () => {
    expect(parseHomeUrls(JSON.stringify(homeUrls))).toEqual(homeUrls);
  });

  it('returns [] for a missing attribute', () => {
    expect(parseHomeUrls(undefined)).toEqual([]);
  });

  it('returns [] for malformed JSON', () => {
    expect(parseHomeUrls('not json')).toEqual([]);
  });

  it('returns [] for a non-array JSON value', () => {
    expect(parseHomeUrls(JSON.stringify(indexUrl))).toEqual([]);
  });

  it('drops non-string and empty entries from the array', () => {
    expect(parseHomeUrls(JSON.stringify([indexUrl, 42, '', null]))).toEqual([
      indexUrl,
    ]);
  });
});

describe('referrerHome', () => {
  it('recognizes the weekly edition (issue #128)', () => {
    expect(referrerHome(feedUrl, homeUrls)).toBe(feedUrl);
  });

  it('recognizes the live edition (ADR-0029)', () => {
    expect(referrerHome(liveUrl, homeUrls)).toBe(liveUrl);
  });

  it('recognizes la Une', () => {
    expect(referrerHome(indexUrl, homeUrls)).toBe(indexUrl);
  });

  it('returns null for any other arrival', () => {
    expect(referrerHome(`${SITE}/sujet/x/`, homeUrls)).toBeNull();
    expect(referrerHome('', homeUrls)).toBeNull();
    expect(referrerHome('https://elsewhere.example/', homeUrls)).toBeNull();
  });
});

describe('installBackLink', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function page(referrer: string, homes: string[] = homeUrls) {
    Object.defineProperty(document, 'referrer', {
      configurable: true,
      value: referrer,
    });
    document.body.innerHTML =
      '<a href="/" data-back-to-index id="back">À la une</a>';
    document
      .getElementById('back')!
      .setAttribute('data-home-urls', JSON.stringify(homes));
    // The reader arrived from a home page, so there is history to go back
    // to (jsdom starts at length 1, a fresh tab).
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(2);
    const spy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    installBackLink(document, window);
    return spy;
  }

  function click() {
    document
      .getElementById('back')!
      .dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
  }

  it('turns a plain click from the index into history.back()', () => {
    const spy = page(indexUrl);
    click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('lets a click from elsewhere follow the href', () => {
    const spy = page(`${SITE}/sujet/autre/`);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById('back')!.dispatchEvent(event);
    expect(spy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('ignores modified clicks (new tab)', () => {
    const spy = page(indexUrl);
    document.getElementById('back')!.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        metaKey: true,
      }),
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('retargets the link for a reader arriving from « Le fil », label unchanged', () => {
    const spy = page(feedUrl);
    // Target and href become the weekly edition — every path
    // (history.back, fallback href, middle-click) keeps the same promise
    // — while the label stays « À la une »: it names the page, the
    // select names the window (ADR-0028).
    const link = document.getElementById('back')! as HTMLAnchorElement;
    expect(link.textContent).toBe('À la une');
    expect(link.getAttribute('href')).toBe(feedUrl);
    click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('retargets the link for a reader arriving from « En direct » (ADR-0029)', () => {
    const spy = page(liveUrl);
    const link = document.getElementById('back')! as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(liveUrl);
    click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('falls back to a plain follow for a live-edition arrival with no history', () => {
    const spy = page(liveUrl);
    const link = document.getElementById('back')! as HTMLAnchorElement;
    // href was retargeted at install time, but with no history entry the
    // click must follow the link (to « En direct »), not call back()
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(1);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(spy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(link.href).toBe(liveUrl);
  });

  it('ignores a link with no home URLs', () => {
    Object.defineProperty(document, 'referrer', {
      configurable: true,
      value: indexUrl,
    });
    document.body.innerHTML =
      '<a href="/" data-back-to-index id="back">À la une</a>';
    const spy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    installBackLink(document, window);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById('back')!.dispatchEvent(event);
    expect(spy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
