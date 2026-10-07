// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import PrismTabs from './PrismTabs';

afterEach(cleanup);

const COVERED = {
  counts: { gauche: 2, centre: 1, droite: 3 },
  summaries: {
    gauche: ['Lu à gauche'],
    centre: ['Lu au centre'],
    droite: ['Lu à droite'],
  },
  differences: 'La droite insiste sur X.',
};

describe('PrismTabs', () => {
  it('renders all four panels into the HTML at once, so they can be indexed', () => {
    render(<PrismTabs {...COVERED} />);
    expect(screen.getByText('Lu à gauche')).toBeTruthy();
    expect(screen.getByText('Lu au centre')).toBeTruthy();
    expect(screen.getByText('Lu à droite')).toBeTruthy();
    expect(screen.getByText('La droite insiste sur X.')).toBeTruthy();
  });

  it('derives "Non couvert par …" from zero Coverage — never invented', () => {
    render(
      <PrismTabs
        counts={{ gauche: 0, centre: 1, droite: 0 }}
        summaries={{ centre: ['Lu au centre'] }}
        differences="Seul le centre couvre le sujet."
      />,
    );
    expect(screen.getByText('Non couvert par la gauche')).toBeTruthy();
    expect(screen.getByText('Non couvert par la droite')).toBeTruthy();
    expect(screen.queryByText('Lu à gauche')).toBeNull();
    expect(screen.queryByText('Lu à droite')).toBeNull();
  });

  it('defaults to Centre when it has a summary, else the first covered Leaning', () => {
    const { unmount: unmountA } = render(<PrismTabs {...COVERED} />);
    const centrePanelA = screen
      .getByText('Lu au centre')
      .closest('[role="tabpanel"]')!;
    expect(centrePanelA.hasAttribute('hidden')).toBe(false);
    unmountA();

    // Centre covered but without a summary: falls back to first covered.
    render(
      <PrismTabs
        counts={{ gauche: 2, centre: 1, droite: 3 }}
        summaries={{ gauche: ['Lu à gauche'], droite: ['Lu à droite'] }}
        differences="X."
      />,
    );
    const gauchePanel = screen
      .getByText('Lu à gauche')
      .closest('[role="tabpanel"]')!;
    expect(gauchePanel.hasAttribute('hidden')).toBe(false);
  });

  it('switches the visible panel on tab click and only that panel', () => {
    render(<PrismTabs {...COVERED} />);
    const droiteTab = screen.getByRole('tab', { name: 'Droite' });
    const centrePanel = screen
      .getByText('Lu au centre')
      .closest('[role="tabpanel"]')!;
    const droitePanel = screen
      .getByText('Lu à droite')
      .closest('[role="tabpanel"]')!;

    expect(centrePanel.hasAttribute('hidden')).toBe(false);
    expect(droitePanel.hasAttribute('hidden')).toBe(true);

    fireEvent.click(droiteTab);
    expect(centrePanel.hasAttribute('hidden')).toBe(true);
    expect(droitePanel.hasAttribute('hidden')).toBe(false);
    expect(droiteTab.getAttribute('aria-selected')).toBe('true');
  });

  it('shows an honest placeholder for a covered Leaning whose Summaries are missing', () => {
    render(
      <PrismTabs
        counts={{ gauche: 1, centre: 0, droite: 0 }}
        summaries={undefined}
        differences={undefined}
      />,
    );
    expect(screen.getByText('Résumé indisponible.')).toBeTruthy();
    expect(screen.getByText('Différences indisponibles.')).toBeTruthy();
  });
});
