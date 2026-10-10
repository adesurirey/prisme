// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
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

  beforeEach(() => {
    document.body.innerHTML = '';
    // jsdom reuses this document across tests; clear the install marker so
    // each test exercises a fresh install.
    delete document.body.dataset.pullToRefreshInstalled;
    reload = vi.fn();
    win = {
      scrollY: 0,
      location: { reload },
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

  it('installs exactly once across repeated calls', () => {
    installPullToRefresh(document, win);
    installPullToRefresh(document, win);
    // No duplicate listeners: one reload per qualifying gesture.
    startAt(100);
    touch(document, 'touchmove', [{ clientY: 300, clientX: 200 }]);
    touch(document, 'touchend', []);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('reloads after a pull past the threshold from the top', () => {
    startAt(100);
    touch(document, 'touchmove', [{ clientY: 190, clientX: 200 }]);
    touch(document, 'touchend', []);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('does nothing below the threshold', () => {
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

  it('does not reload when the page is scrolled down', () => {
    (win as unknown as { scrollY: number }).scrollY = 60;
    startAt(100);
    touch(document, 'touchmove', [{ clientY: 300, clientX: 200 }]);
    touch(document, 'touchend', []);
    expect(reload).not.toHaveBeenCalled();
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

  it('never adds any visual element to the page', () => {
    expect(document.body.children).toHaveLength(1); // only the test's `base`
  });
});
