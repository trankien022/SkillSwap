import { isReminderDue, CLASS_REMINDER_OFFSET_MINUTES } from '../domain/class';
import type {
  SendClassRemindersPort,
  SendClassRemindersResult,
} from './port/in/send-class-reminders';
import type { ClassRepository } from './port/out/class-repository';
import type { Clock } from './port/out/clock';

/**
 * FR-016 (W3): emits "class starting soon" once per class, for both parties.
 *
 * The loop is deliberately dull. The eligibility rule (`isReminderDue`) says whether a class is in
 * its window; the repository's claim says whether this run gets to send it. Neither decides the
 * other's question.
 *
 * The repository already filters by the same window and state, so the domain check here looks
 * redundant — it is not. It is the only place the rule is expressed in code that a unit test can
 * exercise without a database, and asserting the two agree is what keeps a change to one from
 * silently changing the other. A class that passes the SQL filter but fails the rule (a clock that
 * moved between the query and the loop) is skipped rather than reminded late.
 *
 * Claiming is the repository's job because it must be atomic with the outbox insert; a use case
 * that read "has this been reminded?" and then called emit would have a window in which two
 * instances both see "no".
 */
export class SendClassRemindersUseCase implements SendClassRemindersPort {
  constructor(
    private readonly classes: ClassRepository,
    private readonly clock: Clock,
    private readonly offsetMinutes: number = CLASS_REMINDER_OFFSET_MINUTES,
  ) {}

  async execute(): Promise<SendClassRemindersResult> {
    const now = this.clock.now();
    let reminded = 0;
    let skipped = 0;

    for (const candidate of await this.classes.findAwaitingReminder(now, this.offsetMinutes)) {
      if (!isReminderDue(candidate, now, this.offsetMinutes)) {
        continue;
      }
      const result = await this.classes.claimReminderAndEmit(
        candidate.id,
        'starting_soon',
        candidate.startsAt,
      );
      if (result.reminded) {
        reminded += 1;
      } else {
        skipped += 1;
      }
    }

    return { reminded, skipped };
  }
}
