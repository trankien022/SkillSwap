import { describe, expect, it } from 'vitest';
import { demoClassDetails, demoMarketplaceClasses } from '../../lib/marketplace/mock-data';
import { toClassDetailView } from '../../lib/marketplace/api-mapping';
import type { ClassDetailView } from '../../lib/marketplace/types';

/**
 * Content-guard at the page composition boundary (FR-006 detail).
 *
 * The detail page now renders live API data promoted through
 * `toClassDetailView`. These guards cover two things: (1) the preserved
 * `mock-data` fixture still cannot leak real names, fabricated
 * credentials/scores, CDN URLs or internal BR/FR/AC identifiers, and
 * (2) the real-data mapping produces an honest detail view — no faked
 * reviews, and derived fields consistent with the real class.
 */
describe('Class detail page content-guard (data boundary)', () => {
  const all = demoClassDetails();
  const item = all[0];
  if (!item) throw new Error('demo fixture is empty');

  const bannedNames = [
    'Trần Hoàng Mai',
    'Nguyễn Lê An',
    'Hoàng Minh Đức',
    'Vũ Tuấn Kiệt',
    'Đặng Thảo Linh',
    'Bùi Minh Đức',
    'Lê Quốc Khánh',
    'Nguyễn Hà My',
    'Thầy Hùng',
  ];
  const bannedMetrics = [
    'GPA 3.82',
    'GPA 3.92',
    'IELTS 8.0',
    'IELTS 8.5',
    'Speaking 8.5',
    'Listening 8.5',
    'Giải Nhì',
    'Olympic',
    'Giải ICPC',
    'Quán quân Debate',
    'Backend Lead',
    'Top Product',
    'Học bổng',
  ];
  const bannedHotlines = ['1900-8888', 'Ext:'];
  const bannedBranding = ['SkillSwap Escrow', 'ví trung gian thông minh'];
  const idRe = /\b(BR|FR|AC)-\d{3}\b/;
  const cdnRe = /googleusercontent\.com|aida-public/;

  it('every detail view keeps the marketplace invariants', () => {
    for (const item of all) {
      expect(item.capacity).toBeGreaterThanOrEqual(1);
      expect(item.durationMinutes).toBeGreaterThanOrEqual(30);
      expect(item.durationMinutes).toBeLessThanOrEqual(180);
      expect(Number.isInteger(item.priceCredits)).toBe(true);
      expect(item.priceCredits).toBeGreaterThan(0);
      expect(item.state).toBe('published');
    }
  });

  it('every detail view has syllabus, prerequisites, and reviews blocks', () => {
    for (const item of all) {
      expect(item.syllabus.length).toBeGreaterThanOrEqual(3);
      expect(item.prerequisites.length).toBeGreaterThanOrEqual(2);
      expect(item.reviews.length).toBeGreaterThanOrEqual(2);
      expect(item.teacherCredentials.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('content-guard: no real names, no fabricated scores, no hotlines', () => {
    for (const item of all) {
      const blob = JSON.stringify(item);
      for (const name of bannedNames) {
        expect(blob, `real name "${name}" in ${item.id}`).not.toContain(name);
      }
      for (const metric of bannedMetrics) {
        expect(blob, `fabricated "${metric}" in ${item.id}`).not.toContain(metric);
      }
      for (const phone of bannedHotlines) {
        expect(blob, `phone "${phone}" in ${item.id}`).not.toContain(phone);
      }
      for (const brand of bannedBranding) {
        expect(blob, `branding "${brand}" in ${item.id}`).not.toContain(brand);
      }
    }
  });

  it('content-guard: no BR/FR/AC identifiers, no CDN URLs', () => {
    for (const item of all) {
      const blob = JSON.stringify(item);
      expect(idRe.test(blob), `BR/FR/AC leaked in ${item.id}`).toBe(false);
      expect(cdnRe.test(blob), `CDN URL leaked in ${item.id}`).toBe(false);
    }
  });

  it('content-guard: every reviewer is a generic Demo learner', () => {
    for (const item of all) {
      for (const review of item.reviews) {
        expect(review.authorName.startsWith('Demo learner')).toBe(true);
        expect(review.schoolName ?? '').toMatch(/^Demo /);
      }
    }
  });

  it('real-data mapping: an unknown id resolves to null so the page renders 404', () => {
    // `HttpMarketplaceGateway.findById` scans the list and returns null when no
    // class matches; this guards that contract without network access.
    const gatewayResult: ClassDetailView | null = demoMarketplaceClasses()
      .map((item) => toClassDetailView(item))
      .find((item) => item.id === 'not-a-real-class-id') ?? null;
    expect(gatewayResult).toBeNull();
  });

  it('real-data mapping: every marketplace class promotes to a valid detail view', () => {
    for (const item of demoMarketplaceClasses()) {
      const detail = toClassDetailView(item);
      // Real fields carry straight across.
      expect(detail.id).toBe(item.id);
      expect(detail.teacherId).toBe(item.teacherId);
      expect(detail.priceCredits).toBe(item.priceCredits);
      expect(detail.capacity).toBe(item.capacity);
      expect(detail.startsAt).toBe(item.startsAt);
      // Derived fields exist and are honest: no fabricated reviews.
      expect(detail.description.length).toBeGreaterThan(0);
      expect((detail.teacherBio ?? '').length).toBeGreaterThan(0);
      expect(detail.syllabus.length).toBeGreaterThanOrEqual(3);
      expect(detail.prerequisites.length).toBeGreaterThanOrEqual(2);
      expect(detail.teacherCredentials.length).toBeGreaterThanOrEqual(1);
      expect(detail.reviews).toEqual([]);
    }
  });

  it('real-data mapping: the derived syllabus sums to the real class duration', () => {
    for (const item of demoMarketplaceClasses()) {
      const detail = toClassDetailView(item);
      const total = detail.syllabus.reduce((sum, step) => sum + step.minutes, 0);
      expect(total, `syllabus minutes for ${item.id}`).toBe(item.durationMinutes);
      // Ordinals are 1-based and contiguous.
      detail.syllabus.forEach((step, index) => {
        expect(step.order).toBe(index + 1);
      });
    }
  });

  it('real-data mapping: derived teacher stats never invent history beyond the class', () => {
    for (const item of demoMarketplaceClasses()) {
      const detail = toClassDetailView(item);
      expect(detail.teacherStats).not.toBeNull();
      expect(detail.teacherStats!.hoursTaught).toBe(
        Math.round(item.durationMinutes / 60),
      );
      expect(detail.teacherStats!.learnersHelped).toBe(item.capacity);
      expect(detail.teacherStats!.responseRatePct).toBe(100);
      // Credentials always carry the platform verifier, never a named person.
      for (const credential of detail.teacherCredentials) {
        expect(credential.verifiedBy).toBe('SkillSwap Verifier Council');
      }
    }
  });

  it('every detail view is a strict superset of the marketplace card view', () => {
    const marketplaceById = new Map(
      demoMarketplaceClasses().map((c) => [c.id, c]),
    );
    for (const item of all) {
      const card = marketplaceById.get(item.id);
      expect(card).toBeDefined();
      // Core FR-005 fields must match exactly. startsAt is excluded
      // because the marketplace seed and the detail seed call
      // `Date.now()` separately, so the millisecond timestamp drifts
      // by a few hundred microseconds between the two calls.
      expect(item.id).toBe(card?.id);
      expect(item.teacherId).toBe(card?.teacherId);
      expect(item.state).toBe(card?.state);
      expect(item.durationMinutes).toBe(card?.durationMinutes);
      expect(item.priceCredits).toBe(card?.priceCredits);
      expect(item.capacity).toBe(card?.capacity);
      // startsAt should land within a small window of each other.
      const drift = Math.abs(
        new Date(item.startsAt).getTime() - new Date(card!.startsAt).getTime(),
      );
      expect(drift, `startsAt drift too large for ${item.id}`).toBeLessThan(1000);
    }
  });

  it('TypeScript-shaped: every detail view satisfies the ClassDetailView contract', () => {
    const requiredKeys: Array<keyof ClassDetailView> = [
      'id',
      'description',
      'syllabus',
      'prerequisites',
      'teacherBio',
      'teacherStats',
      'teacherCredentials',
      'reviews',
    ];
    for (const item of all) {
      for (const key of requiredKeys) {
        expect(item[key], `${String(key)} on ${item.id}`).toBeDefined();
      }
    }
  });
});