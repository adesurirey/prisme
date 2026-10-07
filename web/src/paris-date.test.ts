import { describe, expect, it } from 'vitest';

import { formatParisDate } from './paris-date';

describe('formatParisDate', () => {
  // 2026-10-07 16:50 UTC is 18:50 in Paris and 12:50 in a UTC-4 host;
  // the format must follow Paris regardless of the machine timezone.
  const instant = new Date('2026-10-07T16:50:00Z');

  it('renders the Paris clock time, not the host timezone', () => {
    expect(
      formatParisDate(instant, { hour: '2-digit', minute: '2-digit' }),
    ).toBe('18:50');
  });

  it('crosses a Paris day boundary with the date, never silently', () => {
    // 2026-10-07 22:30 UTC is already 8 October in Paris.
    const late = new Date('2026-10-07T22:30:00Z');
    expect(formatParisDate(late, { day: 'numeric', month: 'long' })).toBe(
      '8 octobre',
    );
  });
});
