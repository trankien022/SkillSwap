import { RecordBookingPaymentUseCase } from './record-booking-payment.use-case';
import type { BookingPaymentRepository } from './port/out/booking-payment-repository';

describe('RecordBookingPaymentUseCase (ADR-032)', () => {
  it('forwards the durable payment identity to live-class persistence', async () => {
    const bookings: BookingPaymentRepository = {
      applySuccessfulPayment: jest.fn(async () => ({ disposition: 'confirmed' as const })),
    };
    const useCase = new RecordBookingPaymentUseCase(bookings);
    const payment = {
      transactionId: '101',
      bookingId: 'booking-1',
      accountId: 'learner-1',
      amountCredits: 100,
      occurredAt: '2026-10-12T03:00:00.000Z',
    };

    await expect(useCase.execute(payment)).resolves.toEqual({ disposition: 'confirmed' });
    expect(bookings.applySuccessfulPayment).toHaveBeenCalledWith(payment);
  });
});
