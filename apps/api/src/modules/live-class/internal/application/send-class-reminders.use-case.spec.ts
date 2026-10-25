import { SendClassRemindersUseCase } from './send-class-reminders.use-case';
import { InMemoryClassRepository } from './testing/live-class-fakes';
import type { Clock } from './port/out/clock';

const STARTS_AT = new Date('2026-10-12T10:00:00.000Z');
/** 09:50Z: inside the 15-minute window that opened at 09:45Z. */
const NOW = new Date('2026-10-12T09:50:00.000Z');

function build(now: Date = NOW, offsetMinutes?: number) {
  const classes = new InMemoryClassRepository();
  const clock: Clock = { now: () => now };
  const useCase = new SendClassRemindersUseCase(classes, clock, offsetMinutes);
  return { classes, useCase };
}

describe('SendClassRemindersUseCase (FR-016 / W3)', () => {
  it('emits one reminder for a class inside its window', async () => {
    const { classes, useCase } = build();
    classes.reminderCandidates = [{ id: 'cls-1', state: 'published', startsAt: STARTS_AT }];

    await expect(useCase.execute()).resolves.toEqual({ reminded: 1, skipped: 0 });
    expect(classes.reminders).toEqual([
      { classId: 'cls-1', kind: 'starting_soon', startsAt: STARTS_AT },
    ]);
  });

  it('does not remind twice when two sweeps see the same class', async () => {
    // The lease lives in the repository, so the second run must lose the claim rather than
    // rely on the scan having filtered the class out.
    const { classes, useCase } = build();
    classes.reminderCandidates = [{ id: 'cls-1', state: 'published', startsAt: STARTS_AT }];

    await useCase.execute();
    await expect(useCase.execute()).resolves.toEqual({ reminded: 0, skipped: 1 });
    expect(classes.reminders).toHaveLength(1);
  });

  it('skips a class the rule says is not due, even if the scan offered it', async () => {
    // The scan is SQL and the rule is code; when they disagree (a clock that moved between the
    // query and the loop) the honest outcome is to send nothing rather than to be late.
    const { classes, useCase } = build(new Date('2026-10-12T09:44:59.999Z'));
    classes.reminderCandidates = [{ id: 'cls-1', state: 'published', startsAt: STARTS_AT }];

    await expect(useCase.execute()).resolves.toEqual({ reminded: 0, skipped: 0 });
    expect(classes.reminders).toEqual([]);
  });

  it('never reminds for a state that cannot happen', async () => {
    const { classes, useCase } = build();
    classes.reminderCandidates = [
      { id: 'cancelled', state: 'cancelled', startsAt: STARTS_AT },
      { id: 'done', state: 'completed', startsAt: STARTS_AT },
      { id: 'draft', state: 'draft', startsAt: STARTS_AT },
    ];

    await expect(useCase.execute()).resolves.toEqual({ reminded: 0, skipped: 0 });
    expect(classes.reminders).toEqual([]);
  });

  it('passes its configured offset to the scan instead of assuming fifteen minutes', async () => {
    const classes = new InMemoryClassRepository();
    const seen: number[] = [];
    classes.findAwaitingReminder = async (_now: Date, offsetMinutes: number) => {
      seen.push(offsetMinutes);
      return [];
    };
    const useCase = new SendClassRemindersUseCase(classes, { now: () => NOW }, 30);

    await useCase.execute();
    expect(seen).toEqual([30]);
  });

  it('keeps going after a class is claimed by someone else', async () => {
    // One lost race must not abandon the rest of the batch; a busy slot has many classes.
    const { classes, useCase } = build();
    classes.reminderCandidates = [
      { id: 'taken', state: 'published', startsAt: STARTS_AT },
      { id: 'mine', state: 'full', startsAt: STARTS_AT },
    ];
    await classes.claimReminderAndEmit('taken', 'starting_soon', STARTS_AT);

    await expect(useCase.execute()).resolves.toEqual({ reminded: 1, skipped: 1 });
    expect(classes.reminders).toEqual([
      { classId: 'taken', kind: 'starting_soon', startsAt: STARTS_AT },
      { classId: 'mine', kind: 'starting_soon', startsAt: STARTS_AT },
    ]);
  });
});
