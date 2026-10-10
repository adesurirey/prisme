// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  indicatorOffset,
  installPullToRefresh,
  reduceMove,
  resolveRelease,
} from './pull-to-refresh';

const armedState = {
  startY: 100,
  startX: 200,
  armed: false,
  abandoned: false,
};

describe('reduceMove', () => {
  it('arms past the threshold', () => {
    const next = reduceMove(armedState, {
      dy: 80,
      dx: 0,
      scrollY: 0,
      touches: 1,
    });
    expect(next.armed).toBe(true);
    expect(next.abandoned).toBe(false);
  });

  it('stays disarmed below the threshold', () => {
    const next = reduceMove(armedState, {
      dy: 79,
      dx: 0,
      scrollY: 0,
      touches: 1,
    });
    expect(next.armed).toBe(false);
  });

  it('abandons the gesture on multi-touch', () => {
    const next = reduceMove(armedState, {
      dy: 120,
      dx: 0,
      scrollY: 0,
      touches: 2,
    });
    expect(next.abandoned).toBe(true);
    expect(next.armed).toBe(false);
  });

  it('abandons on a horizontal drag', () => {
    const next = reduceMove(armedState, {
      dy: 10,
      dx: 60,
      scrollY: 0,
      touches: 1,
    });
    expect(next.abandoned).toBe(true);
  });

  it('does not arm while the page is scrolled down', () => {
    const next = reduceMove(armedState, {
      dy: 200,
      dx: 0,
      scrollY: 50,
      touches: 1,
    });
    expect(next.armed).toBe(false);
    expect(next.abandoned).toBe(false);
  });

  it('ignores upward drags', () => {
    const next = reduceMove(armedState, {
      dy: -40,
      dx: 0,
      scrollY: 0,
      touches: 1,
    });
    expect(next.armed).toBe(false);
  });

  it('stays abandoned once vetoed', () => {
    const vetoed = reduceMove(armedState, {
      dy: 10,
      dx: 60,
      scrollY: 0,
      touches: 1,
    });
    const next = reduceMove(vetoed, { dy: 200, dx: 0, scrollY: 0, touches: 1 });
    expect(next.abandoned).toBe(true);
    expect(next.armed).toBe(false);
  });
});

describe('indicatorOffset', () => {
  it('is zero for zero and upward pulls', () => {
    expect(indicatorOffset(0)).toBe(0);
    expect(indicatorOffset(-30)).toBe(0);
  });

  it('is damped: early pull moves faster than late pull', () => {
    // 0→20 px of finger travel moves the indicator ~37px; 100→120 moves it
    // only ~3px — the resistive tail of the quadratic damping.
    expect(indicatorOffset(20) - indicatorOffset(0)).toBeGreaterThan(
      indicatorOffset(120) - indicatorOffset(100),
    );
  });

  it('caps at the max indicator distance', () => {
    expect(indicatorOffset(500)).toBe(120);
  });
});

describe('resolveRelease', () => {
  it('reloads an armed drag', () => {
    expect(resolveRelease({ ...armedState, armed: true })).toBe('reload');
  });

  it('resets a disarmed drag', () => {
    expect(resolveRelease(armedState)).toBe('reset');
  });

  it('resets an abandoned drag even if armed before the veto', () => {
    expect(
      resolveRelease({ ...armedState, armed: true, abandoned: true }),
    ).toBe('reset');
  });
});

describe('installPullToRefresh', () => {
  let win: Window;
  let reload: ReturnType<typeof vi.fn>;
  let base: HTMLElement;
  let innerScroller: HTMLElement;

  /**
   * jsdom has no usable TouchEvent constructor, so dispatch a plain Event
   * with a `touches` list patched on — the script only reads that list.
   */
  const touch = (
    element: EventTarget,
    type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
    points: Array<{ clientY: number; clientX: number }>,
  ) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', { value: points });
    element.dispatchEvent(event);
  };

  const startAt = (y: number, target: EventTarget = base) =>
    touch(target, 'touchstart', [{ clientY: y, clientX: 200 }]);

  const indicator = () =>
    document.getElementById('pull-to-refresh-indicator') as HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    reload = vi.fn();
    win = {
      scrollY: 0,
      location: { reload },
      matchMedia: () => ({ matches: false }) as unknown as MediaQueryList,
    } as unknown as Window;

    base = document.createElement('div');
    innerScroller = document.createElement('div');
    innerScroller.style.overflowY = 'auto';
    for (let i = 0; i < 20; i++) {
      innerScroller.appendChild(document.createElement('p'));
    }
    base.appendChild(innerScroller);
    document.body.appendChild(base);

    // jsdom gives every element zero size; make the inner scroller actually
    // scrollable for startsInInnerScroller's overflow checks.
    vi.spyOn(innerScroller, 'scrollHeight', 'get').mockReturnValue(1000);
    vi.spyOn(innerScroller, 'clientHeight', 'get').mockReturnValue(100);

    installPullToRefresh(document, win);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates exactly one indicator across repeated installs', () => {
    installPullToRefresh(document, win);
    installPullToRefresh(document, win);
    expect(
      document.querySelectorAll('#pull-to-refresh-indicator'),
    ).toHaveLength(1);
  });

  it('reloads after a pull past the threshold from the top', () => {
    startAt(100);
    touch(document, 'touchmove', [{ clientY: 190, clientX: 200 }]);
    touch(document, 'touchend', []);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('springs back (no reload) below the threshold', () => {
    startAt(100);
    touch(document, 'touchmove', [{ clientY: 150, clientX: 200 }]);
    touch(document, 'touchend', []);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload when the gesture starts in an inner scroller', () => {
    startAt(100, innerScroller);
    touch(document, 'touchmove', [{ clientY: 300, clientX: 200 }]);
    touch(document, 'touchend', []);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload on multi-touch', () => {
    startAt(100);
    touch(document, 'touchmove', [
      { clientY: 300, clientX: 200 },
      { clientY: 300, clientX: 260 },
    ]);
    touch(document, 'touchend', []);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload when the page is scrolled down, and shows no indicator', () => {
    (win as unknown as { scrollY: number }).scrollY = 60;
    startAt(100);
    touch(document, 'touchmove', [{ clientY: 300, clientX: 200 }]);
    expect(indicator().style.opacity).toBe('0');
    touch(document, 'touchend', []);
    expect(reload).not.toHaveBeenCalled();
  });

  it('shows a damped indicator mid-pull at the top of the page', () => {
    startAt(100);
    touch(document, 'touchmove', [{ clientY: 150, clientX: 200 }]);
    expect(indicator().style.opacity).not.toBe('0');
  });

  it('does not reload on a horizontal drag', () => {
    startAt(100);
    touch(document, 'touchmove', [{ clientY: 110, clientX: 400 }]);
    touch(document, 'touchend', []);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload from a plain tap', () => {
    startAt(100);
    touch(document, 'touchmove', [{ clientY: 100, clientX: 200 }]);
    touch(document, 'touchend', []);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload on touchcancel', () => {
    startAt(100);
    touch(document, 'touchmove', [{ clientY: 300, clientX: 200 }]);
    touch(document, 'touchcancel', []);
    touch(document, 'touchend', []);
    expect(reload).not.toHaveBeenCalled();
  });

  it('keeps the fetch but drops the bouncy animation under prefers-reduced-motion', async () => {
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('<body></body>');
    const reducedWin = {
      scrollY: 0,
      location: { reload: vi.fn() },
      matchMedia: () => ({ matches: true }) as unknown as MediaQueryList,
    } as unknown as Window;
    installPullToRefresh(dom.window.document, reducedWin);
    const el = dom.window.document.getElementById(
      'pull-to-refresh-indicator',
    ) as HTMLElement;

    startAt(100, dom.window.document);
    touch(dom.window.document, 'touchmove', [{ clientY: 300, clientX: 200 }]);
    // The indicator still appears (the gesture works)…
    expect(el.style.opacity).not.toBe('0');
    // …but its transition only fades opacity: no damped transform, no spin.
    expect(el.style.transition).toContain('opacity');
    expect(el.style.transition).not.toContain('transform');
    expect(el.style.transform).not.toMatch(/rotate\((?!0deg\))/);

    touch(dom.window.document, 'touchend', []);
    expect(reducedWin.location.reload).toHaveBeenCalledOnce();
  });
});
