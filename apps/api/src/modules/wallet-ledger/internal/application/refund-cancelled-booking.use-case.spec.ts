import { RefundCancelledBookingUseCase } from './refund-cancelled-booking.use-case';
import { FakeWalletRepository } from './testing/fakes';

describe('RefundCancelledBookingUseCase (FR-007 / AC-022/AC-027)', () => {
  async function setup(settle: boolean) {
    const wallets = new FakeWalletRepository();
    await wallets.addAvailable('st-1', 500);
    if (settle) {
      await wallets.settleBooking({
        bookingId: 'bk-1',
        learnerId: 'st-1',
        teacherId: 'tc-1',
        priceCredits: 100,
        teacherCredits: 90,
        platformFeeCredits: 10,
        traceId: 't0',
      });
    }
    return { wallets, useCase: new RefundCancelledBookingUseCase(wallets) };
  }

  const event = {
    bookingId: 'bk-1',
    classId: 'cls-1',
    learnerId: 'st-1',
    teacherId: 'tc-1',
    priceCredits: 100,
  };

  it('refunds a settled booking: learner credited, teacher pending reduced', async () => {
    const { wallets, useCase } = await setup(true);
    // Before: learner 400 (500 - 100), teacher pending 90.
    const result = await useCase.execute(event);
    expect(result.applied).toBe(true);
    expect(await wallets.getBalance('st-1')).toEqual({ availableCredits: 500, pendingCredits: 0 });
    expect(await wallets.getBalance('tc-1')).toEqual({ availableCredits: 0, pendingCredits: 0 });
  });

  it('is a no-op for an unsettled (expired pending) booking', async () => {
    const { wallets, useCase } = await setup(false);
    const result = await useCase.execute(event);
    expect(result.applied).toBe(false);
    expect(await wallets.getBalance('st-1')).toEqual({ availableCredits: 500, pendingCredits: 0 });
  });

  it('refunds only once on replay', async () => {
    const { wallets, useCase } = await setup(true);
    await useCase.execute(event);
    const replay = await useCase.execute(event);
    expect(replay.applied).toBe(false);
    expect(await wallets.getBalance('st-1')).toEqual({ availableCredits: 500, pendingCredits: 0 });
  });
});
