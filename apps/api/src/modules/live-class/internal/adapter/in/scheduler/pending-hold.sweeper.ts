import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AppLogger } from '../../../../../../shared/logger/app-logger';
import {
  EXPIRE_PENDING_BOOKINGS,
  type ExpirePendingBookingsPort,
} from '../../../application/port/in/expire-pending-bookings';

export const HOLD_SWEEP_INTERVAL_MS = 60 * 1000;

/**
 * FR-007 / AC-026 (ADR-019): periodically releases expired pending holds. The
 * sweep is idempotent (the underlying UPDATE is atomic) and overlap-guarded, and
 * the timer is unref'd so it never keeps the process alive.
 */
@Injectable()
export class PendingHoldSweeper implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    @Inject(EXPIRE_PENDING_BOOKINGS) private readonly expire: ExpirePendingBookingsPort,
    private readonly logger: AppLogger,
    private readonly intervalMs: number = HOLD_SWEEP_INTERVAL_MS,
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

  async sweep(): Promise<number> {
    if (this.running) {
      return 0;
    }
    this.running = true;
    try {
      const { expired } = await this.expire.execute();
      if (expired > 0) {
        this.logger.child('hold-sweeper').log({ expired }, 'Released expired booking holds');
      }
      return expired;
    } catch (error) {
      this.logger.child('hold-sweeper').error(error, 'Pending hold sweep failed');
      return 0;
    } finally {
      this.running = false;
    }
  }
}
