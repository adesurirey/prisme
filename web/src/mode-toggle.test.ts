// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  announcement,
  installModeToggle,
  modeDescription,
  persistMode,
  persistWhisperCount,
  radioStep,
  storedMode,
  WHISPER_LIMIT,
  whisperCount,
} from './mode-toggle';

/**
 * The reading toggle's rules (issue #89, ADR-0016): persistence (absent =
 * Couverture, broken storage never fatal), radio-keyboard navigation
 * (arrows step and select, Home/End jump), announcements that carry the
 * Exposition shares only where there is exactly one bar (Story pages),
 * an initial restore that never announces, and the discoverability
 * whisper: a fading caption on the first four switches, then silence
 * for good (the count persists in localStorage).
 */

function coverageBarHtml(): string {
  return `
    <span class="coverage-bar">
      <span class="coverage-seg" data-group="gauche" data-exposure="0.68"></span>
      <span class="coverage-seg" data-group="droite" data-exposure="0.32"></span>
    </span>`;
}

function toggleHtml(): string {
  return `
    <div data-mode-toggle role="radiogroup">
      <button type="button" role="radio" aria-checked="true" tabindex="0" data-mode-value="coverage">Couverture</button>
      <button type="button" role="radio" aria-checked="false" tabindex="-1" data-mode-value="exposure">Exposition</button>
    </div>
    <p role="status" data-mode-live></p>
    <p data-mode-whisper aria-hidden="true"></p>`;
}

/** A fake storage whose access throws, simulating a blocked localStorage. */
const brokenStorage = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};

describe('storedMode', () => {
  it('defaults to Couverture when nothing is stored', () => {
    expect(storedMode(localStorage)).toBe('coverage');
  });

  it('reads a stored Exposition', () => {
    localStorage.setItem('prisme:mode', 'exposure');
    expect(storedMode(localStorage)).toBe('exposure');
  });

  it('falls back to Couverture on any other stored value', () => {
    localStorage.setItem('prisme:mode', 'yolo');
    expect(storedMode(localStorage)).toBe('coverage');
  });

  it('falls back to Couverture when storage is broken', () => {
    expect(storedMode(brokenStorage)).toBe('coverage');
  });
});

describe('persistMode', () => {
  it('stores the mode', () => {
    persistMode(localStorage, 'exposure');
    expect(localStorage.getItem('prisme:mode')).toBe('exposure');
  });

  it('ignores a broken storage', () => {
    expect(() => persistMode(brokenStorage, 'exposure')).not.toThrow();
  });
});

describe('modeDescription', () => {
  it('describes each reading in one line', () => {
    expect(modeDescription('coverage')).toBe(
      'Les barres affichent combien de médias rapportent chaque sujet',
    );
    expect(modeDescription('exposure')).toBe(
      'Les barres affichent la part de lecteurs touchés par chaque média pour un sujet',
    );
  });
});

describe('whisperCount', () => {
  it('defaults to zero when nothing is stored', () => {
    expect(whisperCount(localStorage)).toBe(0);
  });

  it('reads a stored count', () => {
    localStorage.setItem('prisme:mode-whisper', '1');
    expect(whisperCount(localStorage)).toBe(1);
  });

  it('clamps past the limit and treats junk as zero', () => {
    localStorage.setItem('prisme:mode-whisper', '9');
    expect(whisperCount(localStorage)).toBe(WHISPER_LIMIT);
    localStorage.setItem('prisme:mode-whisper', 'yolo');
    expect(whisperCount(localStorage)).toBe(0);
  });

  it('falls back to zero when storage is broken', () => {
    expect(whisperCount(brokenStorage)).toBe(0);
  });
});

describe('persistWhisperCount', () => {
  it('stores the count', () => {
    persistWhisperCount(localStorage, 2);
    expect(localStorage.getItem('prisme:mode-whisper')).toBe('2');
  });

  it('ignores a broken storage', () => {
    expect(() => persistWhisperCount(brokenStorage, 2)).not.toThrow();
  });
});

describe('radioStep', () => {
  const count = 2;
  it('steps forward and clamps at the last option', () => {
    expect(radioStep('ArrowRight', 0, count)).toBe(1);
    expect(radioStep('ArrowDown', 1, count)).toBe(1);
  });

  it('steps back and clamps at the first option', () => {
    expect(radioStep('ArrowLeft', 1, count)).toBe(0);
    expect(radioStep('ArrowUp', 0, count)).toBe(0);
  });

  it('jumps with Home and End', () => {
    expect(radioStep('Home', 1, count)).toBe(0);
    expect(radioStep('End', 0, count)).toBe(1);
  });

  it('moves nothing on any other key', () => {
    expect(radioStep('k', 0, count)).toBe(null);
  });
});

describe('announcement', () => {
  beforeEach(() => {
    document.body.innerHTML = coverageBarHtml();
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('describes the Couverture reading', () => {
    expect(announcement('coverage', document)).toBe(
      'Les barres affichent combien de médias rapportent chaque sujet',
    );
  });

  it('carries the bar’s Exposition shares when there is exactly one bar', () => {
    expect(announcement('exposure', document)).toBe(
      'Les barres affichent la part de lecteurs touchés par chaque média pour un sujet' +
        ' — Gauche 68\u202F%, Droite 32\u202F%',
    );
  });

  it('stays on the mode alone when there are many bars (the index)', () => {
    document.body.insertAdjacentHTML('beforeend', coverageBarHtml());
    expect(announcement('exposure', document)).toBe(
      'Les barres affichent la part de lecteurs touchés par chaque média pour un sujet',
    );
  });
});

describe('installModeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = toggleHtml() + coverageBarHtml();
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  const installed = () => {
    installModeToggle(document, window);
    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    ];
    return {
      coverage: buttons[0],
      exposure: buttons[1],
      live: document.querySelector('[data-mode-live]')!,
    };
  };

  it('restores the stored mode without announcing', () => {
    localStorage.setItem('prisme:mode', 'exposure');
    const { coverage, exposure, live } = installed();
    expect(document.documentElement.dataset.mode).toBe('exposure');
    expect(coverage.getAttribute('aria-checked')).toBe('false');
    expect(coverage.tabIndex).toBe(-1);
    expect(exposure.getAttribute('aria-checked')).toBe('true');
    expect(exposure.tabIndex).toBe(0);
    expect(live.textContent).toBe('');
  });

  it('defaults to Couverture with no attribute on <html>', () => {
    const { exposure } = installed();
    expect(document.documentElement.dataset.mode).toBeUndefined();
    expect(exposure.getAttribute('aria-checked')).toBe('false');
  });

  it('follows clicks and persists the choice', () => {
    const { exposure, live } = installed();
    exposure.click();
    expect(document.documentElement.dataset.mode).toBe('exposure');
    expect(localStorage.getItem('prisme:mode')).toBe('exposure');
    expect(live.textContent).toBe(
      'Les barres affichent la part de lecteurs touchés par chaque média pour un sujet' +
        ' — Gauche 68\u202F%, Droite 32\u202F%',
    );
  });

  it('flips when clicking anywhere, including the checked option', () => {
    const { coverage, exposure } = installed();
    // The rapid-comparison gesture: the same click spot flips both ways.
    coverage.click();
    expect(document.documentElement.dataset.mode).toBe('exposure');
    exposure.click();
    expect(document.documentElement.dataset.mode).toBeUndefined();
    // The track is part of the control too.
    document
      .querySelector('[data-mode-toggle]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.documentElement.dataset.mode).toBe('exposure');
    expect(exposure.getAttribute('aria-checked')).toBe('true');
  });

  it('follows arrow keys, selecting and focusing the next option', () => {
    const { coverage, exposure } = installed();
    coverage.focus();
    coverage.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    expect(document.documentElement.dataset.mode).toBe('exposure');
    expect(exposure.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(exposure);
  });

  it('whispers on the first four switches, describing the destination', () => {
    const { exposure, coverage } = installed();
    const whisper = document.querySelector('[data-mode-whisper]')!;
    exposure.click();
    expect(whisper.textContent).toBe(
      'Les barres affichent la part de lecteurs touchés par chaque média pour un sujet',
    );
    expect(whisper.classList.contains('is-shown')).toBe(true);
    coverage.click();
    expect(whisper.textContent).toBe(
      'Les barres affichent combien de médias rapportent chaque sujet',
    );
    expect(whisper.classList.contains('is-shown')).toBe(true);
    exposure.click();
    coverage.click();
    expect(whisper.classList.contains('is-shown')).toBe(true);
    expect(localStorage.getItem('prisme:mode-whisper')).toBe('4');
  });

  it('stops whispering after four switches, for good', () => {
    const { exposure, coverage } = installed();
    const whisper = document.querySelector('[data-mode-whisper]')!;
    exposure.click();
    coverage.click();
    exposure.click();
    coverage.click();
    // The fade-out would remove the class after ~6s; simulate it so the
    // fifth switch can't hide behind a lingering .is-shown.
    whisper.classList.remove('is-shown');
    exposure.click();
    expect(whisper.classList.contains('is-shown')).toBe(false);
    expect(whisper.textContent).toBe(
      'Les barres affichent combien de médias rapportent chaque sujet',
    );
    expect(localStorage.getItem('prisme:mode-whisper')).toBe('4');
  });

  it('carries the whisper count across installs (visits)', () => {
    localStorage.setItem('prisme:mode-whisper', String(WHISPER_LIMIT));
    const { exposure } = installed();
    const whisper = document.querySelector('[data-mode-whisper]')!;
    exposure.click();
    expect(whisper.textContent).toBe('');
    expect(whisper.classList.contains('is-shown')).toBe(false);
  });

  it('never whispers on the initial restore', () => {
    localStorage.setItem('prisme:mode', 'exposure');
    installed();
    const whisper = document.querySelector('[data-mode-whisper]')!;
    expect(whisper.textContent).toBe('');
    expect(whisper.classList.contains('is-shown')).toBe(false);
  });

  it('whispers the mode alone, never the Story-page shares', () => {
    const { exposure } = installed();
    const whisper = document.querySelector('[data-mode-whisper]')!;
    exposure.click();
    expect(whisper.textContent).not.toContain('Gauche');
  });

  it('ignores keys that are not radio navigation', () => {
    const { coverage, exposure } = installed();
    coverage.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', bubbles: true }),
    );
    expect(coverage.getAttribute('aria-checked')).toBe('true');
    expect(exposure.getAttribute('aria-checked')).toBe('false');
  });

  it('does nothing on a page without the toggle', () => {
    document.body.innerHTML = '';
    expect(() => installModeToggle(document, window)).not.toThrow();
  });

  it('survives a broken localStorage', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { exposure } = installed();
    expect(() => exposure.click()).not.toThrow();
    expect(document.documentElement.dataset.mode).toBe('exposure');
  });
});
