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
  type OutboxRow,
} from './outbox-statements';

type ModuleOutcome = 'ok' | 'broker-down';

/**
 * Polls every module's outbox (SKIP LOCKED), publishes confirms and marks
 * rows PUBLISHED — claim + publish + mark run inside ONE transaction so a
 * crash can never mark a row published before the broker acknowledged it.
 */
export class OutboxRelay implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;
  private inFlight = false;

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

  private async processBatch(
    moduleName: string,
    batchSize: number,
  ): Promise<{ outcome: ModuleOutcome; count: number }> {
    const source = this.registry.get(moduleName);
    const schema = this.registry.getSchema(moduleName);
    const claim = claimPendingStatement(schema);
    const mark = markPublishedStatement(schema);
    const record = recordAttemptStatement(schema);
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
            payload: row.payload,
          });
        }
        await manager.query(mark, [claimed.map((row) => row.id)]);
      });
      return { outcome: 'ok', count: claimed.length };
    } catch (error) {
      if (error instanceof BrokerUnavailableError) {
        // The publisher logs connection transitions — stay quiet here.
        return { outcome: 'broker-down', count: claimed.length };
      }
      const message = describeError(error);
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
