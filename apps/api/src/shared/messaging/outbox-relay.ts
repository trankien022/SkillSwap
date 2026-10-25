import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import type { AppLogger } from '../logger/app-logger';
import type { ApiConfig } from '../config/api-config';
import { BrokerUnavailableError, describeError } from '../errors';
import type { ModuleDataSourceRegistry } from './module-registry';
import type { RabbitPublisher } from './rabbit-publisher';
import {
  claimPendingStatement,
  markPublishedStatement,
  recordAttemptStatement,
  scheduleRetryStatement,
  type OutboxRow,
} from './outbox-statements';
import { isRetryablePublishError } from './publish-error-classification';
import { nextAttemptAt } from './retry-schedule';

type ModuleOutcome = 'ok' | 'broker-down';

/**
 * Polls every module's outbox (SKIP LOCKED), publishes confirms and marks
 * rows PUBLISHED — claim + publish + mark run inside ONE transaction so a
 * crash can never mark a row published before the broker acknowledged it.
 */
export class OutboxRelay implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;
  private inFlight = false;
  /**
   * ADR-013 Amendment A: how many retryable failures this relay has seen in a row.
   *
   * Backoff is per **failure streak**, not per row, because a publish failure rolls back the
   * whole claim: every row in the batch failed for the same reason, so counting per row would
   * multiply the same failure by the batch size. Reset to zero as soon as a batch publishes.
   */
  private failures = 0;

  constructor(
    private readonly config: ApiConfig,
    private readonly registry: ModuleDataSourceRegistry,
    private readonly publisher: RabbitPublisher,
    private readonly logger: AppLogger,
  ) {}

  onApplicationBootstrap(): void {
    this.registry.ready
      .then(() => this.start())
      .catch((error: unknown) => {
        this.logger.warn({ err: describeError(error) }, 'OutboxRelay idle: database unavailable');
      });
  }

  onApplicationShutdown(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private start(): void {
    if (this.timer !== null) {
      return;
    }
    this.timer = setInterval(() => {
      void this.runTick().catch((error: unknown) => {
        this.logger.error({ err: describeError(error) }, 'Outbox relay tick failed');
      });
    }, this.config.outboxPollIntervalMs);
    this.timer.unref();
  }

  private async runTick(): Promise<void> {
    if (this.inFlight) {
      return;
    }
    this.inFlight = true;
    try {
      for (const moduleName of this.registry.names()) {
        const outcome = await this.drainModule(moduleName);
        if (outcome === 'broker-down') {
          return;
        }
      }
    } finally {
      this.inFlight = false;
    }
  }

  private async drainModule(moduleName: string): Promise<ModuleOutcome> {
    const batchSize = this.config.outboxBatchSize;
    for (;;) {
      const { outcome, count } = await this.processBatch(moduleName, batchSize);
      if (outcome !== 'ok' || count < batchSize) {
        return outcome;
      }
    }
  }

  /**
   * The current failure streak, incremented as a retryable failure is recorded.
   *
   * Kept as a method rather than reading the field inline so the increment and the delay that
   * depends on it cannot drift apart.
   */
  private retryCount(): number {
    this.failures += 1;
    return this.failures;
  }

  private async processBatch(
    moduleName: string,
    batchSize: number,
  ): Promise<{ outcome: ModuleOutcome; count: number }> {
    const source = this.registry.get(moduleName);
    const schema = this.registry.getSchema(moduleName);
    const claim = claimPendingStatement(schema);
    const mark = markPublishedStatement(schema);
    const record = recordAttemptStatement(schema);
    const schedule = scheduleRetryStatement(schema);
    let claimed: OutboxRow[] = [];

    try {
      await source.transaction(async (manager) => {
        claimed = (await manager.query(claim, [batchSize])) as OutboxRow[];
        if (claimed.length === 0) {
          return;
        }
        for (const row of claimed) {
          await this.publisher.publish(row.event_type, {
            id: row.id,
            eventType: row.event_type,
            occurredAt: row.created_at.toISOString(),
            // ADR-013 Amendment A (W2 C1): rows written before the column carry null, which
            // stays absent so consumers read them as unstamped rather than as sequence 0.
            ...(row.sequence === null || row.sequence === undefined
              ? {}
              : { sequence: row.sequence }),
            payload: row.payload,
          });
        }
        await manager.query(mark, [claimed.map((row) => row.id)]);
      });
      // A successful batch ends the failure streak, so the next problem starts from the base
      // delay rather than the backoff ceiling of a streak that has already recovered.
      this.failures = 0;
      return { outcome: 'ok', count: claimed.length };
    } catch (error) {
      if (error instanceof BrokerUnavailableError) {
        // The publisher logs connection transitions — stay quiet here.
        return { outcome: 'broker-down', count: claimed.length };
      }
      const message = describeError(error);

      // ADR-013 Amendment A (W2 C2): only a payload defect may burn an attempt.
      // A transient or unrecognised failure leaves every claimed row PENDING — the
      // transaction above already rolled the mark back — and schedules a backed-off retry.
      if (isRetryablePublishError(error)) {
        const dueAt = nextAttemptAt(new Date(), this.retryCount(), this.config.outboxPollIntervalMs);
        let scheduled = 0;
        for (const row of claimed) {
          const written = await source
            .query(schedule, [row.id, message, dueAt.toISOString()])
            .catch((scheduleError: unknown) => {
              // The row stays PENDING and due, so the next tick retries it: a failed
              // backoff write degrades to "no backoff", never to a lost event.
              this.logger.warn(
                { err: describeError(scheduleError) },
                'Failed to schedule outbox retry',
              );
              return null;
            });
          if (written !== null) {
            scheduled += 1;
          }
        }
        this.logger.warn(
          {
            module: moduleName,
            err: message,
            rows: claimed.length,
            scheduled,
            nextAttemptAt: dueAt.toISOString(),
          },
          'Outbox publish failed; rows rescheduled for retry',
        );
        return { outcome: 'ok', count: claimed.length };
      }

      for (const row of claimed) {
        await source
          .query(record, [row.id, message, this.config.maxDeliveryAttempts])
          .catch((attemptError: unknown) => {
            this.logger.warn(
              { err: describeError(attemptError) },
              'Failed to record outbox attempt',
            );
          });
      }
      this.logger.error({ module: moduleName, err: message }, 'Outbox batch failed');
      return { outcome: 'ok', count: claimed.length };
    }
  }
}
