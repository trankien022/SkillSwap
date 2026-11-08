import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../messages/en.json';
import type { ClassDetailView } from '../../lib/marketplace/types';
import { PrerequisitesSection } from './PrerequisitesSection';
import { SyllabusSection } from './SyllabusSection';
import { TeacherDossierSection } from './TeacherDossierSection';
import { ScheduleSection } from './ScheduleSection';
import { StickyBookingCard } from './StickyBookingCard';
import { DetailHeader } from './DetailHeader';

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/classes/cls-1',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

afterEach(cleanup);

function makeItem(overrides: Partial<ClassDetailView> = {}): ClassDetailView {
  return {
    id: 'cls-1',
    teacherId: 'tch-1',
    state: 'published',
    title: 'System Design Interview Prep',
    startsAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
    durationMinutes: 60,
    priceCredits: 100,
    capacity: 10,
    teacherName: 'Linh Nguyen',
    schoolCode: null,
    schoolName: null,
    skillName: 'System Design',
    skillCategory: 'programming',
    level: 'advanced',
    format: 'group',
    ratingAvg: 4.8,
    ratingCount: 6,
    verified: true,
    coverGradient: { from: '#0f172a', to: '#1e293b' },
    description: 'Real class description written by the teacher.',
    syllabus: [],
    prerequisites: [],
    teacherBio: null,
    teacherStats: null,
    teacherCredentials: [],
    reviews: [],
    canBook: true,
    ownBooking: null,
    availableSeats: 7,
    ...overrides,
  };
}

describe('Class detail sections content gating & real seat counts (W2)', () => {
  it('omits PrerequisitesSection when prerequisites is empty', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <PrerequisitesSection item={makeItem({ prerequisites: [] })} />
      </NextIntlClientProvider>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the description in SyllabusSection and omits the empty <ol> when syllabus is empty', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <SyllabusSection item={makeItem({ syllabus: [] })} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('Real class description written by the teacher.')).toBeDefined();
    expect(container.querySelector('ol')).toBeNull();
  });

  it('omits the empty school paragraph and credentials heading in TeacherDossierSection when absent', () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <TeacherDossierSection
          item={makeItem({ schoolName: null, teacherCredentials: [] })}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('Linh Nguyen')).toBeDefined();
    expect(screen.queryByText(en.ClassDetail.dossier.credentialsHeading)).toBeNull();
  });

  it('shows the real availableSeats count in ScheduleSection and StickyBookingCard instead of fabricating capacity - 2', () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <ScheduleSection item={makeItem({ capacity: 10, availableSeats: 10 })} />
        <StickyBookingCard item={makeItem({ capacity: 10, availableSeats: 10 })} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('10/10 seats available')).toBeDefined();
    expect(screen.getByText('10/10')).toBeDefined();
    expect(screen.queryByText('8/10 seats available')).toBeNull();
  });

  it('renders availabilityUnknown when availableSeats is null', () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <ScheduleSection item={makeItem({ capacity: 10, availableSeats: null })} />
        <StickyBookingCard item={makeItem({ capacity: 10, availableSeats: null })} />
      </NextIntlClientProvider>,
    );
    expect(screen.getAllByText(en.Marketplace.card.availabilityUnknown)).toHaveLength(2);
  });

  it('renders the level chip beside the format chip in DetailHeader when level is set and omits it when null (W4)', () => {
    const { rerender } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <DetailHeader item={makeItem({ level: 'advanced', format: 'group' })} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(en.Marketplace.card.levels.advanced)).toBeDefined();

    rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <DetailHeader item={makeItem({ level: null, format: 'group' })} />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByText(en.Marketplace.card.levels.advanced)).toBeNull();
  });
});
