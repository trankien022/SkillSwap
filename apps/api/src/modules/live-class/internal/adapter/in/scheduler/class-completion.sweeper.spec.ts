import { ClassCompletionSweeper } from './class-completion.sweeper';
import type { AppLogger } from '../../../../../../shared/logger/app-logger';
import type { CompleteElapsedClassesPort } from '../../../application/port/in/complete-elapsed-classes';

function silentLogger(): AppLogger {
  const noop = (): void => undefined;
  const logger = { child: () => logger, log: noop, error: noop, warn: noop, debug: noop, verbose: noop, fatal: noop };
  return logger as unknown as AppLogger;
}

describe('ClassCompletionSweeper (FR-020)', () => {
  it('runs the sweep and returns its counts', async () => {
    const complete: CompleteElapsedClassesPort = {
      execute: jest.fn(async () => ({ completed: 2, cancelled: 1 })),
    };
    const sweeper = new ClassCompletionSweeper(complete, silentLogger());
    expect(await sweeper.sweep()).toEqual({ completed: 2, cancelled: 1 });
  });

  it('guards against overlap and swallows errors', async () => {
    let resolve: (value: { completed: number; cancelled: number }) => void = () => undefined;
    const complete: CompleteElapsedClassesPort = {
      execute: jest.fn(() => new Promise((res) => (resolve = res))),
    };
    const sweeper = new ClassCompletionSweeper(complete, silentLogger());
    const first = sweeper.sweep();
    expect(await sweeper.sweep()).toEqual({ completed: 0, cancelled: 0 });
    resolve({ completed: 1, cancelled: 0 });
    expect(await first).toEqual({ completed: 1, cancelled: 0 });

    const failing: CompleteElapsedClassesPort = {
      execute: jest.fn(async () => {
        throw new Error('db down');
      }),
    };
    expect(await new ClassCompletionSweeper(failing, silentLogger()).sweep()).toEqual({
      completed: 0,
      cancelled: 0,
    });
  });
});
