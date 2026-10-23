// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  backOnClick,
  installBackLink,
  referrerEdition,
  shouldUseBack,
} from './back-link';

/**
 * The back-to-index link's rules: a plain click becomes history.back()
 * only when the reader was just on the index (referrer matches the index
 * URL, ignoring a trailing slash) and there is a history entry to go back
 * to (a tab opened in a new tab has the referrer but an empty history);
 * any other arrival or any modified click (middle, modifiers) follows the
 * real href.
 */

const SITE = window.location.origin;
const indexUrl = `${SITE}/`;
const weekUrl = `${SITE}/7-jours/`;

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
  // The reader arrived from the index, so the history stub carries a
  // previous entry (length 2); length 1 is a fresh tab with nowhere back.
  const historyFromIndex = () => ({ back: vi.fn(), length: 2 });

  it('calls history.back() and reports it for a qualifying click', () => {
    const history = historyFromIndex();
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
    const history = historyFromIndex();
    expect(backOnClick('', indexUrl, history)).toBe(false);
    expect(history.back).not.toHaveBeenCalled();
  });
});

describe('referrerEdition', () => {
  it('recognizes the weekly edition (issue #128)', () => {
    expect(referrerEdition(weekUrl, indexUrl, weekUrl)).toBe('week');
  });

  it('recognizes la Une', () => {
    expect(referrerEdition(indexUrl, indexUrl, weekUrl)).toBe('index');
  });

  it('returns null for any other arrival', () => {
    expect(referrerEdition(`${SITE}/sujet/x/`, indexUrl, weekUrl)).toBeNull();
    expect(referrerEdition('', indexUrl, weekUrl)).toBeNull();
    expect(
      referrerEdition('https://elsewhere.example/', indexUrl, weekUrl),
    ).toBeNull();
  });
});

describe('installBackLink', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function page(referrer: string) {
    Object.defineProperty(document, 'referrer', {
      configurable: true,
      value: referrer,
    });
    document.body.innerHTML =
      '<a href="/" data-back-to-index data-index-url="' +
      indexUrl +
      '" id="back">\u00c0 la une</a>';
    // The reader arrived from the index, so there is history to go back
    // to (jsdom starts at length 1, a fresh tab).
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(2);
    const spy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    installBackLink(document, window);
    return spy;
  }

  it('turns a plain click from the index into history.back()', () => {
    const spy = page(indexUrl);
    document
      .getElementById('back')!
      .dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('lets a click from elsewhere follow the href', () => {
    const spy = page(`${SITE}/sujet/autre/`);
    const link = document.getElementById('back')!;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
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

  it('retargets the link for a reader arriving from « 7 jours », label unchanged', () => {
    Object.defineProperty(document, 'referrer', {
      configurable: true,
      value: weekUrl,
    });
    document.body.innerHTML =
      '<a href="' +
      indexUrl +
      '" data-back-to-index data-index-url="' +
      indexUrl +
      '" data-week-url="' +
      weekUrl +
      '" id="back">À la une</a>';
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(2);
    const spy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    installBackLink(document, window);
    // Target and href become the weekly edition — every path
    // (history.back, fallback href, middle-click) keeps the same promise
    // — while the label stays « À la une »: it names the page, the
    // select names the window (ADR-0028).
    const link = document.getElementById('back')! as HTMLAnchorElement;
    expect(link.textContent).toBe('À la une');
    expect(link.getAttribute('href')).toBe(weekUrl);
    link.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
