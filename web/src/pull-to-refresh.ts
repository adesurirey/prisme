/**
 * Pull-to-refresh (issue #66): pull down past an arming threshold on any page
 * to reload it and get the newest Edition. Releasing below the threshold does
 * nothing. No visual indicator — the reload itself is the feedback. Uniform on
 * every page, including frozen Story pages.
 *
 * The gesture logic lives in pure functions below (unit-tested); `install`
 * wires them to touch events on `document`.
 */

/** Pull distance, in px, past which release reloads the page. */
export const ARM_THRESHOLD_PX = 80;
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
 * Reduce one touchmove sample into the next drag state. Returns the updated
 * state; callers read `.armed` on touchend.
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

/**
 * Decide what a touchend means for an armed-or-not drag: past the threshold
 * the page reloads, otherwise nothing happens.
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
};

/**
 * Wire the gesture to touch events. Idempotent per document: the second and
 * later calls return without adding listeners.
 */
export function installPullToRefresh(
  doc: Document,
  win: Window,
  options: PullToRefreshOptions = {},
): void {
  const armThresholdPx = options.armThresholdPx ?? ARM_THRESHOLD_PX;
  if (doc.body.dataset.pullToRefreshInstalled) return;
  doc.body.dataset.pullToRefreshInstalled = 'true';

  const freshState = (): DragState => ({
    startY: null,
    startX: 0,
    armed: false,
    abandoned: false,
  });

  let state: DragState = freshState();

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
      state = reduceMove(
        state,
        {
          dy,
          dx,
          scrollY: win.scrollY,
          touches: event.touches.length,
        },
        armThresholdPx,
      );
    },
    { passive: true },
  );

  doc.addEventListener(
    'touchend',
    () => {
      if (state.startY === null) return;
      const outcome = resolveRelease(state);
      state = freshState();
      if (outcome === 'reload') {
        // Fresh HTML from the network or the service worker; full reload, no
        // history entry, so Back still leaves the page.
        win.location.reload();
      }
    },
    { passive: true },
  );

  doc.addEventListener('touchcancel', () => {
    state = freshState();
  });
}
