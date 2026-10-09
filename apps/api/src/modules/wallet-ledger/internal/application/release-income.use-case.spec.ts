import { ReleaseIncomeUseCase } from './release-income.use-case';
import { FakeWalletRepository } from './testing/fakes';

describe('ReleaseIncomeUseCase (FR-009 / OQ-006)', () => {
  async function setup() {
    const wallets = new FakeWalletRepository();
    // Simulate a settled booking: learner paid, teacher has 90 pending.
    await wallets.addAvailable('st-1', 200);
    await wallets.settleBooking({
      bookingId: 'bk-1',
      learnerId: 'st-1',
      teacherId: 'tc-1',
      priceCredits: 100,
      teacherCredits: 90,
      platformFeeCredits: 10,
      traceId: 't0',
    });
    return { wallets, useCase: new ReleaseIncomeUseCase(wallets) };
  }

  it('moves pending income to available on completion', async () => {
    const { wallets, useCase } = await setup();
    const result = await useCase.execute({
      bookingId: 'bk-1',
      teacherId: 'tc-1',
      amountCredits: 90,
      releaseKey: 'complete:bk-1',
    });
    expect(result.applied).toBe(true);
    expect(await wallets.getBalance('tc-1')).toEqual({ availableCredits: 90, pendingCredits: 0 });
  });

  it('does not double-release a retry with the same key (AC-015)', async () => {
    const { wallets, useCase } = await setup();
    await useCase.execute({ bookingId: 'bk-1', teacherId: 'tc-1', amountCredits: 90, releaseKey: 'k' });
    const retry = await useCase.execute({
      bookingId: 'bk-1',
      teacherId: 'tc-1',
      amountCredits: 90,
      releaseKey: 'k',
    });
    expect(retry.applied).toBe(false);
    expect(await wallets.getBalance('tc-1')).toEqual({ availableCredits: 90, pendingCredits: 0 });
  });

  it('releases a second, distinct booking normally (AC-015)', async () => {
    const { wallets, useCase } = await setup();
    await wallets.settleBooking({
      bookingId: 'bk-2',
      learnerId: 'st-1',
      teacherId: 'tc-1',
      priceCredits: 100,
      teacherCredits: 90,
      platformFeeCredits: 10,
      traceId: 't1',
    });
    await useCase.execute({ bookingId: 'bk-1', teacherId: 'tc-1', amountCredits: 90, releaseKey: 'k1' });
    const second = await useCase.execute({
      bookingId: 'bk-2',
      teacherId: 'tc-1',
      amountCredits: 90,
      releaseKey: 'k2',
    });
    expect(second.applied).toBe(true);
    expect(await wallets.getBalance('tc-1')).toEqual({ availableCredits: 180, pendingCredits: 0 });
  });
});
