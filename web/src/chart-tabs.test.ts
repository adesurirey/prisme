// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { initChartTabs, selectChartTab } from './chart-tabs';

/** The markup contract ChartTabs.astro implements, shrunk to the fields
 *  the logic reads. */
const markup = () => `
  <div data-chart-tabs class="chart-tabs">
    <div role="tablist">
      <button type="button" role="tab" data-chart-tab="columns"
        aria-controls="panel-columns" aria-selected="true">Colonnes</button>
      <button type="button" role="tab" data-chart-tab="audience"
        aria-controls="panel-audience" aria-selected="false">Par audience</button>
    </div>
    <div role="tabpanel" id="panel-columns">Colonnes chart</div>
    <div role="tabpanel" id="panel-audience" hidden>Audience chart</div>
  </div>
`;

afterEach(() => document.body.replaceChildren());

describe('selectChartTab', () => {
  it('shows the chosen panel and hides the others, all rendered in the HTML', () => {
    document.body.innerHTML = markup();
    const root = document.querySelector('[data-chart-tabs]')!;

    expect(
      (document.getElementById('panel-columns') as HTMLElement).hidden,
    ).toBe(false);
    selectChartTab(root, 'audience');
    expect(
      (document.getElementById('panel-audience') as HTMLElement).hidden,
    ).toBe(false);
    expect(
      (document.getElementById('panel-columns') as HTMLElement).hidden,
    ).toBe(true);
    // Both panels stay in the DOM — only visibility toggled.
    expect(document.getElementById('panel-audience')).toBeTruthy();
    expect(document.getElementById('panel-columns')).toBeTruthy();
  });

  it('syncs aria-selected across the tabs and moves the sliding card', () => {
    document.body.innerHTML = markup();
    const root = document.querySelector('[data-chart-tabs]') as HTMLElement;
    selectChartTab(root, 'audience');
    const selected = [...root.querySelectorAll('[role="tab"]')].map((t) =>
      t.getAttribute('aria-selected'),
    );
    expect(selected).toEqual(['false', 'true']);
    // The container attribute drives the `.chart-tabs::before` transform
    // in global.css — the card slides under the checked label.
    expect(root.dataset.chartTab).toBe('audience');
    selectChartTab(root, 'columns');
    expect(root.dataset.chartTab).toBe('columns');
  });

  it('switching back to the first tab restores it', () => {
    document.body.innerHTML = markup();
    const root = document.querySelector('[data-chart-tabs]')!;
    selectChartTab(root, 'audience');
    selectChartTab(root, 'columns');
    expect(
      (document.getElementById('panel-columns') as HTMLElement).hidden,
    ).toBe(false);
    expect(
      (document.getElementById('panel-audience') as HTMLElement).hidden,
    ).toBe(true);
  });
});

describe('initChartTabs', () => {
  it('wires clicks to the tab switch', () => {
    document.body.innerHTML = markup();
    const root = document.querySelector('[data-chart-tabs]')!;
    initChartTabs(root);

    const audience = root.querySelector<HTMLButtonElement>(
      '[data-chart-tab="audience"]',
    )!;
    audience.click();

    expect(
      (document.getElementById('panel-audience') as HTMLElement).hidden,
    ).toBe(false);
    expect(audience.getAttribute('aria-selected')).toBe('true');
  });
});
