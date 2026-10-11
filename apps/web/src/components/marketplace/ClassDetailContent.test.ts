import { describe, expect, it } from 'vitest';
import { demoClassDetails, demoMarketplaceClasses } from '../../lib/marketplace/mock-data';
import { MockClassDetailGateway } from '../../lib/marketplace/mock-class-detail';
import type { ClassDetailView } from '../../lib/marketplace/types';

/**
 * Content-guard at the page composition boundary (FR-006 detail).
 *
 * Walks every detail view the page could render and asserts the
 * dataset stays free of: real Vietnamese names, fabricated
 * credentials/scores, third-party CDN URLs, internal BR/FR/AC
 * identifiers, and invented phone numbers. Same checklist as
 * messages-parity.test.ts but applied to the data layer the page
 * consumes, so a future fixture edit cannot accidentally leak
 * banned content.
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
        expect(review.schoolName.startsWith('Demo ')).toBe(true);
      }
    }
  });

  it('gateway returns null for unknown ids so the page renders 404', async () => {
    const gateway = new MockClassDetailGateway();
    const result = await gateway.getById('not-a-real-class-id');
    expect(result).toBeNull();
  });

  it('gateway and marketplace seed expose the same id set', async () => {
    const gateway = new MockClassDetailGateway();
    const detailIds = (await gateway.listIds()).sort();
    const listIds = demoMarketplaceClasses().map((c) => c.id).sort();
    expect(detailIds).toEqual(listIds);
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