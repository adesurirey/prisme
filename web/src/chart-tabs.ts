/**
 * The classement page's chart tabs: the same tab UX as the Story pages'
 * PrismTabs, but as plain DOM — the two charts are server-rendered
 * `.astro` markup, so the toggle stays vanilla and the logic lives here,
 * testable without a framework renderer. Both panels are always in the
 * HTML — only visibility toggles — so the charts stay indexable and
 * readable without JavaScript, like PrismTabs promises.
 *
 * The markup contract (see ChartTabs.astro): a container with
 * `data-chart-tabs`, buttons `[role="tab"][data-chart-tab]` whose
 * `aria-controls` points at the panel element they toggle.
 */

/** The two views. The values are the DOM `data-chart-tab` keys shared by
 *  the tab buttons and the `.chart-tabs` card selector in global.css —
 *  code keys are English (AGENTS.md); the French labels live in the
 *  component's markup. */
export type ChartView = 'columns' | 'audience';

/** Show the panel for `key`, hide the others, sync the tabs'
 *  `aria-selected`, and move the sliding card: the container's
 *  `data-chart-tab` attribute drives the `.chart-tabs::before` transform
 *  in global.css (the same mechanism as the reading toggle's
 *  `<html data-mode>`). */
export function selectChartTab(root: ParentNode, key: ChartView): void {
  (root as HTMLElement).dataset.chartTab = key;
  const tabs = root.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  for (const tab of tabs) {
    const selected = tab.dataset.chartTab === key;
    tab.setAttribute('aria-selected', String(selected));
    const panelId = tab.getAttribute('aria-controls');
    const panel = panelId
      ? root.querySelector<HTMLElement>(`#${panelId}`)
      : null;
    if (panel) panel.hidden = !selected;
  }
}

/** Wire every tab click inside `root` to `selectChartTab`. */
export function initChartTabs(root: ParentNode): void {
  for (const tab of root.querySelectorAll<HTMLButtonElement>('[role="tab"]')) {
    tab.addEventListener('click', () =>
      selectChartTab(root, tab.dataset.chartTab as ChartView),
    );
  }
}
