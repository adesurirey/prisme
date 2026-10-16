import { beforeEach, describe, expect, it } from 'vitest';
import { installLoadMore, LOAD_MORE_INITIAL, revealStory } from './load-more';

/**
 * DOM wiring tests for the "Afficher plus de sujets" tail (ADR-0022): a
 * minimal document stub with card roots and the button.
 */
function page(total: number): Document {
  const cards = Array.from({ length: total }, (_, i) => {
    const el = {
      classList: {
        add(c: string) {
          (el as any)._classes ??= new Set();
          (el as any)._classes.add(c);
        },
      },
      get dataset() {
        if ((el as any)._ds == null) (el as any)._ds = { storyId: `s${i}` };
        return (el as any)._ds;
      },
      getAttribute: (n: string) =>
        (el as any)._revealed && n === 'data-revealed' ? '' : null,
      setAttribute() {
        (el as any)._revealed = true;
      },
      removeAttribute() {
        (el as any)._revealed = false;
      },
      hidden: false,
    } as unknown as HTMLElement;
    return el;
  });
  const fill = { style: { width: '' } };
  const count = { textContent: '' };
  const button = {
    hidden: true,
    dataset: {},
    addEventListener: () => {},
    querySelector: (sel: string) =>
      sel === '[data-load-more-fill]'
        ? fill
        : sel === '[data-load-more-count]'
          ? count
          : null,
  } as unknown as HTMLButtonElement;
  (button as any).__fill = fill;
  (button as any).__count = count;
  const doc = {
    querySelectorAll: (sel: string) => (sel === '[data-story-id]' ? cards : []),
    querySelector: (sel: string) =>
      sel === '[data-load-more]' ? button : null,
  } as unknown as Document;
  return doc;
}

describe('installLoadMore — progress counter and fill', () => {
  it('paints the visible/total counter and fill width on install', () => {
    const doc = page(45);
    installLoadMore(doc);
    const button = doc.querySelector('[data-load-more]') as any;
    expect(button.__count.textContent).toBe('(20/45)');
    expect(button.__fill.style.width).toBe(`${(20 / 45) * 100}%`);
  });

  it('updates the counter and fill when revealStory expands the tail', () => {
    const doc = page(45);
    installLoadMore(doc);
    revealStory(doc, 's25');
    const button = doc.querySelector('[data-load-more]') as any;
    expect(button.__count.textContent).toBe('(40/45)');
    expect(button.__fill.style.width).toBe(`${(40 / 45) * 100}%`);
  });
});

describe('installLoadMore', () => {
  let doc: Document;

  describe(`hides the tail beyond ${LOAD_MORE_INITIAL}`, () => {
    beforeEach(() => {
      doc = page(45);
    });
    it('hides cards 20+ and shows the button', () => {
      installLoadMore(doc);
      const cards = doc.querySelectorAll<HTMLElement>('[data-story-id]');
      expect((cards[19] as any)._revealed).toBeFalsy();
      expect((cards[20] as any)._revealed).toBe(false);
      expect(
        (doc.querySelector('[data-load-more]') as HTMLButtonElement).hidden,
      ).toBe(false);
    });
  });

  it('is a no-op for a short Edition', () => {
    doc = page(12);
    installLoadMore(doc);
    const cards = doc.querySelectorAll<HTMLElement>('[data-story-id]');
    expect([...cards].every((c) => !(c as any)._revealed)).toBe(true);
    expect(
      (doc.querySelector('[data-load-more]') as HTMLButtonElement).hidden,
    ).toBe(true);
  });
});

describe('revealStory', () => {
  it('expands the tail until the target Story is visible', () => {
    const doc = page(45);
    installLoadMore(doc);
    expect(revealStory(doc, 's25')).toBe(true);
    const cards = doc.querySelectorAll<HTMLElement>('[data-story-id]');
    expect((cards[25] as any)._revealed).toBe(true);
    expect((cards[39] as any)._revealed).toBe(true);
    expect((cards[40] as any)._revealed).toBe(false);
    // Newly revealed cards carry the .reveal entrance animation (aligned
    // with ArticleList follow-ups).
    expect((cards[25] as any)._classes.has('reveal')).toBe(true);
  });

  it('is a no-op for a Story already visible or unknown', () => {
    const doc = page(45);
    installLoadMore(doc);
    expect(revealStory(doc, 's5')).toBe(false);
    expect(revealStory(doc, 'nope')).toBe(false);
  });
});
