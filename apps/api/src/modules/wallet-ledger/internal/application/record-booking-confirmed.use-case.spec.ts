import { RecordBookingConfirmedUseCase } from './record-booking-confirmed.use-case';
import type { LedgerEntryWriter } from './port/out/ledger-entry-writer';

describe('RecordBookingConfirmedUseCase', () => {
  function setup(recorded = true) {
    const creditTeacher = jest.fn().mockResolvedValue({ recorded, amountCredits: 900 });
    const ledger: LedgerEntryWriter = { creditTeacher };
    return { useCase: new RecordBookingConfirmedUseCase(ledger), creditTeacher };
  }

  it('splits the fee and credits the teacher', async () => {
    const { useCase, creditTeacher } = setup();
    const result = await useCase.execute({
      bookingId: 'bk-1',
      studentId: 'st-1',
      teacherId: 'tc-1',
      amountCredits: 1000,
    });
    expect(creditTeacher).toHaveBeenCalledWith({
      bookingId: 'bk-1',
      teacherId: 'tc-1',
      amountCredits: 900,
    });
    expect(result).toEqual({ recorded: true, teacherCredits: 900, platformFeeCredits: 100 });
  });

  it('reports duplicate bookings without crediting again', async () => {
    const { useCase } = setup(false);
    const result = await useCase.execute({
      bookingId: 'bk-1',
      studentId: 'st-1',
      teacherId: 'tc-1',
      amountCredits: 400,
    });
    expect(result).toEqual({ recorded: false, teacherCredits: 360, platformFeeCredits: 40 });
  });

  it('rejects invalid amounts before touching the ledger', async () => {
    const { useCase, creditTeacher } = setup();
    await expect(
      useCase.execute({ bookingId: 'bk-2', studentId: 'st-1', teacherId: 'tc-1', amountCredits: 0 }),
    ).rejects.toThrow(RangeError);
    expect(creditTeacher).not.toHaveBeenCalled();
  });

  it('propagates ledger failures', async () => {
    const { useCase, creditTeacher } = setup();
    creditTeacher.mockRejectedValue(new Error('db down'));
    await expect(
      useCase.execute({ bookingId: 'bk-3', studentId: 'st-1', teacherId: 'tc-1', amountCredits: 100 }),
    ).rejects.toThrow('db down');
  });
});
