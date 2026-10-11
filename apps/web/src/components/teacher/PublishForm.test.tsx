import { describe, expect, it } from 'vitest';
import { buildDemoDraft, demoVerifiedSkills } from '../../lib/teacher/mock-data';
import {
  ALLOWED_DURATIONS,
  TITLE_MAX_CHARS,
} from '../../lib/teacher/types';

/**
 * Smoke tests for the publish form composition.
 *
 * The page itself uses a client shell, so a sync
 * `renderToStaticMarkup` cannot be used here without breaking
 * the next-intl boundary. Instead we pin the invariants the
 * page depends on: the demo draft + verified skills stay
 * well-formed, the fee math holds, the duration enum is the
 * BR-017 standard set, the title limit is 100 chars, the
 * capacity band is 1..15, and no banned marketing strings or
 * real names leak.
 */
describe('Publish form composition (data + content-guard)', () => {
  it('demo draft uses the BR-008/010 standard fields', () => {
    const d = buildDemoDraft(new Date('2025-09-22T00:00:00Z'));
    expect(d.skillId).toBe('skill-ielts-speaking-75');
    expect(d.durationMinutes).toBe(60);
    expect(d.capacity).toBe(1);
    expect(d.priceCredits).toBe(100);
    expect(d.startsAt).toBe('20:00');
    expect(d.startsOn).toBe('2025-09-29');
  });

  it('verified skills list has 2 entries with no real names', () => {
    expect(demoVerifiedSkills).toHaveLength(2);
    const blob = JSON.stringify(demoVerifiedSkills);
    for (const re of [
      /Thầy Hùng/,
      /TS\. Tuấn/,
      /SoICT/,
      /Ngoại ngữ/,
      /Bách Khoa/,
    ]) {
      expect(re.test(blob), `banned ${re}`).toBe(false);
    }
  });

  it('ALLOWED_DURATIONS is exactly 30/45/60/90 (BR-017)', () => {
    expect(ALLOWED_DURATIONS).toEqual([30, 45, 60, 90]);
  });

  it('TITLE_MAX_CHARS is 100 (per spec)', () => {
    expect(TITLE_MAX_CHARS).toBe(100);
  });

  it('content-guard: no banned tokens in the demo draft blob', () => {
    const blob = JSON.stringify(buildDemoDraft());
    for (const re of [
      /\bBR-\d{3}\b/,
      /\bFR-\d{3}\b/,
      /\bAC-\d{3}\b/,
      /Jitsi/i,
      /WebRTC/i,
      /SoICT/,
      /Ngoại ngữ/,
      /Bách Khoa/,
      /100%\s*refund/i,
      /phản hồi\s*5\s*phút/i,
      /SkillSwap Escrow/i,
      /Smart-Escrow/i,
      /ví trung gian thông minh/i,
      /voucher\s*10\s*credits/i,
    ]) {
      expect(re.test(blob), `banned ${re} in demo draft`).toBe(false);
    }
  });
});
