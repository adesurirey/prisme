// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installEditionSwitcher } from './edition-switcher';

/**
 * The edition switcher (ADR-0028): a change on the select navigates to
 * the selected option's value; everything else — touch target, picker
 * UI, keyboard — is the platform's.
 */

describe('installEditionSwitcher', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function mount() {
    document.body.innerHTML = `
      <select data-edition-switcher aria-label="Choisir l'édition">
        <option value="/">Aujourd'hui</option>
        <option value="/7-jours/">7 jours</option>
      </select>`;
    return document.querySelector<HTMLSelectElement>(
      '[data-edition-switcher]',
    )!;
  }

  it('navigates to the selected edition on change', () => {
    const select = mount();
    const win = { location: { assign: vi.fn() } };
    installEditionSwitcher(document, win as unknown as Window);
    select.value = '/7-jours/';
    select.dispatchEvent(new Event('change'));
    expect(win.location.assign).toHaveBeenCalledWith('/7-jours/');
  });

  it('does nothing until the reader changes the selection', () => {
    mount();
    const win = { location: { assign: vi.fn() } };
    installEditionSwitcher(document, win as unknown as Window);
    expect(win.location.assign).not.toHaveBeenCalled();
  });

  it('ignores pages without the switcher', () => {
    document.body.innerHTML = '<p>no select here</p>';
    const win = { location: { assign: vi.fn() } };
    expect(() =>
      installEditionSwitcher(document, win as unknown as Window),
    ).not.toThrow();
    expect(win.location.assign).not.toHaveBeenCalled();
  });

  it('opens the native picker from the face button', () => {
    document.body.innerHTML = `
      <button type="button" data-edition-switcher-face>7 jours</button>
      <select data-edition-switcher class="sr-only" tabindex="-1" aria-hidden="true">
        <option value="/">Aujourd'hui</option>
        <option value="/7-jours/" selected>7 jours</option>
      </select>`;
    const select = document.querySelector<HTMLSelectElement>(
      '[data-edition-switcher]',
    )!;
    const showPicker = vi.fn();
    (select as HTMLSelectElement & { showPicker?: () => void }).showPicker =
      showPicker;
    const win = { location: { assign: vi.fn() } };
    installEditionSwitcher(document, win as unknown as Window);
    document
      .querySelector('[data-edition-switcher-face]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(showPicker).toHaveBeenCalledTimes(1);
    expect(win.location.assign).not.toHaveBeenCalled();
    // The select stays out of the tab order: the face is the one stop.
    expect(select.tabIndex).toBe(-1);
  });

  it('falls back to the transparent overlay without showPicker', () => {
    document.body.innerHTML = `
      <button type="button" data-edition-switcher-face>7 jours</button>
      <select data-edition-switcher class="sr-only" tabindex="-1" aria-hidden="true">
        <option value="/">Aujourd'hui</option>
      </select>`;
    const select = document.querySelector<HTMLSelectElement>(
      '[data-edition-switcher]',
    )!;
    installEditionSwitcher(document, window);
    // Pre-showPicker browsers: the select becomes the tap-and-keyboard
    // target again, stretched over the face.
    expect(select.classList.contains('sr-only')).toBe(false);
    expect(select.classList.contains('opacity-0')).toBe(true);
    expect(select.tabIndex).toBe(0);
  });

  it('keeps working when the picker refuses to open', () => {
    document.body.innerHTML = `
      <button type="button" data-edition-switcher-face>7 jours</button>
      <select data-edition-switcher class="sr-only" tabindex="-1" aria-hidden="true">
        <option value="/">Aujourd'hui</option>
      </select>`;
    const select = document.querySelector<HTMLSelectElement>(
      '[data-edition-switcher]',
    )!;
    (select as HTMLSelectElement & { showPicker?: () => void }).showPicker =
      () => {
        throw new DOMException('denied', 'NotAllowedError');
      };
    installEditionSwitcher(document, window);
    expect(() =>
      document
        .querySelector('[data-edition-switcher-face]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true })),
    ).not.toThrow();
    // The catch degrades to the overlay rather than dying silently.
    expect(select.classList.contains('opacity-0')).toBe(true);
  });
});
