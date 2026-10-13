import { describe, expect, it } from 'vitest';
import {
  computeNetCredits,
  computePlatformFee,
  computeVndEstimate,
  capacityIsValid,
  clampCapacity,
  clampPrice,
  isAllowedDuration,
  priceIsValid,
  titleOver,
} from '../../lib/teacher/money';
import {
  toCreateClassInput,
  toVerifiedSkill,
} from '../../lib/teacher/http-gateway';
import { ALLOWED_DURATIONS, MAX_CAPACITY, MIN_PRICE_CREDITS, TITLE_MAX_CHARS } from '../../lib/teacher/types';
import type { ClassDraft } from '../../lib/teacher/types';

/**
 * Tests for the real publish path (FR-005 / FR-022).
 *
 * The previous suite pinned a mock fixture's contents. That fixture is gone, so
 * these tests now cover the two things the publish screen actually depends on:
 * the money rules (BR-034) and the mapping from a draft onto the
 * `createClassSchema` payload the API validates.
 */

function draft(overrides: Partial<ClassDraft> = {}): ClassDraft {
  return {
    skillId: 'skill-1',
    title: 'Graph algorithms',
    description: 'Bring a laptop and a problem you are stuck on.',
    durationMinutes: 60,
    startsOn: '2026-11-20',
    startsAt: '20:00',
    capacity: 1,
    priceCredits: 100,
    ...overrides,
  };
}

describe('money rules (BR-034)', () => {
  it('splits a round price 90/10', () => {
    expect(computePlatformFee(100)).toBe(10);
    expect(computeNetCredits(100)).toBe(90);
  });

  it('fee + net always reconstructs the price, including odd prices', () => {
    for (const price of [1, 7, 9, 11, 55, 99, 123, 1000]) {
      expect(computePlatformFee(price) + computeNetCredits(price)).toBe(price);
    }
    // 9 credits -> 0.9 rounds to 1, leaving the teacher 8.
    expect(computePlatformFee(9)).toBe(1);
    expect(computeNetCredits(9)).toBe(8);
  });

  it('never returns a negative net', () => {
    expect(computeNetCredits(0)).toBe(0);
  });

  it('converts credits to VND at 1 credit = 1,000 VND', () => {
    expect(computeVndEstimate(90)).toBe(90_000);
  });
});

describe('draft clamps and predicates', () => {
  it('clampPrice keeps the value inside the credit band', () => {
    expect(clampPrice(0)).toBe(MIN_PRICE_CREDITS);
    expect(clampPrice(2_000)).toBe(1000);
    expect(clampPrice(NaN)).toBe(MIN_PRICE_CREDITS);
    expect(clampPrice(50.4)).toBe(50);
  });

  it('clampCapacity keeps the value inside the 1..15 band', () => {
    expect(clampCapacity(0)).toBe(1);
    expect(clampCapacity(99)).toBe(MAX_CAPACITY);
    expect(clampCapacity(NaN)).toBe(1);
    expect(clampCapacity(7.9)).toBe(7);
  });

  it('ALLOWED_DURATIONS is exactly 30/45/60/90 (BR-017)', () => {
    expect(ALLOWED_DURATIONS).toEqual([30, 45, 60, 90]);
    expect(isAllowedDuration(60)).toBe(true);
    expect(isAllowedDuration(120)).toBe(false);
  });

  it('TITLE_MAX_CHARS is 100', () => {
    expect(TITLE_MAX_CHARS).toBe(100);
    expect(titleOver('A'.repeat(TITLE_MAX_CHARS))).toBe(false);
    expect(titleOver('A'.repeat(TITLE_MAX_CHARS + 1))).toBe(true);
  });

  it('rejects fractional and out-of-band prices/capacities', () => {
    expect(priceIsValid(100)).toBe(true);
    expect(priceIsValid(100.5)).toBe(false);
    expect(capacityIsValid(1)).toBe(true);
    expect(capacityIsValid(0)).toBe(false);
  });
});

describe('toCreateClassInput', () => {
  it('maps a draft onto createClassSchema fields only', () => {
    const input = toCreateClassInput(draft(), 'Graph Theory');
    expect(Object.keys(input).sort()).toEqual(
      ['capacity', 'description', 'durationMinutes', 'priceCredits', 'skillIds', 'startsAt'].sort(),
    );
    expect(input.skillIds).toEqual(['skill-1']);
    expect(input.priceCredits).toBe(100);
    expect(input.capacity).toBe(1);
    expect(input.durationMinutes).toBe(60);
  });

  it('carries the title into the description, since the API has no title field', () => {
    const input = toCreateClassInput(draft(), 'Graph Theory');
    expect(input.description).toContain('Graph algorithms');
    expect(input.description).toContain('Bring a laptop');
  });

  it('emits an ISO instant with an offset for startsAt', () => {
    const input = toCreateClassInput(draft(), 'Graph Theory');
    expect(input.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
  });

  it('falls back to the skill name when the description is blank', () => {
    const input = toCreateClassInput(draft({ title: '', description: '' }), 'Graph Theory');
    expect(input.description).toBe('Graph Theory');
  });

  it('throws rather than publishing an unparseable start time', () => {
    expect(() => toCreateClassInput(draft({ startsOn: '', startsAt: '' }), 'Graph Theory')).toThrow();
  });

  it('rejects a blank schedule that Date would silently backdate to 2000', () => {
    // `new Date('T:00')` does not throw on V8 — it resolves to 2000-01-01, so a
    // lenient parse would publish a class dated the year 2000.
    expect(() => toCreateClassInput(draft({ startsOn: 'T', startsAt: '00' }), 'G')).toThrow();
    expect(() => toCreateClassInput(draft({ startsOn: '20:00', startsAt: '20:00' }), 'G')).toThrow();
  });

  it('rejects calendar rollover such as 2026-02-31', () => {
    expect(() => toCreateClassInput(draft({ startsOn: '2026-02-31', startsAt: '20:00' }), 'G')).toThrow();
    expect(() => toCreateClassInput(draft({ startsOn: '2026-11-20', startsAt: '24:30' }), 'G')).toThrow();
  });

  it('never emits a room code — the API does not accept one', () => {
    const blob = JSON.stringify(toCreateClassInput(draft(), 'Graph Theory'));
    expect(blob).not.toMatch(/classroomCode/i);
  });
});

describe('toVerifiedSkill', () => {
  it('keeps only what the profile-skills endpoint returns', () => {
    const skill = toVerifiedSkill({
      id: 'ps-1',
      skillId: 'skill-9',
      skillName: 'IELTS Speaking',
      category: 'Languages',
      approvedLevel: 'advanced',
    });
    expect(skill).toEqual({
      id: 'skill-9',
      category: 'language',
      label: 'IELTS Speaking',
      approvedLevel: 'advanced',
    });
  });

  it('does not invent a verifier name or approval date', () => {
    const blob = JSON.stringify(
      toVerifiedSkill({
        id: 'ps-1',
        skillId: 'skill-9',
        skillName: 'IELTS Speaking',
        category: 'Languages',
        approvedLevel: 'advanced',
      }),
    );
    expect(blob).not.toMatch(/verifier/i);
    expect(blob).not.toMatch(/approvedOn/i);
  });

  it('maps an unknown category onto the default icon bucket', () => {
    const skill = toVerifiedSkill({
      id: 'ps-2',
      skillId: 'skill-10',
      skillName: 'Chess',
      category: 'Unknown Faculty',
      approvedLevel: 'intermediate',
    });
    expect(skill.category).toBe('code');
  });
});
