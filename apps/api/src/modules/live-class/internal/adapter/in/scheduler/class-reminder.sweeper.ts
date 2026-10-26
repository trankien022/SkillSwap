import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AppLogger } from '../../../../../../shared/logger/app-logger';
import {
  SEND_CLASS_REMINDERS,
  type SendClassRemindersPort,
} from '../../../application/port/in/send-class-reminders';

export const REMINDER_SWEEP_INTERVAL_MS = 60 * 1000;

/**
 * FR-016 (W3): periodically emits "class starting soon". Same shape as `ClassCompletionSweeper`
 * on purpose — one timer idiom in this module, not two.
 *
 * The interval is shorter than the window by design: the window is 15 minutes wide, so a 60-second
 * tick cannot miss a class, and a missed tick (the process was busy) costs at most a minute of
 * lateness rather than a lost reminder.
 *
 * The sweep emits an event; it does not send a push. Delivery, retries and per-person dedup belong
 * to the outbox and the consumer, which is what keeps this timer from needing the lease the
 * repository already provides.
 */
@Injectable()
export class ClassReminderSweeper implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    @Inject(SEND_CLASS_REMINDERS) private readonly send: SendClassRemindersPort,
    private readonly logger: AppLogger,
    private readonly intervalMs: number = REMINDER_SWEEP_INTERVAL_MS,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.sweep(), this.intervalMs);
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  /** See `ClassCompletionSweeper.isRunning`: the boot E2E's only way to see a live timer. */
  isRunning(): boolean {
    return this.timer !== undefined;
  }

  onModuleDestroy(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async sweep(): Promise<{ reminded: number; skipped: number }> {
    if (this.running) {
      // A tick that lands while the previous one is still working is dropped, not queued: the
      // next tick will find the same classes if they are still due.
      return { reminded: 0, skipped: 0 };
    }
    this.running = true;
    try {
      const result = await this.send.execute();
      if (result.reminded > 0) {
        this.logger.child('class-reminder').log(result, 'Sent class reminders');
      }
      return result;
    } catch (error) {
      // A thrown scan must not kill the ticker: the next minute is a fresh chance, and a reminder
      // that is not sent yet stays due because the claim never happened.
      this.logger.child('class-reminder').error(error, 'Class reminder sweep failed');
      return { reminded: 0, skipped: 0 };
    } finally {
      this.running = false;
    }
  }
}
