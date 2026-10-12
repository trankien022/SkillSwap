import {
  ALLOWED_DURATIONS,
  MAX_CAPACITY,
  MAX_PRICE_CREDITS,
  MIN_CAPACITY,
  MIN_PRICE_CREDITS,
  PLATFORM_FEE_BPS,
  TITLE_MAX_CHARS,
  VND_PER_CREDIT,
  type ClassDraft,
  type VerifiedSkill,
} from './types';

/** Two verified skills, no real names, no real faculties. */
export const demoVerifiedSkills: VerifiedSkill[] = [
  {
    id: 'skill-ielts-speaking-75',
    category: 'language',
    label: 'IELTS Speaking 7.5+',
    verifierLabel: 'Demo verifier',
    verifierFaculty: 'Demo faculty',
    approvedOn: '2025-08-12',
  },
  {
    id: 'skill-algo-dsa-advanced',
    category: 'code',
    label: 'Thuật toán & Cấu trúc dữ liệu nâng cao',
    verifierLabel: 'Demo verifier',
    verifierFaculty: 'Demo faculty',
    approvedOn: '2025-09-04',
  },
];

/** Default draft state, matches the demo card on the template. */
export function buildDemoDraft(now: Date = new Date()): ClassDraft {
  const startDate = new Date(now);
  startDate.setUTCDate(startDate.getUTCDate() + 7);
  const isoDate = startDate.toISOString().slice(0, 10);
  return {
    skillId: 'skill-ielts-speaking-75',
    title: 'Luyện Mock Test IELTS Speaking 1-1 chuyên sâu phản xạ',
    description:
      'Học viên chuẩn bị sẵn bài nói Part 2 theo đề quý gần nhất. Yêu cầu trang bị tai nghe có mic chống ồn, camera bật suốt buổi học. Lớp tập trung sửa phát âm, ngắt nhịp và mở rộng vốn từ C1.',
    durationMinutes: 60,
    startsOn: isoDate,
    startsAt: '20:00',
    capacity: 1,
    priceCredits: 100,
  };
}

/* --- Pure helpers (tested in mock-gateway.test.ts) --- */

export function computePlatformFee(priceCredits: number): number {
  // BR-034: 1000 bps (10%) integer, rounded half-up.
  return Math.round((priceCredits * PLATFORM_FEE_BPS) / 10_000);
}

export function computeNetCredits(priceCredits: number): number {
  return Math.max(0, priceCredits - computePlatformFee(priceCredits));
}

export function computeVndEstimate(credits: number): number {
  return credits * VND_PER_CREDIT;
}

export function clampPrice(price: number): number {
  if (!Number.isFinite(price)) return MIN_PRICE_CREDITS;
  return Math.max(
    MIN_PRICE_CREDITS,
    Math.min(MAX_PRICE_CREDITS, Math.floor(price)),
  );
}

export function clampCapacity(capacity: number): number {
  if (!Number.isFinite(capacity)) return MIN_CAPACITY;
  return Math.max(
    MIN_CAPACITY,
    Math.min(MAX_CAPACITY, Math.floor(capacity)),
  );
}

export function isAllowedDuration(d: number): boolean {
  return ALLOWED_DURATIONS.includes(d as ClassDraft['durationMinutes']);
}

export function titleCharCount(title: string): number {
  return title.length;
}

export function titleOver(title: string): boolean {
  return titleCharCount(title) > TITLE_MAX_CHARS;
}

export function priceIsValid(price: number): boolean {
  return (
    Number.isFinite(price) &&
    price >= MIN_PRICE_CREDITS &&
    price <= MAX_PRICE_CREDITS &&
    Math.floor(price) === price
  );
}

export function capacityIsValid(capacity: number): boolean {
  return (
    Number.isFinite(capacity) &&
    capacity >= MIN_CAPACITY &&
    capacity <= MAX_CAPACITY &&
    Math.floor(capacity) === capacity
  );
}
