/**
 * The edition switcher's wiring (ADR-0028): the face button opens the
 * native picker of the visually hidden select (showPicker); a change
 * navigates to the selected edition's URL — location.assign keeps the
 * current page in history, so a switch is one back-tap undoable.
 *
 * Pre-showPicker browsers (Safari ≤ 15, Chrome ≤ 98) cannot open a
 * select programmatically: they get the transparent overlay instead —
 * the select stretches over the face and takes taps and keyboard
 * itself, like the first version of this control.
 */
export function installEditionSwitcher(
  doc: Document = document,
  win: Window = window,
): void {
  const select = doc.querySelector<HTMLSelectElement>(
    '[data-edition-switcher]',
  );
  if (!select) return;

  select.addEventListener('change', () => {
    if (select.value) win.location.assign(select.value);
  });

  const face = doc.querySelector<HTMLButtonElement>(
    '[data-edition-switcher-face]',
  );
  if (!face) return;

  const overlayFallback = () => {
    select.classList.remove('sr-only');
    select.classList.add('absolute', 'inset-0', 'cursor-pointer', 'opacity-0');
    select.tabIndex = 0;
  };

  if (typeof select.showPicker !== 'function') {
    overlayFallback();
    return;
  }

  face.addEventListener('click', () => {
    // NotAllowedError without a user gesture, InvalidStateError if the
    // browser refuses the element — degrade to the overlay and let the
    // next tap land on the real select.
    try {
      select.showPicker();
    } catch {
      overlayFallback();
    }
  });
}
