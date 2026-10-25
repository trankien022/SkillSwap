import { startHarness, type Harness } from './harness';
import { ClassCompletionSweeper } from '../src/modules/live-class/internal/adapter/in/scheduler/class-completion.sweeper';
import { ClassReminderSweeper } from '../src/modules/live-class/internal/adapter/in/scheduler/class-reminder.sweeper';
import { PendingHoldSweeper } from '../src/modules/live-class/internal/adapter/in/scheduler/pending-hold.sweeper';

jest.setTimeout(60_000);

/**
 * The sweepers are providers built by `useFactory` and referenced by nothing else. That looks like
 * it should be dead code — a lazily-instantiated provider whose `onModuleInit` never runs — and it
 * was reported as exactly that during W3.
 *
 * It is not dead: Nest does construct factory providers and call their lifecycle hooks. Verified
 * by removing every other reference and watching these assertions still pass, and by removing this
 * test's only reason to exist — a sweeper that was never started.
 *
 * It stays because every other test in this suite calls `sweep()` by hand, which would keep passing
 * if the timers stopped being scheduled. This is the one place that asserts the API actually sweeps
 * by itself rather than only when a test pokes it.
 */
describe('E2E: the API boots with its sweepers running', () => {
  let harness: Harness;

  beforeAll(async () => {
    harness = await startHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  it.each([
    ['pending-hold expiry', PendingHoldSweeper],
    ['class completion', ClassCompletionSweeper],
    ['class reminders', ClassReminderSweeper],
  ])('schedules the %s sweep', (_name, token) => {
    const sweeper = harness.resolve<{ isRunning(): boolean }>(token);
    expect(sweeper.isRunning()).toBe(true);
  });
});
