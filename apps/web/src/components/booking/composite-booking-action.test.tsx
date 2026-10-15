import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import viMessages from '../../messages/vi.json';
import { BookingError, type BookingGateway } from '../../lib/booking/domain';
import { BookClassService } from '../../lib/booking/service';
import type { ClassDetailView } from '../../lib/marketplace/types';
import {
  CompositeBookingAction,
  activeHoldBookingId,
  disabledReasonKey,
} from './composite-booking-action';

/**
 * The class detail must behave the way the learner described it: **one**
 * button that books, checks the balance and confirms — sending them to checkout
 * only when the credits are missing, and never claiming a booking the server
 * has not confirmed.
 */
const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const DAY_MS = 24 * 60 * 60 * 1000;

function makeItem(overrides: Partial<ClassDetailView> = {}): ClassDetailView {
  return {
    id: 'class-1',
    teacherId: 'teacher-1',
    state: 'published',
    startsAt: new Date(Date.now() + 3 * DAY_MS).toISOString(),
    durationMinutes: 60,
    priceCredits: 40,
    capacity: 4,
    teacherName: 'Demo teacher',
    schoolCode: null,
    schoolName: null,
    skillName: 'English',
    skillCategory: 'language',
    level: 'intermediate',
    format: 'group-2-4',
    ratingAvg: null,
    ratingCount: 0,
    verified: null,
    coverGradient: { from: '#0f766e', to: '#14b8a6' },
    availableSeats: 3,
    description: '',
    syllabus: [],
    prerequisites: [],
    teacherBio: null,
    teacherStats: null,
    teacherCredentials: [],
    reviews: [],
    canBook: true,
    ownBooking: null,
    ...overrides,
  };
}

const booking = (state: string) => ({
  bookingId: 'bkg-1',
  classId: 'class-1',
  learnerId: 'learner-1',
  state,
  priceCredits: 40,
  createdAt: '2026-10-15T09:00:00.000Z',
});

/** The service plus the spies behind it, so assertions read the real calls. */
function makeService(handlers: {
  book?: ReturnType<typeof vi.fn>;
  confirm?: ReturnType<typeof vi.fn>;
  own?: ReturnType<typeof vi.fn>;
} = {}) {
  const book =
    handlers.book ?? vi.fn(async () => ({ booking: booking('pending'), created: true }));
  const confirm =
    handlers.confirm ?? vi.fn(async () => ({ confirmed: true, booking: booking('confirmed') }));
  const own =
    handlers.own ??
    vi.fn(async () => ({ bookingId: 'bkg-1', state: 'confirmed' as const, expiresAt: null }));

  const gateway: BookingGateway = {
    getClass: vi.fn(async () => {
      throw new Error('getClass is not part of this flow');
    }),
    bookClass: book,
    confirmBooking: confirm,
    getOwnBooking: own,
  };

  return { service: new BookClassService(gateway), book, confirm, own };
}

function renderAction(
  item: ClassDetailView,
  {
    service,
    readCredits = async () => 100,
  }: { service: BookClassService; readCredits?: () => Promise<number> },
) {
  return render(
    <NextIntlClientProvider locale="vi" messages={viMessages}>
      <CompositeBookingAction item={item} service={service} readCredits={readCredits} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  push.mockReset();
});

describe('CompositeBookingAction (D5: book → gate → confirm)', () => {
  it('offers exactly one button, labelled as the confirm-and-pay action', () => {
    const { service } = makeService();
    renderAction(makeItem(), { service });

    // The two-button era is over: no separate "Đặt lớp" and no second
    // "review & lock" entry to the same POST.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Xác nhận & Thanh toán' })).toBeDefined();
    expect(screen.queryByText('Đặt lớp')).toBeNull();
  });

  it('books, gates and confirms when the balance covers the price', async () => {
    const { service, book, confirm } = makeService();
    renderAction(makeItem(), { service, readCredits: async () => 100 });

    fireEvent.click(screen.getByRole('button'));

    await screen.findByText('Lớp đã được xác nhận');
    expect(book).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith('bkg-1');
    expect(push).not.toHaveBeenCalled();
  });

  it('shows success only when the read-back earns it', async () => {
    const { service } = makeService({
      confirm: vi.fn(async () => ({ confirmed: false, booking: null })),
      own: vi.fn(async () => ({ bookingId: 'bkg-1', state: 'pending' as const, expiresAt: null })),
    });
    renderAction(makeItem(), { service });

    fireEvent.click(screen.getByRole('button'));

    // `confirmed: false` while the hold is still pending is progress, not a win.
    await screen.findByText('Đang chờ hệ thống ghi nhận');
    expect(screen.queryByText('Lớp đã được xác nhận')).toBeNull();
  });

  it('navigates to checkout instead of confirming when the credits run short', async () => {
    const { service, confirm } = makeService();
    renderAction(makeItem({ priceCredits: 40 }), { service, readCredits: async () => 10 });

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/vi/classes/class-1/checkout'));
    // The gate failed: confirm is never attempted (no synchronous gate exists).
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByText('Lớp đã được xác nhận')).toBeNull();
  });

  it('treats an unreadable balance as a failed gate, not an affordable one', async () => {
    const { service, confirm } = makeService();
    renderAction(makeItem(), {
      service,
      readCredits: async () => {
        throw new Error('wallet unreachable');
      },
    });

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/vi/classes/class-1/checkout'));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('reuses an existing pending hold instead of booking a second seat', async () => {
    const { service, book, confirm } = makeService();
    const item = makeItem({
      // The trap: `canBook` is false precisely because the learner holds a seat.
      canBook: false,
      ownBooking: {
        bookingId: 'bkg-9',
        state: 'pending',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
    });
    renderAction(item, { service });

    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    fireEvent.click(button);

    await screen.findByText('Lớp đã được xác nhận');
    expect(book).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith('bkg-9');
  });

  it('surfaces a booking rejection as its reason and never as success', async () => {
    const { service, confirm } = makeService({
      book: vi.fn(async () => {
        throw new BookingError('class_full', 'Class has no available seats');
      }),
    });
    renderAction(makeItem(), { service });

    fireEvent.click(screen.getByRole('button'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Lớp này đã hết chỗ.');
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByText('Lớp đã được xác nhận')).toBeNull();
  });

  it("shows the server's confirm refusal instead of a success", async () => {
    const { service } = makeService({
      confirm: vi.fn(async () => {
        throw new Error('Số dư không đủ để xác nhận.');
      }),
      own: vi.fn(async () => null),
    });
    renderAction(makeItem(), { service });

    fireEvent.click(screen.getByRole('button'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Số dư không đủ để xác nhận.');
    expect(screen.queryByText('Lớp đã được xác nhận')).toBeNull();
  });

  it('lets a settling confirmation be re-checked rather than trusted', async () => {
    const { service, own } = makeService({
      confirm: vi.fn(async () => ({ confirmed: true, booking: booking('confirmed') })),
      // The read disagrees with the reply — and the read is what counts.
      own: vi.fn(async () => ({ bookingId: 'bkg-1', state: 'pending' as const, expiresAt: null })),
    });
    renderAction(makeItem(), { service });

    fireEvent.click(screen.getByRole('button'));

    await screen.findByText('Đang chờ hệ thống ghi nhận');
    expect(screen.getByRole('button', { name: 'Kiểm tra lại' })).toBeDefined();

    // Re-read: the hold has landed by now.
    own.mockResolvedValue({ bookingId: 'bkg-1', state: 'confirmed', expiresAt: null });
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại' }));

    await screen.findByText('Lớp đã được xác nhận');
  });
});

describe('disabled state reasons (derived from facts, never invented)', () => {
  it("names the reason the server's verdict implies", () => {
    const soon = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();
    expect(disabledReasonKey(makeItem({ canBook: false, availableSeats: 0 }))).toBe('full');
    expect(disabledReasonKey(makeItem({ canBook: false, state: 'draft' }))).toBe('notOpen');
    expect(disabledReasonKey(makeItem({ canBook: false, startsAt: soon }))).toBe('tooSoon');
    expect(
      disabledReasonKey(
        makeItem({
          canBook: false,
          ownBooking: { bookingId: 'bkg-1', state: 'confirmed', expiresAt: null },
        }),
      ),
    ).toBe('confirmed');
    expect(disabledReasonKey(makeItem({ canBook: false }))).toBe('notBookable');
  });

  it('enables the action when the server allows it or a hold already exists', () => {
    expect(disabledReasonKey(makeItem({ canBook: true }))).toBeNull();
    expect(
      disabledReasonKey(
        makeItem({
          canBook: false,
          ownBooking: {
            bookingId: 'bkg-1',
            state: 'pending',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          },
        }),
      ),
    ).toBeNull();
  });

  it('ignores an expired hold, whose seat the server no longer protects', () => {
    const expired = {
      bookingId: 'bkg-1',
      state: 'pending' as const,
      expiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
    };
    expect(activeHoldBookingId(makeItem({ ownBooking: expired }))).toBeNull();
    expect(disabledReasonKey(makeItem({ canBook: false, ownBooking: expired }))).toBe('notBookable');
  });

  it('renders the reason text under a disabled button', () => {
    const { service } = makeService();
    renderAction(makeItem({ canBook: false, availableSeats: 0 }), { service });

    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText('Lớp đã hết chỗ')).toBeDefined();
  });
});
