import { describe, expect, it } from 'vitest';
import {
  formatSeats,
  formatStartsAt,
  hoursUntilBookingDeadline,
  demoMarketplaceClasses,
} from '../../lib/marketplace/mock-data';
import type { MarketplaceClass } from '../../lib/marketplace/types';

describe('ClassCard helpers (content-guard at the data layer)', () => {
  const items = demoMarketplaceClasses();

  it('all seeded items satisfy the FR-005 capacity/duration invariants', () => {
    for (const item of items) {
      expect(item.capacity).toBeGreaterThanOrEqual(1);
      expect(item.durationMinutes).toBeGreaterThanOrEqual(30);
      expect(item.durationMinutes).toBeLessThanOrEqual(180);
      expect(item.priceCredits).toBeGreaterThan(0);
      expect(Number.isInteger(item.priceCredits)).toBe(true);
      expect(item.state).toBe('published');
    }
  });

  it('formatSeats reports the seat string for 1-1 and group formats', () => {
    expect(formatSeats('one-on-one', 1)).toBe('1/1');
    expect(formatSeats('group-2-4', 4)).toBe('2/4');
  });

  it('formatStartsAt produces a weekday + day/month string', () => {
    const fixed = new Date('2026-12-05T10:00:00Z').toISOString();
    const vi = formatStartsAt(fixed, 'vi');
    const en = formatStartsAt(fixed, 'en');
    expect(vi).toMatch(/^\w+, \d{2}\/\d{2}$/);
    expect(en).toMatch(/^\w{3}, \d{2}\/\d{2}$/);
  });

  it('hoursUntilBookingDeadline respects the 24-hour BR-021 floor', () => {
    const now = Date.now();
    // 12h ahead => window already closed => 0
    const closed = new Date(now + 12 * 3600_000).toISOString();
    expect(hoursUntilBookingDeadline(closed)).toBe(0);
    // 60h ahead => ~36h remaining
    const open = new Date(now + 60 * 3600_000).toISOString();
    expect(hoursUntilBookingDeadline(open)).toBeGreaterThanOrEqual(35);
    expect(hoursUntilBookingDeadline(open)).toBeLessThanOrEqual(36);
  });

  /**
   * Content-guard at the data boundary: the mock data must not carry
   * human-recognisable real names, fabricated metrics, or any artefact
   * that would mislead a reviewer or user when rendered.
   */
  it('content-guard: no real-looking names or invented metrics in fixtures', () => {
    const bannedMetrics = ['GPA 3.92', 'IELTS 8.0', '99.4%', 'Top 5%', '12.000'];
    for (const item of items) {
      const blob = JSON.stringify(item);
      for (const phrase of bannedMetrics) {
        expect(blob, `forbidden "${phrase}" in ${item.id}`).not.toContain(phrase);
      }
      // Every teacher name is generic and starts with 'Demo teacher'.
      expect(item.teacherName.startsWith('Demo teacher')).toBe(true);
    }
  });

  it('content-guard: no coverGradient references a third-party CDN', () => {
    for (const item of items) {
      const blob = JSON.stringify(item.coverGradient);
      expect(blob).not.toMatch(/googleusercontent\.com/);
      expect(blob).not.toMatch(/aida-public/);
    }
  });

  it('content-guard: seeded items never expose a BR-/FR-/AC- identifier', () => {
    const re = /\b(BR|FR|AC)-\d{3}\b/;
    for (const item of items) {
      const blob = JSON.stringify(item);
      expect(re.test(blob), `BR/FR/AC leaked in ${item.id}`).toBe(false);
    }
  });

  it('typecheck-only: every demo item conforms to the MarketplaceClass contract', () => {
    const requiredKeys: Array<keyof MarketplaceClass> = [
      'id',
      'teacherId',
      'state',
      'startsAt',
      'durationMinutes',
      'priceCredits',
      'capacity',
      'teacherName',
      'schoolCode',
      'schoolName',
      'skillName',
      'skillCategory',
      'level',
      'format',
      'ratingAvg',
      'ratingCount',
      'verified',
      'coverGradient',
    ];
    for (const item of items) {
      for (const key of requiredKeys) {
        expect(item[key], `${String(key)} on ${item.id}`).toBeDefined();
      }
    }
  });
});