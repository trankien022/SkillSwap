import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AppLogger } from '../../../../../../shared/logger/app-logger';
import {
  COMPLETE_ELAPSED_CLASSES,
  type CompleteElapsedClassesPort,
} from '../../../application/port/in/complete-elapsed-classes';

export const COMPLETION_SWEEP_INTERVAL_MS = 60 * 1000;

/**
 * FR-020 / ADR-021: periodically moves elapsed classes to Completed (or
 * Cancelled for a teacher no-show). Idempotent and overlap-guarded; the timer is
 * unref'd so it never keeps the process alive.
 */
@Injectable()
export class ClassCompletionSweeper implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    @Inject(COMPLETE_ELAPSED_CLASSES) private readonly complete: CompleteElapsedClassesPort,
    private readonly logger: AppLogger,
    private readonly intervalMs: number = COMPLETION_SWEEP_INTERVAL_MS,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.sweep(), this.intervalMs);
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  onModuleDestroy(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async sweep(): Promise<{ completed: number; cancelled: number }> {
    if (this.running) {
      return { completed: 0, cancelled: 0 };
    }
    this.running = true;
    try {
      const result = await this.complete.execute();
      if (result.completed > 0 || result.cancelled > 0) {
        this.logger.child('class-completion').log(result, 'Closed elapsed classes');
      }
      return result;
    } catch (error) {
      this.logger.child('class-completion').error(error, 'Class completion sweep failed');
      return { completed: 0, cancelled: 0 };
    } finally {
      this.running = false;
    }
  }
}
