// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backOnClick, installBackLink, shouldUseBack } from './back-link';

/**
 * The back-to-index link's rules: a plain click becomes history.back()
 * only when the reader was just on the index (referrer matches the index
 * URL, ignoring a trailing slash); any other arrival or any modified
 * click (middle, modifiers) follows the real href.
 */

const SITE = window.location.origin;
const indexUrl = `${SITE}/prisme/`;

describe('shouldUseBack', () => {
  it('matches a referrer that is the index', () => {
    expect(shouldUseBack(indexUrl, indexUrl)).toBe(true);
  });

  it('ignores a trailing-slash difference on the index path', () => {
    expect(shouldUseBack(`${SITE}/prisme`, indexUrl)).toBe(true);
  });

  it('rejects a referrer from a Story page', () => {
    expect(shouldUseBack(`${SITE}/prisme/sujet/x/`, indexUrl)).toBe(false);
  });

  it('rejects an empty referrer', () => {
    expect(shouldUseBack('', indexUrl)).toBe(false);
  });

  it('rejects an external referrer', () => {
    expect(shouldUseBack('https://elsewhere.example/prisme/', indexUrl)).toBe(
      false,
    );
  });

  it('tolerates an unparseable referrer', () => {
    expect(shouldUseBack('not a url', indexUrl)).toBe(false);
  });
});

describe('backOnClick', () => {
  it('calls history.back() and reports it for a qualifying click', () => {
    const history = { back: vi.fn() };
    expect(backOnClick(indexUrl, indexUrl, history)).toBe(true);
    expect(history.back).toHaveBeenCalledTimes(1);
  });

  it('leaves history alone for a non-qualifying arrival', () => {
    const history = { back: vi.fn() };
    expect(backOnClick('', indexUrl, history)).toBe(false);
    expect(history.back).not.toHaveBeenCalled();
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
      '" id="back">Aujourd\u2019hui</a>';
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
    const spy = page(`${SITE}/prisme/sujet/autre/`);
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
});
