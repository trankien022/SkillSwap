import { InsufficientBalanceError } from '../domain/wallet';
import { RecordBookingConfirmedUseCase } from './record-booking-confirmed.use-case';
import { FakeWalletRepository } from './testing/fakes';

describe('RecordBookingConfirmedUseCase (FR-009 / ADR-018)', () => {
  async function setup(learnerBalance = 10_000) {
    const wallets = new FakeWalletRepository();
    if (learnerBalance > 0) {
      await wallets.addAvailable('st-1', learnerBalance);
    }
    return { wallets, useCase: new RecordBookingConfirmedUseCase(wallets) };
  }

  it('debits the learner, splits 90/10 and credits the teacher pending (AC-004)', async () => {
    const { wallets, useCase } = await setup();
    const result = await useCase.execute({
      bookingId: 'bk-1',
      studentId: 'st-1',
      teacherId: 'tc-1',
      amountCredits: 100,
    });
    expect(result).toEqual({ applied: true, teacherCredits: 90, platformFeeCredits: 10 });
    expect(await wallets.getBalance('st-1')).toEqual({ availableCredits: 9900, pendingCredits: 0 });
    expect(await wallets.getBalance('tc-1')).toEqual({ availableCredits: 0, pendingCredits: 90 });
  });

  it('gives the rounding remainder to the teacher (OQ-012)', async () => {
    const { useCase } = await setup();
    const result = await useCase.execute({
      bookingId: 'bk-2',
      studentId: 'st-1',
      teacherId: 'tc-1',
      amountCredits: 101,
    });
    expect(result).toEqual({ applied: true, teacherCredits: 91, platformFeeCredits: 10 });
  });

  it('is a no-op on replay for the same booking', async () => {
    const { wallets, useCase } = await setup();
    await useCase.execute({ bookingId: 'bk-3', studentId: 'st-1', teacherId: 'tc-1', amountCredits: 100 });
    const replay = await useCase.execute({
      bookingId: 'bk-3',
      studentId: 'st-1',
      teacherId: 'tc-1',
      amountCredits: 100,
    });
    expect(replay.applied).toBe(false);
    expect(await wallets.getBalance('st-1')).toEqual({ availableCredits: 9900, pendingCredits: 0 });
  });

  it('leaves no partial state when the learner cannot pay (AC-005)', async () => {
    const { wallets, useCase } = await setup(50);
    await expect(
      useCase.execute({ bookingId: 'bk-4', studentId: 'st-1', teacherId: 'tc-1', amountCredits: 100 }),
    ).rejects.toThrow(InsufficientBalanceError);
    expect(await wallets.getBalance('st-1')).toEqual({ availableCredits: 50, pendingCredits: 0 });
    expect(await wallets.getBalance('tc-1')).toEqual({ availableCredits: 0, pendingCredits: 0 });
  });
});
