/**
 * The reading toggle (issue #89, ADR-0016): Couverture (default) or
 * Exposition for every coverage bar on the page, at once. One attribute
 * write on <html data-mode> flips the bars (global.css picks the width
 * scale); the choice persists in localStorage (prisme:mode, absent =
 * Couverture). Radio semantics: arrows move and select, Home/End jump.
 * The live region announces the reading when the reader switches — and,
 * on pages carrying exactly one bar (the Story pages), that Story's
 * Exposition shares. Click deviates from strict radio semantics by
 * design: clicking anywhere on the control — track or label, checked or
 * not — flips the reading, the rapid back-and-forth gesture when
 * comparing Stories on the index; the keyboard keeps the radio steps.
 *
 * The logic lives in pure functions below (unit-tested, like
 * pull-to-refresh); installModeToggle wires them to the navbar's radio
 * group. No hydration: plain DOM, Astro bundles the module.
 *
 * The whisper (discoverability): sighted readers never hear the live
 * region, so the first four switches also show a small fading caption
 * under the toggle saying what the destination reading does. The count
 * persists (prisme:mode-whisper) — after two, never again.
 */
import { type CoverageGroup, LEANING_LABELS } from '@prisme/domain';

export type ReadingMode = 'coverage' | 'exposure';

/** localStorage key; absent or unreadable = Couverture. */
const KEY = 'prisme:mode';

/** localStorage key counting whispers shown; capped at WHISPER_LIMIT. */
const WHISPER_KEY = 'prisme:mode-whisper';

/** The whisper shows on the first four switches, then stops for good. */
export const WHISPER_LIMIT = 4;

/** Read the persisted mode. A broken localStorage never breaks the page. */
export function storedMode(storage: Pick<Storage, 'getItem'>): ReadingMode {
  try {
    return storage.getItem(KEY) === 'exposure' ? 'exposure' : 'coverage';
  } catch {
    return 'coverage';
  }
}

/** Persist the mode; a broken localStorage is ignored, not fatal. */
export function persistMode(
  storage: Pick<Storage, 'setItem'>,
  mode: ReadingMode,
): void {
  try {
    storage.setItem(KEY, mode);
  } catch {}
}

/**
 * How many whispers have been shown, clamped to the limit; an absent,
 * unreadable or malformed counter counts as zero — a broken localStorage
 * never breaks the page (the whisper would just reappear each visit).
 */
export function whisperCount(storage: Pick<Storage, 'getItem'>): number {
  try {
    const n = Number(storage.getItem(WHISPER_KEY));
    return Number.isFinite(n) ? Math.max(0, Math.min(WHISPER_LIMIT, n)) : 0;
  } catch {
    return 0;
  }
}

/** Persist the whisper count; a broken storage is ignored, not fatal. */
export function persistWhisperCount(
  storage: Pick<Storage, 'setItem'>,
  count: number,
): void {
  try {
    storage.setItem(WHISPER_KEY, String(count));
  } catch {}
}

/**
 * Where arrow keys move the checked radio from `checkedIndex` among
 * `count` options: Right/Down step forward, Left/Up step back, Home/End
 * jump. Any other key moves nothing (null).
 */
export function radioStep(
  key: string,
  checkedIndex: number,
  count: number,
): number | null {
  const last = count - 1;
  if (key === 'ArrowRight' || key === 'ArrowDown')
    return Math.min(checkedIndex + 1, last);
  if (key === 'ArrowLeft' || key === 'ArrowUp')
    return Math.max(checkedIndex - 1, 0);
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  return null;
}

/**
 * What a reading does, as a one-line sentence. The whisper shows it to
 * sighted readers; the live-region announcement below builds on it. No
 * trailing period: on Story pages the announcement appends the Exposition
 * shares ("— Gauche 68 %…") straight after this text.
 */
export function modeDescription(mode: ReadingMode): string {
  return mode === 'coverage'
    ? 'Les barres affichent combien de médias rapportent chaque sujet'
    : 'Les barres affichent la part de lecteurs touchés par chaque média pour un sujet';
}

/**
 * The announcement for a mode switch. On pages with exactly one coverage
 * bar (the Story pages) it carries that Story's Exposition shares, read
 * back off the prerendered segments; the Edition index carries many bars —
 * one Story's shares would say nothing about the others, so just the mode.
 */
export function announcement(mode: ReadingMode, doc: Document): string {
  if (mode === 'coverage') return modeDescription(mode);
  const bars = doc.querySelectorAll('.coverage-bar');
  const base = modeDescription(mode);
  if (bars.length !== 1) return base;
  const parts = Array.from(
    bars[0].querySelectorAll<HTMLElement>('.coverage-seg'),
  ).map((seg) => {
    const group = seg.dataset.group as CoverageGroup | undefined;
    const label = (group && LEANING_LABELS[group]) || seg.dataset.group;
    const share = Math.round(Number(seg.dataset.exposure) * 100) || 0;
    return `${label} ${share}\u202F%`;
  });
  const shares = parts.length ? ` — ${parts.join(', ')}` : '';
  return `${base}${shares}`;
}

/** The other reading — a click anywhere on the control flips to it. */
export function flip(mode: ReadingMode): ReadingMode {
  return mode === 'exposure' ? 'coverage' : 'exposure';
}

/** Write the mode where CSS reads it: <html data-mode> drives the bars. */
function setRootMode(root: HTMLElement, mode: ReadingMode): void {
  if (mode === 'exposure') root.dataset.mode = 'exposure';
  else delete root.dataset.mode;
}

/**
 * Wire the navbar's radio group: restore the persisted mode, then follow
 * clicks and keyboard. The initial restore never writes the live region —
 * it states the reading on a switch, not unprompted on page load.
 */
export function installModeToggle(
  doc: Document,
  win: { localStorage: Pick<Storage, 'getItem' | 'setItem'> },
): void {
  const group = doc.querySelector('[data-mode-toggle]');
  if (!group) return;

  const buttons = Array.from(
    group.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
  );
  const live = doc.querySelector('[data-mode-live]');
  const whisper = doc.querySelector('[data-mode-whisper]');
  const root = doc.documentElement;
  let whispersShown = whisperCount(win.localStorage);
  let fadeTimer: ReturnType<typeof setTimeout> | undefined;

  /** Fade the whisper out; a fresh show always restarts the clock. */
  const fadeOut = () => {
    whisper?.classList.remove('is-shown');
  };

  /**
   * Show the fading caption for the first WHISPER_LIMIT switches, then
   * never again. The live region already carries the text to screen
   * readers; the whisper is the sighted echo, so no extra announcement.
   */
  const showWhisper = (mode: ReadingMode) => {
    if (!whisper || whispersShown >= WHISPER_LIMIT) return;
    whispersShown += 1;
    persistWhisperCount(win.localStorage, whispersShown);
    whisper.textContent = modeDescription(mode);
    whisper.classList.add('is-shown');
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(fadeOut, 6000);
  };

  const apply = (mode: ReadingMode, focus: boolean, announce = true) => {
    setRootMode(root, mode);
    persistMode(win.localStorage, mode);
    for (const button of buttons) {
      const active = button.dataset.modeValue === mode;
      button.setAttribute('aria-checked', String(active));
      button.tabIndex = active ? 0 : -1;
    }
    if (live && announce) {
      live.textContent = announcement(mode, doc);
      showWhisper(mode);
    }
    if (focus) buttons.find((b) => b.dataset.modeValue === mode)?.focus();
  };

  // Click anywhere — track or label, checked or not — flips the reading.
  group.addEventListener('click', () => {
    const checked = buttons.find(
      (b) => b.getAttribute('aria-checked') === 'true',
    );
    apply(
      flip((checked?.dataset.modeValue as ReadingMode) ?? 'coverage'),
      false,
    );
  });

  group.addEventListener('keydown', (event) => {
    const { key } = event as KeyboardEvent;
    const checked = buttons.findIndex(
      (b) => b.getAttribute('aria-checked') === 'true',
    );
    const next = radioStep(key, checked, buttons.length);
    if (next === null) return;
    event.preventDefault();
    apply(buttons[next].dataset.modeValue as ReadingMode, true);
  });

  apply(storedMode(win.localStorage), false, false);
}
