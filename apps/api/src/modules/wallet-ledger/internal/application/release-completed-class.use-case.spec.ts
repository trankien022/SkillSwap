import { ReleaseCompletedClassUseCase } from './release-completed-class.use-case';
import { FakeWalletRepository } from './testing/fakes';

describe('ReleaseCompletedClassUseCase (FR-020 / ADR-021)', () => {
  async function setup() {
    const wallets = new FakeWalletRepository();
    // Two settled bookings: teacher has 90 pending for each.
    await wallets.addAvailable('learner-1', 200);
    await wallets.addAvailable('learner-2', 200);
    await wallets.settleBooking({
      bookingId: 'b1',
      learnerId: 'learner-1',
      teacherId: 't1',
      priceCredits: 100,
      teacherCredits: 90,
      platformFeeCredits: 10,
      traceId: 'x',
    });
    await wallets.settleBooking({
      bookingId: 'b2',
      learnerId: 'learner-2',
      teacherId: 't1',
      priceCredits: 100,
      teacherCredits: 90,
      platformFeeCredits: 10,
      traceId: 'y',
    });
    return { wallets, useCase: new ReleaseCompletedClassUseCase(wallets) };
  }

  const event = {
    classId: 'cls-1',
    teacherId: 't1',
    bookings: [
      { bookingId: 'b1', learnerId: 'learner-1', priceCredits: 100 },
      { bookingId: 'b2', learnerId: 'learner-2', priceCredits: 100 },
    ],
  };

  it('moves each booking\'s pending income to available', async () => {
    const { wallets, useCase } = await setup();
    const result = await useCase.execute(event);
    expect(result.released).toBe(2);
    expect(await wallets.getBalance('t1')).toEqual({ availableCredits: 180, pendingCredits: 0 });
  });

  it('does not double-release on a replayed completion', async () => {
    const { wallets, useCase } = await setup();
    await useCase.execute(event);
    const replay = await useCase.execute(event);
    expect(replay.released).toBe(0);
    expect(await wallets.getBalance('t1')).toEqual({ availableCredits: 180, pendingCredits: 0 });
  });
});
