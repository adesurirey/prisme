/**
 * Back to the index with the browser's own scroll memory: the Story page's
 * "À la une" link is a plain <a href>, which full-page-loads the index
 * and drops the reader back at the top — they lose their place in the
 * list. The browser's back button doesn't have that problem (bfcache and
 * history scrolling restore the position natively), so when the reader
 * came from the index, the click becomes history.back(). The real href
 * stays for middle-click, new tab and arrivals without a matching history
 * entry (search, shared link): those follow the link as before.
 *
 * Like mode-toggle and pull-to-refresh, the logic lives in pure functions
 * (unit-tested); installBackLink wires it. Astro bundles the module script.
 */

/** Pure test: does this arrival qualify for history.back()? Only when the
 * reader was just on the index itself — the page the link promises. */
export function shouldUseBack(referrer: string, indexUrl: string): boolean {
  if (!referrer) return false;
  try {
    const from = new URL(referrer);
    const to = new URL(indexUrl, referrer);
    return (
      from.origin === to.origin &&
      from.pathname.replace(/\/+$/, '') === to.pathname.replace(/\/+$/, '')
    );
  } catch {
    return false;
  }
}

/** Pure test: should this click be turned into history.back()? Only when
 * the referrer qualifies and there is a history entry to go back to — a
 * tab opened in a new tab carries the index referrer but an empty history,
 * where back() would be a silent no-op that swallows the click. */
export function backOnClick(
  referrer: string,
  indexUrl: string,
  history: { back: () => void; length: number },
): boolean {
  if (!shouldUseBack(referrer, indexUrl) || history.length <= 1) return false;
  history.back();
  return true;
}

/** The index URL each link compares its referrer against. */
export const INDEX_URL_ATTR = 'data-index-url';

/** The weekly edition's URL, the other possible home the reader came
 * from (issue #128). */
export const WEEK_URL_ATTR = 'data-week-url';

/** The link's label span — swapped when the reader came from the weekly
 * edition, so the link names where it actually goes. */
const LABEL_ATTR = 'data-back-label';

/** Pure test: which edition page the referrer is — the weekly edition,
 * la Une, or nothing known (any other page, external, empty). The back
 * link retargets and relabels itself accordingly: a reader who arrived
 * from « 7 jours » returns there, not to la Une (issue #128). */
export function referrerEdition(
  referrer: string,
  indexUrl: string,
  weekUrl: string,
): 'index' | 'week' | null {
  if (shouldUseBack(referrer, weekUrl)) return 'week';
  if (shouldUseBack(referrer, indexUrl)) return 'index';
  return null;
}

/**
 * Wire the Story page's back-to-index link(s) (data-back-to-index, with
 * the index URL in data-index-url): a qualifying click becomes
 * history.back() — the browser restores the index scroll position itself;
 * anything else follows the href.
 *
 * Edition-aware (issue #128): when the referrer is the « 7 jours »
 * edition (URL in data-week-url), the link first retargets itself —
 * href, back target and label span all become « 7 jours » — so both the
 * history.back() path and every fallback (middle-click, new tab, no
 * history) keep the same promise: back to the edition they came from.
 */
export function installBackLink(doc: Document, win: Window): void {
  for (const link of doc.querySelectorAll<HTMLAnchorElement>(
    'a[data-back-to-index]',
  )) {
    const indexUrl = link.dataset.indexUrl ?? '';
    if (!indexUrl) continue;

    let backUrl = indexUrl;
    const weekUrl = link.dataset.weekUrl ?? '';
    if (
      weekUrl &&
      referrerEdition(doc.referrer, indexUrl, weekUrl) === 'week'
    ) {
      backUrl = weekUrl;
      link.href = weekUrl;
      const label = link.querySelector(`[${LABEL_ATTR}]`);
      if (label) label.textContent = '7 jours';
    }

    const target = backUrl;
    link.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      if (backOnClick(doc.referrer, target, win.history)) {
        event.preventDefault();
      }
    });
  }
}
