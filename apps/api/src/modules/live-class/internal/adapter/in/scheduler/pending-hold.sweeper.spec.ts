import { PendingHoldSweeper } from './pending-hold.sweeper';
import type { AppLogger } from '../../../../../../shared/logger/app-logger';
import type { ExpirePendingBookingsPort } from '../../../application/port/in/expire-pending-bookings';

function silentLogger(): AppLogger {
  const noop = (): void => undefined;
  const logger = {
    child: () => logger,
    log: noop,
    error: noop,
    warn: noop,
    debug: noop,
    verbose: noop,
    fatal: noop,
  };
  return logger as unknown as AppLogger;
}

describe('PendingHoldSweeper (FR-007 / AC-026)', () => {
  it('invokes the expiry use case and returns the released count', async () => {
    const expire: ExpirePendingBookingsPort = { execute: jest.fn(async () => ({ expired: 3 })) };
    const sweeper = new PendingHoldSweeper(expire, silentLogger());
    expect(await sweeper.sweep()).toBe(3);
    expect(expire.execute).toHaveBeenCalledTimes(1);
  });

  it('guards against overlapping runs', async () => {
    let resolve: (value: { expired: number }) => void = () => undefined;
    const expire: ExpirePendingBookingsPort = {
      execute: jest.fn(
        () =>
          new Promise<{ expired: number }>((res) => {
            resolve = res;
          }),
      ),
    };
    const sweeper = new PendingHoldSweeper(expire, silentLogger());
    const first = sweeper.sweep();
    const second = await sweeper.sweep(); // overlap: skipped
    expect(second).toBe(0);
    resolve({ expired: 1 });
    expect(await first).toBe(1);
    expect(expire.execute).toHaveBeenCalledTimes(1);
  });

  it('swallows errors and reports zero', async () => {
    const expire: ExpirePendingBookingsPort = {
      execute: jest.fn(async () => {
        throw new Error('db down');
      }),
    };
    const sweeper = new PendingHoldSweeper(expire, silentLogger());
    expect(await sweeper.sweep()).toBe(0);
  });
});
