import { ClassReminderSweeper, REMINDER_SWEEP_INTERVAL_MS } from './class-reminder.sweeper';
import type { AppLogger } from '../../../../../../shared/logger/app-logger';
import type {
  SendClassRemindersPort,
  SendClassRemindersResult,
} from '../../../application/port/in/send-class-reminders';

function silentLogger(): AppLogger {
  const noop = (): void => undefined;
  const logger = { child: () => logger, log: noop, error: noop, warn: noop, debug: noop, verbose: noop, fatal: noop };
  return logger as unknown as AppLogger;
}

describe('ClassReminderSweeper (FR-016 / W3)', () => {
  it('runs the sweep and returns its counts', async () => {
    const send: SendClassRemindersPort = {
      execute: jest.fn(async () => ({ reminded: 3, skipped: 1 })),
    };
    const sweeper = new ClassReminderSweeper(send, silentLogger());
    expect(await sweeper.sweep()).toEqual({ reminded: 3, skipped: 1 });
  });

  it('drops a tick that lands while the previous one is still running', async () => {
    let resolve: (value: SendClassRemindersResult) => void = () => undefined;
    const send: SendClassRemindersPort = {
      execute: jest.fn(() => new Promise((res) => (resolve = res))),
    };
    const sweeper = new ClassReminderSweeper(send, silentLogger());
    const first = sweeper.sweep();
    expect(await sweeper.sweep()).toEqual({ reminded: 0, skipped: 0 });
    // The overlap is a drop, not a second pass: the port was entered once.
    expect(send.execute).toHaveBeenCalledTimes(1);
    resolve({ reminded: 1, skipped: 0 });
    expect(await first).toEqual({ reminded: 1, skipped: 0 });
  });

  it('survives a failing scan, because the next tick is a fresh chance', async () => {
    const failing: SendClassRemindersPort = {
      execute: jest.fn(async () => {
        throw new Error('db down');
      }),
    };
    const sweeper = new ClassReminderSweeper(failing, silentLogger());
    expect(await sweeper.sweep()).toEqual({ reminded: 0, skipped: 0 });
    // And it is not stuck in the "running" state that the overlap guard checks.
    expect(await sweeper.sweep()).toEqual({ reminded: 0, skipped: 0 });
    expect(failing.execute).toHaveBeenCalledTimes(2);
  });

  it('starts a ticker shorter than the reminder window and stops it on destroy', () => {
    // The window is 15 minutes; a minute tick cannot miss a class, and the margin is asserted here
    // so shrinking the interval below the tick cost is a deliberate change.
    expect(REMINDER_SWEEP_INTERVAL_MS).toBe(60_000);

    const send: SendClassRemindersPort = { execute: jest.fn(async () => ({ reminded: 0, skipped: 0 })) };
    const sweeper = new ClassReminderSweeper(send, silentLogger(), 5_000);
    sweeper.onModuleInit();
    sweeper.onModuleDestroy();
    // Destroying twice must not throw: Nest may call it on a failed boot.
    expect(() => sweeper.onModuleDestroy()).not.toThrow();
  });
});
