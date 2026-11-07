import { describe, expect, it } from 'vitest';
import { toMarketplaceClass, toClassDetailView } from './api-mapping';
import type { SkillCatalogue } from './api-mapping';

/**
 * `GET /classes` returns teacherDisplayName, a rating pair, seats, price and
 * time — and nothing else. There is no school column, no verification flag and
 * no skill name on the class row (the skill is resolved from the catalogue).
 *
 * These tests exist because an earlier version of this mapper filled the gaps
 * with plausible constants: `schoolCode: 'bk'`, `schoolName: 'Verified student
 * teacher'`, `verified: true`. Each read as a real affiliation or a real
 * credential to anyone looking at the card.
 */
const catalogue: SkillCatalogue = new Map([
  [
    'skill-1',
    {
      id: 'skill-1',
      name: 'IELTS',
      category: 'Languages',
      levels: ['beginner', 'intermediate', 'advanced'],
    },
  ],
]);

function classRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'class-1',
    teacherId: 'teacher-1',
    teacherDisplayName: 'Lê Minh',
    skillIds: ['skill-1'],
    title: 'IELTS speaking: band 7 practice',
    level: 'advanced',
    format: 'group',
    description: 'IELTS speaking practice',
    startsAt: '2026-10-25T14:00:00.000Z',
    durationMinutes: 60,
    priceCredits: 40,
    capacity: 2,
    availableSeats: 1,
    state: 'published',
    averageRating: 4.5,
    ratingsCount: 8,
    ...overrides,
  } as Parameters<typeof toMarketplaceClass>[0];
}

describe('toMarketplaceClass', () => {
  it('does not invent a school, code or verification claim', () => {
    const mapped = toMarketplaceClass(classRow(), catalogue);

    // Real fields survive.
    expect(mapped.teacherName).toBe('Lê Minh');
    expect(mapped.skillName).toBe('IELTS');
    expect(mapped.ratingAvg).toBe(4.5);
    expect(mapped.ratingCount).toBe(8);

    // Unsupported fields are absent, not defaulted. The old mapper asserted a
    // real university code and `verified: true` for every class.
    expect(mapped.schoolCode).toBeNull();
    expect(mapped.schoolName).toBeNull();
    expect(mapped.verified).toBeNull();
  });

  it('does not claim a rating the API did not send', () => {
    const unrated = toMarketplaceClass(
      classRow({ averageRating: null, ratingsCount: 0 }),
      catalogue,
    );
    // The old mapper coerced this to 0, which renders as a real zero-star score.
    // The contract flags the pair as provisional, so an absent rating is null.
    expect(unrated.ratingAvg).toBeNull();
    expect(unrated.ratingCount).toBe(0);
  });

  it('shows the level the class reports, not the catalogue lowest (B2)', () => {
    expect(toMarketplaceClass(classRow(), catalogue).level).toBe('advanced');

    // Only a class recorded before the column existed falls back to the catalogue, and the
    // fallback is the old one rather than a new claim.
    const legacy = toMarketplaceClass(classRow({ level: null }), catalogue);
    expect(legacy.level).toBe('beginner');
  });

  it('takes the format from the API instead of guessing it from capacity (B3)', () => {
    // A 12-seat class and a 2-seat class are both groups. The old mapper printed "group 2-4" on
    // every one of them, which was a range the API never promised.
    expect(toMarketplaceClass(classRow({ capacity: 12 }), catalogue).format).toBe('group');
    expect(toMarketplaceClass(classRow({ capacity: 2 }), catalogue).format).toBe('group');
    // A one-seat class is 1:1 no matter what the client would infer.
    expect(
      toMarketplaceClass(classRow({ capacity: 1, format: 'one-on-one' }), catalogue).format,
    ).toBe('one-on-one');
  });
});

describe('toClassDetailView derivation', () => {
  it('derives text from real fields only and never fabricates reviews', () => {
    const base = toMarketplaceClass(classRow(), catalogue);
    const detail = toClassDetailView(base);

    // Derived from the real duration, so the sum matches the advertised length.
    const total = detail.syllabus.reduce((sum, step) => sum + step.minutes, 0);
    expect(total).toBe(base.durationMinutes);

    // No review data exists to show, so none is invented.
    expect(detail.reviews).toEqual([]);
  });

  it('still renders when the skill name is absent instead of printing a placeholder', () => {
    // `GET /classes/:id` supplies no skill name; the description stands in.
    const withoutSkill = toMarketplaceClass(classRow({ skillIds: [] }), catalogue);
    expect(withoutSkill.skillName).toBe('Class');

    const detail = toClassDetailView(withoutSkill);
    expect(detail.description).not.toContain('undefined');
    expect(detail.teacherBio).not.toContain('undefined');
  });
});
