import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import { BookingPanel, type BookingCopy } from './booking-panel';
import { BookClassService } from '../../lib/booking/service';
import { MockBookingGateway, DEMO_CLASS_ID } from '../../lib/booking/mock-gateway';
import { demoClass } from '../../lib/booking/demo-class';
import { BookingError, type ClassView } from '../../lib/booking/domain';

afterEach(cleanup);

const t = en.Booking;
const errors = t.error as Record<string, string>;

const copy: BookingCopy = {
  title: t.title,
  bookCta: t.bookCta,
  booking: t.booking,
  pending: t.pending,
  pendingHint: t.pendingHint,
  errorTitle: t.errorTitle,
  notFound: t.notFound,
  error: (reason: string) => errors[reason] ?? errors.unknown,
  duration: (minutes: number) => t.duration.replace('{minutes}', String(minutes)),
  price: (credits: number) => t.price.replace('{credits}', String(credits)),
  capacity: (seats: number) => t.capacity.replace('{seats}', String(seats)),
  startsAt: (when: string) => t.startsAt.replace('{when}', when),
  durationLabel: t.durationLabel,
  seatsLabel: t.seatsLabel,
};

function renderPanel(gateway: MockBookingGateway, classId = DEMO_CLASS_ID) {
  return render(
    <BookingPanel classId={classId} service={new BookClassService(gateway)} copy={copy} />,
  );
}

/** Waits for the class to load, then clicks the now-enabled Book button. */
async function clickBook() {
  const button = await screen.findByRole('button', { name: t.bookCta });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(button);
}

describe('BookingPanel (FR-007)', () => {
  it('books a valid class and shows the pending pill', async () => {
    renderPanel(new MockBookingGateway());
    await clickBook();
    expect(await screen.findByText(t.pending)).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.bookCta })).toBeNull();
  });

  it('shows the full-class reason when the seat is taken', async () => {
    const gateway = new MockBookingGateway([{ ...demoClass(), capacity: 0 }]);
    renderPanel(gateway);
    await clickBook();
    expect((await screen.findByRole('alert')).textContent).toContain(errors.class_full);
  });

  it('shows the booking-window reason for a class inside 24 hours', async () => {
    const soon: ClassView = {
      ...demoClass(),
      id: 'soon',
      startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
    renderPanel(new MockBookingGateway([soon]), 'soon');
    await clickBook();
    expect((await screen.findByRole('alert')).textContent).toContain(errors.booking_window_closed);
  });

  it('shows the not-found message for an unknown class', async () => {
    renderPanel(new MockBookingGateway(), 'does-not-exist');
    expect(await screen.findByText(t.notFound)).toBeTruthy();
  });

  it('shows a generic error when the gateway throws unexpectedly', async () => {
    const gateway = new MockBookingGateway();
    gateway.bookClass = async () => {
      throw new BookingError('invalid_duration', 'boom');
    };
    renderPanel(gateway);
    await clickBook();
    expect((await screen.findByRole('alert')).textContent).toContain(errors.invalid_duration);
  });
});
