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

/** "Còn X/Y chỗ" for groups, "Còn X/X chỗ" for 1-1. Mirrors AC-029.
 *
 * For 1-1: one seat is open, capacity is 1.
 * For groups: the mock seeds 2 of 4 taken so users see realistic scarcity.
 * When a real seat counter exists (API-004 booking count) replace
 * this with the live value from the gateway.
 */
export function formatSeats(
  format: 'one-on-one' | 'group-2-4',
  capacity: number,
): string {
  if (format === 'one-on-one') {
    return `1/${capacity}`;
  }
  const taken = Math.max(0, capacity - 2);
  return `${taken}/${capacity}`;
}

/* --- Class detail extension (FR-006 detail mock) --------------------- */

import type {
  ClassDetailView,
  PrerequisiteItem,
  ReviewView,
  SyllabusStep,
  TeacherCredential,
  TeacherStats,
} from './types';

/** Generic prerequisites shared by every demo class. The page renders
 * them verbatim; no class-specific PR language is fabricated. */
const sharedPrerequisites: PrerequisiteItem[] = [
  {
    icon: 'devices',
    title: 'Stable device',
    body: 'A laptop or desktop with a working camera and microphone so the teacher can give precise feedback.',
  },
  {
    icon: 'topic',
    title: 'Focus area',
    body: 'One or two topics you find hardest — we will spend the session on those first.',
  },
  {
    icon: 'conduct',
    title: 'Respectful conduct',
    body: 'Be on time, mute when not speaking, and follow the platform code of conduct. No personal contacts are exchanged outside the room.',
  },
];

/** Generic syllabus steps. The minutes split is per format:
 * 1-1 sums to durationMinutes; group follows the same pattern. */
function defaultSyllabus(durationMinutes: number): SyllabusStep[] {
  if (durationMinutes <= 60) {
    return [
      {
        order: 1,
        title: 'Warm-up & goal check',
        minutes: 10,
        body: 'Brief icebreaker and a one-minute goal check so the teacher can tailor the rest of the session.',
      },
      {
        order: 2,
        title: 'Core practice block',
        minutes: 40,
        body: 'Hands-on practice with the chosen topic. The teacher stops you only when a specific pattern needs fixing.',
      },
      {
        order: 3,
        title: 'Recap & next steps',
        minutes: 10,
        body: 'Quick recap, one concrete next action, and a question round before the timer ends.',
      },
    ];
  }
  return [
    {
      order: 1,
      title: 'Goal setting & diagnostic',
      minutes: 10,
      body: 'Quick warm-up so the teacher can read the current level and the focus for the next 80 minutes.',
    },
    {
      order: 2,
        title: 'Core technique block',
      minutes: 35,
      body: 'Demonstration of the main technique with a worked example, then a guided practice run.',
    },
    {
      order: 3,
        title: 'Independent practice',
      minutes: 30,
      body: 'You try the technique on your own while the teacher observes and pauses you at decision points.',
    },
    {
      order: 4,
        title: 'Review & next action',
      minutes: 15,
      body: 'Recap, one concrete next action, and a question round before the timer ends.',
    },
  ];
}

/** Default credential set; never exposes a real person or score. */
const defaultCredentials: TeacherCredential[] = [
  {
    icon: 'description',
    title: 'Skill evidence on file',
    body: 'Approved evidence for the advertised skill is on file with the SkillSwap Verifier Council.',
    verifiedBy: 'SkillSwap Verifier Council',
  },
  {
    icon: 'military_tech',
    title: 'Reached the teaching bar',
    body: 'Cleared the minimum bar for group/1-1 sessions at the advertised level. No public score is shown.',
    verifiedBy: 'SkillSwap Verifier Council',
  },
];

/** Build the full ClassDetailView for a single MarketplaceClass seed. */
function buildDetail(
  item: MarketplaceClass,
  opts: {
    description: string;
    teacherBio: string;
    teacherStats: TeacherStats;
    reviews: ReviewView[];
  },
): ClassDetailView {
  return {
    ...item,
    description: opts.description,
    syllabus: defaultSyllabus(item.durationMinutes),
    prerequisites: sharedPrerequisites,
    teacherBio: opts.teacherBio,
    teacherStats: opts.teacherStats,
    teacherCredentials: defaultCredentials,
    reviews: opts.reviews,
    // The demo fixture has no session behind it: it is never bookable, the
    // visitor has no hold on it, and no seat count is supplied to reason from.
    canBook: false,
    ownBooking: null,
    availableSeats: null,
  };
}

/**
 * Build a stable list of detail views for the six demo classes.
 *
 * The reviews and stats are illustrative. Teacher names stay generic
 * ('Demo teacher · ...') and never carry a real Vietnamese name, a
 * specific band-score, or a fabricated credential.
 */
export function demoClassDetails(): ClassDetailView[] {
  const baseItems = demoMarketplaceClasses();
  const details = baseItems.map((item, idx) => {
    return buildDetail(item, detailByIndex(idx));
  });
  return details;
}

function detailByIndex(idx: number): {
  description: string;
  teacherBio: string;
  teacherStats: TeacherStats;
  reviews: ReviewView[];
} {
  // The shape is per-class but stays generic on purpose.
  const baseReviews: ReviewView[] = [
    {
      id: `review-${idx}-1`,
      authorName: 'Demo learner 1',
      schoolName: 'Demo university A',
      rating: 5,
      body: 'Came in with a specific goal, left with a clear next action. Time was used well.',
      attendedOn: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
    },
    {
      id: `review-${idx}-2`,
      authorName: 'Demo learner 2',
      schoolName: 'Demo university B',
      rating: 5,
      body: 'Direct, no filler. The teacher corrected exactly the patterns I asked about.',
      attendedOn: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
    },
    {
      id: `review-${idx}-3`,
      authorName: 'Demo learner 3',
      schoolName: 'Demo university C',
      rating: 4,
      body: 'Solid session. Would book again for the same skill at the same level.',
      attendedOn: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
    },
  ];

  const baseStats: TeacherStats = {
    hoursTaught: 60 + idx * 12,
    responseRatePct: 100,
    learnersHelped: 25 + idx * 8,
  };

  // Per-class copy is short and free of fabricated credentials.
  const variants = [
    {
      description:
        'A 60-minute deep dive on the topic you bring in. The teacher runs a short diagnostic, then spends the rest of the time on the patterns you actually need.',
      teacherBio:
        'Demo teacher · IELTS. Has been teaching on SkillSwap since the cohort opened, focuses on the advanced speaking band and the academic writing transitions.',
    },
    {
      description:
        'A 90-minute small-group session (2-4 learners). The teacher circulates while each learner works the same problem set, then debriefs at the end.',
      teacherBio:
        'Demo teacher · Algorithms. Background in competitive programming. Runs a calm, structured session — every step is explained twice before any code is written.',
    },
    {
      description:
        'A 60-minute portfolio review. You bring three projects; the teacher picks the strongest one and works through concrete edits in Figma.',
      teacherBio:
        'Demo teacher · UI/UX. Product designer by trade. Prefers auto-layout and design tokens, but is happy to look at classic frame-based work.',
    },
    {
      description:
        'A 90-minute small-group session on running an OLS regression end to end. We use the same dataset across the cohort so the debrief is comparable.',
      teacherBio:
        'Demo teacher · Econometrics. Tutors undergraduate and masters students on the modelling pipeline from raw data to the written-up result.',
    },
    {
      description:
        'A 60-minute speaking practice. You bring a 3-minute pitch, the teacher gives the same 5-point feedback grid every time so you can see the trend over sessions.',
      teacherBio:
        'Demo teacher · Public speaking. Coach at university debate clubs. Calm presence, no surprises.',
    },
    {
      description:
        'A 90-minute backend walkthrough. We pick one REST surface, build the request/response contracts first, then wire the persistence layer.',
      teacherBio:
        'Demo teacher · Backend. Engineering lead at a student-run backend club. Strong on idempotency, weak on UI jokes.',
    },
  ] as const;

  return {
    description: variants[idx % variants.length]?.description ?? variants[0].description,
    teacherBio: variants[idx % variants.length]?.teacherBio ?? variants[0].teacherBio,
    teacherStats: baseStats,
    reviews: baseReviews,
  };
}
