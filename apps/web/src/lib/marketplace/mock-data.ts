import type { MarketplaceClass, UniversityCode } from './types';

/**
 * Six demo marketplace classes (FR-006 mock).
 *
 * Names, schools, skills, and metrics are illustrative ONLY. They are
 * surfaced to the user with a "Dữ liệu minh họa" / "Demo data" badge
 * (`Landing.card.mockDataBadge`) when NODE_ENV !== 'production'.
 *
 * `id` / `teacherId` use stable demo prefixes so tests can target them.
 * `priceCredits`, `durationMinutes`, and `capacity` obey the
 * `createClassSchema` zod rules (BR-016 ≥ 30 min, BR-017 ≤ 180 min,
 * BR-027 positive integer credits, AC-028 capacity ≥ 1).
 */

const HOUR = 60 * 60 * 1000;

function startsIn(hours: number): string {
  return new Date(Date.now() + hours * HOUR).toISOString();
}

interface Seed {
  id: string;
  teacherId: string;
  teacherName: string;
  schoolCode: UniversityCode;
  schoolName: string;
  skillName: string;
  skillCategory: 'language' | 'programming' | 'design' | 'soft-skills' | 'math';
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  format: 'one-on-one' | 'group-2-4';
  ratingAvg: number;
  ratingCount: number;
  hoursAhead: number;
  durationMinutes: number;
  priceCredits: number;
  capacity: number;
  coverGradient: { from: string; to: string };
}

// School display names use generic descriptions on purpose. Real school
// labels live in i18n (Landing.search.universities) so reviewers can
// rename without touching this fixture.
const schoolLabel: Record<UniversityCode, string> = {
  bk: 'Tech university (HCMUT/HUST)',
  ftu: 'Foreign trade university (FTU)',
  ueh: 'Economics university (UEH/NEU)',
  uit: 'IT university (UIT)',
  'kien-truc': 'Architecture university',
  ussh: 'Social sciences & humanities (VNU-USSH)',
};

const seeds: Seed[] = [
  {
    id: 'demo-ielts-speaking',
    teacherId: 'teacher-demo-1',
    teacherName: 'Demo teacher · IELTS',
    schoolCode: 'ftu',
    schoolName: schoolLabel.ftu,
    skillName: 'IELTS Speaking',
    skillCategory: 'language',
    level: 'advanced',
    format: 'one-on-one',
    ratingAvg: 4.95,
    ratingCount: 42,
    hoursAhead: 34,
    durationMinutes: 60,
    priceCredits: 85,
    capacity: 1,
    coverGradient: { from: '#e2e8f0', to: '#cbd5e1' },
  },
  {
    id: 'demo-dsa-algorithms',
    teacherId: 'teacher-demo-2',
    teacherName: 'Demo teacher · Algorithms',
    schoolCode: 'bk',
    schoolName: schoolLabel.bk,
    skillName: 'Data structures & algorithms',
    skillCategory: 'programming',
    level: 'intermediate',
    format: 'group-2-4',
    ratingAvg: 4.98,
    ratingCount: 68,
    hoursAhead: 48,
    durationMinutes: 90,
    priceCredits: 60,
    capacity: 4,
    coverGradient: { from: '#d1fae5', to: '#a7f3d0' },
  },
  {
    id: 'demo-uiux-figma',
    teacherId: 'teacher-demo-3',
    teacherName: 'Demo teacher · UI/UX',
    schoolCode: 'kien-truc',
    schoolName: schoolLabel['kien-truc'],
    skillName: 'Figma auto-layout & portfolio review',
    skillCategory: 'design',
    level: 'intermediate',
    format: 'one-on-one',
    ratingAvg: 4.9,
    ratingCount: 29,
    hoursAhead: 62,
    durationMinutes: 60,
    priceCredits: 75,
    capacity: 1,
    coverGradient: { from: '#f1f5f9', to: '#e2e8f0' },
  },
  {
    id: 'demo-econometrics',
    teacherId: 'teacher-demo-4',
    teacherName: 'Demo teacher · Econometrics',
    schoolCode: 'ueh',
    schoolName: schoolLabel.ueh,
    skillName: 'Stata & R for OLS regression',
    skillCategory: 'math',
    level: 'advanced',
    format: 'group-2-4',
    ratingAvg: 4.88,
    ratingCount: 31,
    hoursAhead: 76,
    durationMinutes: 90,
    priceCredits: 55,
    capacity: 4,
    coverGradient: { from: '#ecfdf5', to: '#d1fae5' },
  },
  {
    id: 'demo-public-speaking',
    teacherId: 'teacher-demo-5',
    teacherName: 'Demo teacher · Public speaking',
    schoolCode: 'ussh',
    schoolName: schoolLabel.ussh,
    skillName: 'Pitching & persuasive speaking',
    skillCategory: 'soft-skills',
    level: 'beginner',
    format: 'one-on-one',
    ratingAvg: 4.92,
    ratingCount: 53,
    hoursAhead: 90,
    durationMinutes: 60,
    priceCredits: 70,
    capacity: 1,
    coverGradient: { from: '#f8fafc', to: '#cbd5e1' },
  },
  {
    id: 'demo-backend-node',
    teacherId: 'teacher-demo-6',
    teacherName: 'Demo teacher · Backend',
    schoolCode: 'bk',
    schoolName: schoolLabel.bk,
    skillName: 'Node.js, Express & Redis APIs',
    skillCategory: 'programming',
    level: 'intermediate',
    format: 'group-2-4',
    ratingAvg: 4.96,
    ratingCount: 47,
    hoursAhead: 112,
    durationMinutes: 90,
    priceCredits: 65,
    capacity: 4,
    coverGradient: { from: '#e2e8f0', to: '#a7f3d0' },
  },
];

export function demoMarketplaceClasses(): MarketplaceClass[] {
  return seeds.map((seed) => ({
    id: seed.id,
    teacherId: seed.teacherId,
    state: 'published',
    startsAt: startsIn(seed.hoursAhead),
    durationMinutes: seed.durationMinutes,
    priceCredits: seed.priceCredits,
    capacity: seed.capacity,
    teacherName: seed.teacherName,
    schoolCode: seed.schoolCode,
    schoolName: seed.schoolName,
    skillName: seed.skillName,
    skillCategory: seed.skillCategory,
    level: seed.level,
    format: seed.format,
    ratingAvg: seed.ratingAvg,
    ratingCount: seed.ratingCount,
    verified: true,
    coverGradient: seed.coverGradient,
  }));
}

/** Lead-time floor in hours. Mirrors `MockBookingGateway` (24h BR-021). */
export const BOOKING_LEAD_HOURS = 24;

/** Returns hours remaining until the booking window closes for a class. */
export function hoursUntilBookingDeadline(startsAt: string): number {
  const deadlineMs =
    new Date(startsAt).getTime() - BOOKING_LEAD_HOURS * HOUR;
  return Math.max(0, Math.round((deadlineMs - Date.now()) / HOUR));
}

/** Returns the calendar weekday + day/month string used in the card row. */
export function formatStartsAt(startsAt: string, locale: 'vi' | 'en'): string {
  const date = new Date(startsAt);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const weekday = date.getDay();
  const weekdays = locale === 'vi'
    ? ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${weekdays[weekday]}, ${day}/${month}`;
}

/** "Còn X/Y chỗ" for groups, "Còn X/X chỗ" for 1-1. Mirrors AC-029. */
export function formatSeats(
  format: 'one-on-one' | 'group-2-4',
  capacity: number,
): string {
  const taken = format === 'one-on-one' ? capacity - 1 : Math.max(0, capacity - 2);
  return `${taken + 1}/${capacity}`;
}
