import { describe, expect, it } from 'vitest';
import {
  buildDemoDraft,
  computeNetCredits,
  computePlatformFee,
  computeVndEstimate,
  clampCapacity,
  clampPrice,
  demoVerifiedSkills,
  priceIsValid,
  capacityIsValid,
  isAllowedDuration,
  titleOver,
} from './mock-data';
import { MockTeacherPublishGateway } from './mock-gateway';
import {
  ALLOWED_DURATIONS,
  MAX_CAPACITY,
  MIN_PRICE_CREDITS,
  PLATFORM_FEE_BPS,
  TITLE_MAX_CHARS,
  VND_PER_CREDIT,
} from './types';

describe('MockTeacherPublishGateway', () => {
  it('exposes 2 verified skills (no real names, no real faculties)', () => {
    expect(demoVerifiedSkills).toHaveLength(2);
    const blob = JSON.stringify(demoVerifiedSkills);
    expect(/Thầy Hùng/.test(blob)).toBe(false);
    expect(/TS\. Tuấn/.test(blob)).toBe(false);
    expect(/SoICT/.test(blob)).toBe(false);
    expect(/Ngoại ngữ/.test(blob)).toBe(false);
    expect(/Bách Khoa/.test(blob)).toBe(false);
  });

  it('demo draft uses the BR-008/010 standard fields', () => {
    const d = buildDemoDraft(new Date('2025-09-22T00:00:00Z'));
    expect(d.skillId).toBe('skill-ielts-speaking-75');
    expect(d.durationMinutes).toBe(60);
    expect(d.capacity).toBe(1);
    expect(d.priceCredits).toBe(100);
    expect(d.startsAt).toBe('20:00');
    // 7 days ahead of the input
    expect(d.startsOn).toBe('2025-09-29');
  });

  it('BR-034 fee math: 100 credits -> 10 fee -> 90 net', () => {
    expect(computePlatformFee(100)).toBe(10);
    expect(computeNetCredits(100)).toBe(90);
    expect(computeVndEstimate(90)).toBe(90 * VND_PER_CREDIT);
  });

  it('BR-034 fee math: integer-only, half-up', () => {
    expect(computePlatformFee(33)).toBe(3);
    expect(computePlatformFee(99)).toBe(10);
    expect(computePlatformFee(0)).toBe(0);
  });

  it('clampPrice keeps the value inside the 10..1000 band', () => {
    expect(clampPrice(5)).toBe(MIN_PRICE_CREDITS);
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

  it('ALLOWED_DURATIONS is exactly 30, 45, 60, 90', () => {
    expect(ALLOWED_DURATIONS).toEqual([30, 45, 60, 90]);
    expect(isAllowedDuration(60)).toBe(true);
    expect(isAllowedDuration(120)).toBe(false);
  });

  it('title helper counts and flags overflow at 100', () => {
    expect(titleOver('A'.repeat(TITLE_MAX_CHARS))).toBe(false);
    expect(titleOver('A'.repeat(TITLE_MAX_CHARS + 1))).toBe(true);
  });

  it('validators reject floats and out-of-range values', () => {
    expect(priceIsValid(50)).toBe(true);
    expect(priceIsValid(50.5)).toBe(false);
    expect(priceIsValid(9)).toBe(false);
    expect(priceIsValid(1001)).toBe(false);
    expect(capacityIsValid(1)).toBe(true);
    expect(capacityIsValid(15)).toBe(true);
    expect(capacityIsValid(16)).toBe(false);
    expect(capacityIsValid(0)).toBe(false);
  });

  it('PLATFORM_FEE_BPS is 1000 and VND_PER_CREDIT is 1000', () => {
    expect(PLATFORM_FEE_BPS).toBe(1000);
    expect(VND_PER_CREDIT).toBe(1000);
  });
});

describe('MockTeacherPublishGateway methods', () => {
  it('saveDraft updates the in-memory draft', async () => {
    const gw = new MockTeacherPublishGateway();
    const updated = await gw.saveDraft({ ...(await gw.getDraft()), title: 'New title' });
    expect(updated.title).toBe('New title');
  });

  it('publishDraft returns a synthetic classId + classroom code', async () => {
    const gw = new MockTeacherPublishGateway();
    const result = await gw.publishDraft(await gw.getDraft());
    expect(result.classId).toMatch(/^cls-demo-/);
    expect(result.publishedAt).toMatch(/^\d{4}-/);
    expect(result.classroomCode).toMatch(/^SSW-[A-Z0-9]+-\d{4}$/);
  });

  it('publishDraft rejects a draft with an unverified skill id', async () => {
    const gw = new MockTeacherPublishGateway();
    const bad = { ...(await gw.getDraft()), skillId: 'skill-not-verified' };
    await expect(gw.publishDraft(bad)).rejects.toThrow(/skill is not in the verified set/);
  });

  it('publishDraft rejects a draft with a non-standard duration', async () => {
    const gw = new MockTeacherPublishGateway();
    const bad = { ...(await gw.getDraft()), durationMinutes: 120 as unknown as 60 };
    await expect(gw.publishDraft(bad)).rejects.toThrow(/duration/);
  });

  it('publishDraft rejects a draft with a price outside 10..1000', async () => {
    const gw = new MockTeacherPublishGateway();
    const bad = { ...(await gw.getDraft()), priceCredits: 5 };
    await expect(gw.publishDraft(bad)).rejects.toThrow(/price/);
  });

  it('canPublish returns true for the demo draft and false for a broken one', async () => {
    const gw = new MockTeacherPublishGateway();
    expect(await gw.canPublish(await gw.getDraft())).toBe(true);
    expect(await gw.canPublish({ ...(await gw.getDraft()), title: '' })).toBe(false);
  });
});
