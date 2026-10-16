/**
 * "Afficher plus de sujets" (ADR-0022): the Edition is uncapped, so the front
 * page renders every Story in the static HTML and hides all but the first
 * batch. Progressive enhancement: without JavaScript — or for a crawler —
 * every Story is visible in the initial HTML; the script only ever reveals
 * the tail batch by batch. Hiding itself is CSS, not this module:
 * `html.js [data-load-more-tail]` (global.css) applies before first paint
 * — the inline <head> script swaps <html class="no-js"> to `js` — so there
 * is never a reveal flash on load. The counted pool is the
 * `[data-story-id]` roots in DOM order — the hero carries one too, except
 * when it renders without an image (StoryHero), in which case the batch is
 * simply 20 cards either way.
 *
 * Images in hidden cards are `loading="lazy"` (StoryImage), so hiding costs
 * nothing on the network until revealed.
 */

/** Stories visible before the first click (ADR-0022's pagination batch). */
export const LOAD_MORE_INITIAL = 20;
/** Additional Stories revealed per click. */
export const LOAD_MORE_STEP = 20;

/**
 * How many Stories are visible after `clicks` clicks of the button, for an
 * Edition of `total` Stories. Pure — the DOM wiring below just applies it.
 */
export function visibleCount(total: number, clicks: number): number {
  return Math.max(
    0,
    Math.min(total, LOAD_MORE_INITIAL + clicks * LOAD_MORE_STEP),
  );
}

/** Clicks needed for `count` Stories to be visible. */
function clicksFor(count: number): number {
  return Math.max(0, Math.ceil((count - LOAD_MORE_INITIAL) / LOAD_MORE_STEP));
}

function cardsOf(doc: Document): HTMLElement[] {
  return [...doc.querySelectorAll<HTMLElement>('[data-story-id]')];
}

/**
 * Reveals the first `visibleCount(total, clicks)` Stories. Tail cards ship
 * hidden by CSS (see the module comment) — this only flips `data-revealed`
 * on the cards this count brings in; the CSS rule exempts revealed cards.
 * Leading cards (the hero and the first batch) are never marked: they were
 * never hidden.
 */
function applyRevealed(cards: HTMLElement[], clicks: number): void {
  const visible = visibleCount(cards.length, clicks);
  for (const [index, card] of cards.entries()) {
    if (index < LOAD_MORE_INITIAL) continue;
    if (index < visible) {
      card.setAttribute('data-revealed', '');
      // Same entrance animation as the story page's revealed follow-up
      // rows (ArticleList → .reveal): fades/slides in on first render.
      card.classList.add('reveal');
    } else card.removeAttribute('data-revealed');
  }
}

/** Re-paints the button's progress fill and visible/total counter. */
function renderProgress(
  button: HTMLButtonElement,
  total: number,
  clicks: number,
): void {
  const visible = visibleCount(total, clicks);
  const fill = button.querySelector<HTMLElement>('[data-load-more-fill]');
  const count = button.querySelector<HTMLElement>('[data-load-more-count]');
  // The fill is a width ratio; the counter repeats the numbers as text for
  // screen readers (the fill span is aria-hidden in the markup).
  if (fill != null) fill.style.width = `${(visible / total) * 100}%`;
  if (count != null) count.textContent = `(${visible}/${total})`;
}

/**
 * Wires the button on the front page: reveals one more batch per click and
 * removes itself once every Story is visible. The button ships `hidden`;
 * this only unhides it when there is something to hide — a short Edition
 * keeps the page as-is. The click count lives on the button
 * (`data-load-more-clicks`) so {@link revealStory} can expand the same tail.
 */
export function installLoadMore(doc: Document = document): void {
  const cards = cardsOf(doc);
  const button = doc.querySelector<HTMLButtonElement>('[data-load-more]');
  if (button == null || cards.length <= LOAD_MORE_INITIAL) return;

  const render = (clicks: number) => {
    applyRevealed(cards, clicks);
    renderProgress(button, cards.length, clicks);
    if (visibleCount(cards.length, clicks) >= cards.length) {
      button.hidden = true;
    }
  };

  button.addEventListener('click', () => {
    const clicks = Number(button.dataset.loadMoreClicks ?? 0) + 1;
    button.dataset.loadMoreClicks = String(clicks);
    render(clicks);
  });

  render(0);
  button.hidden = false;
}

/**
 * Expands the tail until the Story with this id is visible — the "Nouveau"
 * pill jumps to a Story that may sit beyond the current batch, and a
 * `display:none` element cannot be scrolled to. True when the expansion
 * actually revealed something.
 */
export function revealStory(doc: Document, id: string): boolean {
  const button = doc.querySelector<HTMLButtonElement>('[data-load-more]');
  if (button == null) return false;
  const cards = cardsOf(doc);
  const index = cards.findIndex((card) => card.dataset.storyId === id);
  if (index < 0) return false;
  const current = Number(button.dataset.loadMoreClicks ?? 0);
  const needed = clicksFor(index + 1);
  if (needed <= current) return false;
  button.dataset.loadMoreClicks = String(needed);
  applyRevealed(cards, needed);
  renderProgress(button, cards.length, needed);
  return true;
}
