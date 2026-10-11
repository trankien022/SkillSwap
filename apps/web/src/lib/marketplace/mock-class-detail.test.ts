import { describe, expect, it } from 'vitest';
import { MockClassDetailGateway } from './mock-class-detail';
import { demoClassDetails } from './mock-data';

describe('MockClassDetailGateway', () => {
  it('returns the enriched detail view for a known id', async () => {
    const gateway = new MockClassDetailGateway();
    const all = demoClassDetails();
    const sample = all[0];
    if (!sample) throw new Error('demo fixture is empty');
    const result = await gateway.getById(sample.id);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(sample.id);
    expect(result?.description.length).toBeGreaterThan(0);
    expect(result?.syllabus.length).toBeGreaterThanOrEqual(3);
    expect(result?.prerequisites.length).toBe(3);
    expect(result?.reviews.length).toBeGreaterThanOrEqual(2);
    expect(result?.teacherCredentials.length).toBeGreaterThanOrEqual(1);
  });

  it('returns null for an unknown id (page renders 404)', async () => {
    const gateway = new MockClassDetailGateway();
    const result = await gateway.getById('definitely-not-a-real-class');
    expect(result).toBeNull();
  });

  it('listIds returns one entry per demo class', async () => {
    const gateway = new MockClassDetailGateway();
    const ids = await gateway.listIds();
    expect(ids).toHaveLength(demoClassDetails().length);
  });

  it('every demo class keeps the marketplace invariants (BR-016/017/027)', async () => {
    const all = demoClassDetails();
    for (const item of all) {
      expect(item.capacity).toBeGreaterThanOrEqual(1);
      expect(item.durationMinutes).toBeGreaterThanOrEqual(30);
      expect(item.durationMinutes).toBeLessThanOrEqual(180);
      expect(Number.isInteger(item.priceCredits)).toBe(true);
      expect(item.priceCredits).toBeGreaterThan(0);
      expect(item.state).toBe('published');
    }
  });

  /**
   * Content-guard: detail views must never carry a recognisable real
   * name, a fabricated band-score, or invented credentials.
   */
  it('content-guard: no real names, no fabricated scores, no leaked BR/FR/AC ids', async () => {
    const all = demoClassDetails();
    const bannedNames = [
      'Trần Hoàng Mai',
      'Nguyễn Lê An',
      'Hoàng Minh Đức',
      'Vũ Tuấn Kiệt',
      'Đặng Thảo Linh',
      'Bùi Minh Đức',
      'Lê Quốc Khánh',
      'Nguyễn Hà My',
    ];
    const bannedMetrics = [
      'GPA 3.82',
      'IELTS 8.0',
      'IELTS 8.5',
      'Speaking 8.5',
      'Listening 8.5',
      'Giải Nhì',
      'Giải ICPC',
      'Quán quân Debate',
      'Backend Lead',
      'Top Product',
      'Học bổng',
    ];
    const idRe = /\b(BR|FR|AC)-\d{3}\b/;
    for (const item of all) {
      const blob = JSON.stringify(item);
      for (const name of bannedNames) {
        expect(blob, `real name "${name}" leaked in ${item.id}`).not.toContain(name);
      }
      for (const metric of bannedMetrics) {
        expect(blob, `fabricated metric "${metric}" in ${item.id}`).not.toContain(metric);
      }
      expect(idRe.test(blob), `BR/FR/AC leaked in ${item.id}`).toBe(false);
      expect(item.teacherName.startsWith('Demo teacher')).toBe(true);
      for (const review of item.reviews) {
        expect(review.authorName.startsWith('Demo learner')).toBe(true);
      }
    }
  });
});