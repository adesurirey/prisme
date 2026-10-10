/**
 * Pull-to-refresh (issue #66): pull down past an arming threshold on any page
 * to reload it and get the newest Edition; release below the threshold and the
 * indicator springs back. Uniform on every page, including frozen Story pages.
 *
 * The gesture logic lives in pure functions below (unit-tested); `install`
 * wires them to touch events on `document`.
 */

/** Pull distance, in px, past which release reloads the page. */
const ARM_THRESHOLD_PX = 80;
/** Pull distance at which damping caps the indicator, in px. */
const MAX_INDICATOR_PX = 120;
/** Horizontal travel beyond which the gesture is abandoned. */
const SLOP_PX = 24;

export type DragState = {
  /** touchstart Y, or null when no pull is armed. */
  startY: number | null;
  startX: number;
  /** Whether the pull has passed the arming threshold. */
  armed: boolean;
  /** Whether a horizontal drag or anything else vetoed this gesture. */
  abandoned: boolean;
};

export type DragEventInput = {
  /** Vertical travel since touchstart, positive when pulling down. */
  dy: number;
  dx: number;
  /** Current vertical scroll offset of the page. */
  scrollY: number;
  /** Number of active touch points (a second finger vetoes the gesture). */
  touches: number;
};

/**
 * Reduce one touchmove sample into the next drag state. The indicator is
 * damped: each further px moves it less, and it stops at MAX_INDICATOR_PX.
 * Returns the updated state; callers read `.armed` on touchend.
 */
export function reduceMove(
  state: DragState,
  { dy, dx, scrollY, touches }: DragEventInput,
  armThresholdPx: number = ARM_THRESHOLD_PX,
): DragState {
  if (state.abandoned) return state;
  // Multi-touch is never a pull: a pinch or a stray second finger vetoes.
  if (touches !== 1) return { ...state, abandoned: true, armed: false };
  // Horizontal drags are scrolls, not pulls.
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SLOP_PX) {
    return { ...state, abandoned: true, armed: false };
  }
  // The page only reloads when pulled from the very top; a pull that starts
  // while scrolled down is just the page moving under the finger.
  if (state.startY === null || scrollY > 0 || dy <= 0) {
    return state;
  }
  const armed = dy >= armThresholdPx;
  return { ...state, armed };
}

/** Damped indicator offset for a pull of `dy` px. */
export function indicatorOffset(dy: number): number {
  if (dy <= 0) return 0;
  if (dy >= MAX_INDICATOR_PX) return MAX_INDICATOR_PX;
  // Quadratic damping: fast feedback at the top of the pull, resistive tail.
  return Math.round(MAX_INDICATOR_PX * (1 - (1 - dy / MAX_INDICATOR_PX) ** 2));
}

/**
 * Decide what a touchend means for an armed-or-not drag.
 * `reload` wins: past the threshold the page reloads; otherwise the
 * indicator just springs back.
 */
export function resolveRelease(state: DragState): 'reload' | 'reset' {
  return state.armed && !state.abandoned ? 'reload' : 'reset';
}

/**
 * A pull must not start inside an inner scrollable element (a horizontally or
 * vertically scrollable region owns the gesture). Returns true when the
 * touched element, or an ancestor, is an inner scroll container.
 */
export function startsInInnerScroller(target: Element | null): boolean {
  let node: Element | null = target;
  while (node && node !== document.documentElement) {
    const el = node;
    const style = getComputedStyle(el);
    const scrollable = (axisName: 'X' | 'Y') => {
      const axis = axisName === 'Y' ? 'y' : 'x';
      const overflow = style.getPropertyValue(`overflow-${axis}`);
      return (
        (overflow === 'auto' || overflow === 'scroll') &&
        (axisName === 'Y'
          ? el.scrollHeight > el.clientHeight
          : el.scrollWidth > el.clientWidth)
      );
    };
    if (scrollable('Y') || scrollable('X')) return true;
    node = el.parentElement;
  }
  return false;
}

export type PullToRefreshOptions = {
  armThresholdPx?: number;
  maxIndicatorPx?: number;
};

/**
 * Wire the gesture to touch events. Idempotent per document: the second and
 * later calls return without adding listeners. The indicator element doubles
 * as the installed marker.
 */
export function installPullToRefresh(
  doc: Document,
  win: Window,
  options: PullToRefreshOptions = {},
): void {
  const armThresholdPx = options.armThresholdPx ?? ARM_THRESHOLD_PX;
  const maxIndicatorPx = options.maxIndicatorPx ?? MAX_INDICATOR_PX;
  if (doc.getElementById('pull-to-refresh-indicator')) return;

  const reducedMotion = win.matchMedia('(prefers-reduced-motion: reduce)');

  const indicator = doc.createElement('div');
  indicator.id = 'pull-to-refresh-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.style.cssText = [
    'position:fixed',
    'top:10px',
    'left:50%',
    'width:34px',
    'height:34px',
    'margin-left:-17px',
    'border-radius:9999px',
    'border:2.5px solid currentColor',
    'border-top-color:transparent',
    'opacity:0',
    'pointer-events:none',
    'z-index:100',
    'color:var(--color-ink, #0e0e10)',
    'transform:translateY(-60px)',
  ].join(';');
  doc.body.appendChild(indicator);

  const setIndicator = (offsetY: number, opacity: number, spin: boolean) => {
    // Reduced motion: no bouncy damping or spin — a static, fading indicator.
    const motion = !reducedMotion.matches;
    indicator.style.transform = `translateY(${offsetY - 60}px) rotate(${
      motion && spin ? `${offsetY * 4}deg` : '0deg'
    })`;
    indicator.style.opacity = String(opacity);
    indicator.style.transition = motion
      ? 'transform 60ms linear, opacity 120ms ease'
      : 'opacity 120ms ease';
  };

  let state: DragState = {
    startY: null,
    startX: 0,
    armed: false,
    abandoned: false,
  };

  doc.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length !== 1) return;
      const target = event.target instanceof Element ? event.target : null;
      if (startsInInnerScroller(target)) return;
      const touch = event.touches[0];
      if (!touch) return;
      state = {
        startY: touch.clientY,
        startX: touch.clientX,
        armed: false,
        abandoned: false,
      };
    },
    { passive: true },
  );

  doc.addEventListener(
    'touchmove',
    (event) => {
      if (state.startY === null) return;
      const touch = event.touches[0];
      if (!touch) return;
      const dy = touch.clientY - state.startY;
      const dx = touch.clientX - state.startX;
      const next = reduceMove(
        state,
        {
          dy,
          dx,
          scrollY: win.scrollY,
          touches: event.touches.length,
        },
        armThresholdPx,
      );
      state = next;
      if (next.abandoned || dy <= 0) {
        setIndicator(0, 0, false);
        return;
      }
      const offset = Math.min(indicatorOffset(dy), maxIndicatorPx);
      setIndicator(offset, Math.min(1, offset / 20), true);
    },
    { passive: true },
  );

  doc.addEventListener(
    'touchend',
    () => {
      if (state.startY === null) return;
      const outcome = resolveRelease(state);
      state = { startY: null, startX: 0, armed: false, abandoned: false };
      if (outcome === 'reload') {
        // Fresh HTML from the network or the service worker; full reload, no
        // history entry, so Back still leaves the page.
        win.location.reload();
        return;
      }
      // Spring back — suppressed under reduced motion, which only fades out.
      setIndicator(0, 0, false);
    },
    { passive: true },
  );

  doc.addEventListener('touchcancel', () => {
    state = { startY: null, startX: 0, armed: false, abandoned: false };
    setIndicator(0, 0, false);
  });
}
