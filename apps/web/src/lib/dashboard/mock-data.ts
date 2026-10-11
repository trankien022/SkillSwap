import type {
  CalendarDay,
  CharterEntry,
  DashboardSnapshot,
  LearnerBookingView,
  LearnerMetrics,
  WalletSnapshot,
} from './types';

/* --- Mock data layer (FR-021 booking lifecycle, FR-013 review) --- */

/** Hours to add to a base timestamp (Date.now()) for deterministic
 * relative start times in the demo fixture. The values are chosen
 * to make the dashboard show a realistic mix of states: one LIVE,
 * one PENDING (just finished, waiting for confirmation), two
 * UPCOMING (next 24-72h), one COMPLETED (last week). */
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function isoFromOffset(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

/** Five mock bookings, one per state group the dashboard surfaces. */
export function demoLearnerBookings(): LearnerBookingView[] {
  return [
    {
      id: 'bkg-demo-7f2a-0001',
      classId: 'demo-ielts-speaking',
      classTitle: 'IELTS speaking deep-dive — academic prompts',
      skillIcon: 'language',
      teacherName: 'Demo teacher · IELTS',
      teacherInitial: 'D',
      teacherSchoolLabel: 'Demo language faculty',
      startsAt: isoFromOffset(-15 * 60 * 1000), // started 15 min ago
      durationMinutes: 60,
      priceCredits: 40,
      state: 'in_progress',
      roomCode: 'SSW-DEMO-0A1B',
    },
    {
      id: 'bkg-demo-7f2a-0002',
      classId: 'demo-algorithms-101',
      classTitle: 'Dynamic programming & graph deep-dive',
      skillIcon: 'code',
      teacherName: 'Demo teacher · Algorithms',
      teacherInitial: 'D',
      teacherSchoolLabel: 'Demo CS faculty',
      startsAt: isoFromOffset(-90 * 60 * 1000), // finished 30 min ago
      durationMinutes: 90,
      priceCredits: 85,
      state: 'pending_learner_confirmation',
      autoReleaseCountdownSeconds: 23 * 3600 + 45 * 60,
      roomCode: 'SSW-DEMO-2C3D',
    },
    {
      id: 'bkg-demo-7f2a-0003',
      classId: 'demo-figma-portfolio',
      classTitle: 'Figma portfolio review — auto-layout & tokens',
      skillIcon: 'design',
      teacherName: 'Demo teacher · UI/UX',
      teacherInitial: 'D',
      teacherSchoolLabel: 'Demo design faculty',
      startsAt: isoFromOffset(23 * HOUR),
      durationMinutes: 60,
      priceCredits: 60,
      state: 'upcoming',
      roomCode: 'SSW-DEMO-4E5F',
    },
    {
      id: 'bkg-demo-7f2a-0004',
      classId: 'demo-econometrics-lab',
      classTitle: 'Econometrics lab — running an OLS regression',
      skillIcon: 'math',
      teacherName: 'Demo teacher · Econometrics',
      teacherInitial: 'D',
      teacherSchoolLabel: 'Demo econ faculty',
      startsAt: isoFromOffset(3 * DAY),
      durationMinutes: 90,
      priceCredits: 75,
      state: 'upcoming',
      roomCode: 'SSW-DEMO-6G7H',
    },
    {
      id: 'bkg-demo-7f2a-0005',
      classId: 'demo-public-speaking',
      classTitle: 'Public speaking practice — 3-minute pitch',
      skillIcon: 'business',
      teacherName: 'Demo teacher · Public speaking',
      teacherInitial: 'D',
      teacherSchoolLabel: 'Demo debate club',
      startsAt: isoFromOffset(-7 * DAY),
      durationMinutes: 60,
      priceCredits: 45,
      state: 'completed',
      roomCode: 'SSW-DEMO-8I9J',
      reviewSubmitted: {
        rating: 5,
        body: 'Calm, concrete, no surprises. The same feedback grid every time lets me see my trend.',
        submittedOn: isoFromOffset(-6 * DAY),
      },
      receiptId: 'rcpt-demo-7f2a-0005',
    },
  ];
}

export function demoLearnerMetrics(): LearnerMetrics {
  return {
    upcomingCount: 2,
    nextSessionLabel: 'Tomorrow 20:00',
    escrowHeldCredits: 145,
    escrowHeldClassCount: 2,
    totalCompletedHours: 28.5,
    monthlyTargetHours: 30,
    pendingReviewCount: 1,
  };
}

export function demoWalletSnapshot(): WalletSnapshot {
  return {
    availableCredits: 150,
    heldCredits: 145,
    totalCredits: 295,
    vndRate: 1000,
  };
}

/** Build a 6-week mini-calendar centred on the current month so
 * the page always has 35 cells to render (some from the previous
 * and next month, dimmed). */
export function demoCalendar(year: number, month: number): CalendarDay[] {
  const first = new Date(Date.UTC(year, month, 1));
  const firstWeekday = (first.getUTCDay() + 6) % 7; // Monday = 0
  const grid: CalendarDay[] = [];
  // Walk back to Monday of the week containing day 1.
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - firstWeekday);
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const bookingDays = new Set<string>([
    new Date(Date.now() + 23 * HOUR).toISOString().slice(0, 10),
    new Date(Date.now() + 3 * DAY).toISOString().slice(0, 10),
  ]);
  const liveDay = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    grid.push({
      date: key,
      inMonth: d.getUTCMonth() === month,
      isToday: key === todayKey,
      hasLiveSession: key === liveDay,
      hasBookedSession: bookingDays.has(key),
    });
  }
  return grid;
}

export function demoCharter(): CharterEntry[] {
  return [
    {
      icon: 'timer_off',
      title: '15-minute teacher no-show rule',
      body: 'If the teacher has not joined the room 15 minutes after the start time, the system will automatically return the held credits to your wallet.',
    },
    {
      icon: 'lock_person',
      title: 'Keep all contact inside the platform',
      body: 'Every message, file share and video call stays inside SkillSwap so the support team has a full record if a dispute is opened.',
    },
  ];
}

export function buildDemoSnapshot(): DashboardSnapshot {
  return {
    bookings: demoLearnerBookings(),
    metrics: demoLearnerMetrics(),
    wallet: demoWalletSnapshot(),
    calendar: demoCalendar(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
    ),
    charter: demoCharter(),
  };
}
