import { describe, expect, it } from 'vitest';
import { resolveArchiveTarget } from './archive-date-nav';

/**
 * Access by date from the home (issue #99, ADR-0017): the picker opens the
 * archive of the chosen day; a date without a record falls back to the
 * newest day with one; before the oldest record, the oldest day.
 */

describe('resolveArchiveTarget', () => {
  it('opens the archive of the chosen day', () => {
    expect(resolveArchiveTarget('2026-10-13', ['2026-10-13'], '/prisme')).toBe(
      '/prisme/2026-10-13/',
    );
  });

  it('snaps a day without a record to the nearest day with one (newer)', () => {
    expect(resolveArchiveTarget('2026-10-14', ['2026-10-13'], '/prisme')).toBe(
      '/prisme/2026-10-13/',
    );
  });

  it('falls back to the oldest day when the date predates all records', () => {
    expect(
      resolveArchiveTarget('2026-10-01', ['2026-10-13', '2026-10-12'], ''),
    ).toBeNull();
    expect(
      resolveArchiveTarget(
        '2026-10-01',
        ['2026-10-13', '2026-10-12'],
        '/prisme',
      ),
    ).toBe('/prisme/2026-10-12/');
  });

  it('refuses anything that is not a day key, an empty list or no base', () => {
    expect(resolveArchiveTarget('', ['2026-10-13'], '/prisme')).toBeNull();
    expect(
      resolveArchiveTarget('14/10/2026', ['2026-10-13'], '/prisme'),
    ).toBeNull();
    expect(resolveArchiveTarget('2026-10-13', [], '/prisme')).toBeNull();
    expect(resolveArchiveTarget('2026-10-13', ['2026-10-13'], '')).toBeNull();
  });
});
