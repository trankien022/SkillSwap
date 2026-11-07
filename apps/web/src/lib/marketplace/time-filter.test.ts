import { describe, expect, it } from 'vitest';
import { matchesTimeFilter } from './time-filter';

/**
 * The predicate both gateways import. Tested directly with an injected `now` so the weekend
 * boundary is deterministic — a test that depends on the day it runs is worse than no test.
 */

const HOUR = 60 * 60 * 1000;
/** Wednesday 2026-11-11 12:00 UTC, deliberately mid-week and mid-day. */
const NOW = new Date('2026-11-11T12:00:00.000Z');

function inHours(hours: number): string {
  return new Date(NOW.getTime() + hours * HOUR).toISOString();
}

describe('matchesTimeFilter', () => {
  describe('all-valid', () => {
    it('accepts a class exactly 24h away, matching the server boundary', () => {
      // The API accepts `starts_at >= now + 24h`; a stricter `>` here would hide a bookable class.
      expect(matchesTimeFilter(inHours(24), 'all-valid', NOW)).toBe(true);
    });

    it('rejects a class inside the 24-hour booking window (BR-021)', () => {
      expect(matchesTimeFilter(inHours(23.9), 'all-valid', NOW)).toBe(false);
      expect(matchesTimeFilter(inHours(1), 'all-valid', NOW)).toBe(false);
      expect(matchesTimeFilter(inHours(-5), 'all-valid', NOW)).toBe(false);
    });
  });

  describe('next-24-48h', () => {
    it('keeps only the 24-48h band', () => {
      expect(matchesTimeFilter(inHours(24), 'next-24-48h', NOW)).toBe(true);
      expect(matchesTimeFilter(inHours(36), 'next-24-48h', NOW)).toBe(true);
      expect(matchesTimeFilter(inHours(48), 'next-24-48h', NOW)).toBe(true);
      expect(matchesTimeFilter(inHours(48.1), 'next-24-48h', NOW)).toBe(false);
      expect(matchesTimeFilter(inHours(23.9), 'next-24-48h', NOW)).toBe(false);
    });
  });

  describe('this-weekend', () => {
    // 2026-11-14 is a Saturday, 2026-11-15 a Sunday, 2026-11-16 a Monday.
    const saturday = '2026-11-14T04:00:00.000Z';
    const sunday = '2026-11-15T04:00:00.000Z';
    const monday = '2026-11-16T04:00:00.000Z';
    const friday = '2026-11-13T04:00:00.000Z';

    it('keeps Saturday and Sunday', () => {
      expect(matchesTimeFilter(saturday, 'this-weekend', NOW)).toBe(true);
      expect(matchesTimeFilter(sunday, 'this-weekend', NOW)).toBe(true);
    });

    it('drops weekdays', () => {
      expect(matchesTimeFilter(friday, 'this-weekend', NOW)).toBe(false);
      expect(matchesTimeFilter(monday, 'this-weekend', NOW)).toBe(false);
    });

    it('drops a weekend class that is not yet bookable (BR-021)', () => {
      const saturdayInSixHours = '2026-11-14T18:00:00.000Z';
      const now = new Date('2026-11-14T12:00:00.000Z');
      expect(matchesTimeFilter(saturdayInSixHours, 'this-weekend', now)).toBe(false);
    });
  });
});
