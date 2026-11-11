import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { connect } from 'amqplib';
import type { ApiConfig } from '../config/api-config';
import {
  BrokerUnavailableError,
  ModuleNotInitialisedError,
  PermanentHandlerError,
  describeError,
} from '../errors';
import type { AppLogger } from '../logger/app-logger';
import type { AmqpChannel, AmqpConnection, AmqpConsumeMessage } from './amqp-types';
import {
  CONSUMER_PREFETCH,
  DEFAULT_EXCHANGE,
  EVENT_EXCHANGE,
  RETRY_QUEUE_TTL_MS,
  TRANSIENT_RETRY_DELAY_MS,
} from './constants';
import type { ConsumerQueue, EventHandlerRegistry } from './event-handler-registry';
import { parseEnvelope } from './event-handler-registry';
import { orderingKeyOf, sequenceOf } from './event-sequence';
import type { ModuleDataSourceRegistry } from './module-registry';
import type { PostgresProcessedEventStore } from './processed-event-store';

function isPermanent(error: unknown): boolean {
  if (error instanceof PermanentHandlerError || error instanceof SyntaxError) {
    return true;
  }
  return typeof error === 'object' && error !== null && (error as { name?: string }).name === 'ZodError';
}

/**
 * Transport-level failures that are worth retrying. Shared with `OutboxRelay`
 * (ADR-013 Amendment A) so the publish and consume paths cannot drift apart on
 * what counts as transient.
 */
export function isTransient(error: unknown): boolean {
  if (error instanceof ModuleNotInitialisedError || error instanceof BrokerUnavailableError) {
    return true;
  }
  // Guard against a non-object `error` (a thrown string, or `catch` with no value).
  // The relay can now pass anything into this check, so it must not throw.
  if (error === null || typeof error !== 'object') {
    return false;
  }
  const code = (error as NodeJS.ErrnoException).code;
  return typeof code === 'string' && /^(ECONN|EPIPE|ETIMEDOUT|08|57)/.test(code);
}

function retryCount(headers: Record<string, unknown> | undefined): number {
  const raw = headers?.['x-retry-count'];
  const value = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? '0'), 10);
  return Number.isNaN(value) ? 0 : value;
}

/** Per-module queue consumer with retry/DLQ topology and failure classification. */
export class RabbitConsumer implements OnApplicationBootstrap, OnApplicationShutdown {
  private connection: AmqpConnection | null = null;
  private channel: AmqpChannel | null = null;
  private connecting: Promise<void> | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private waitTimer: NodeJS.Timeout | null = null;
  private resolveWait: (() => void) | null = null;
  private attempt = 0;
  private stopped = false;

  constructor(
    private readonly config: ApiConfig,
    private readonly registry: ModuleDataSourceRegistry,
    private readonly handlers: EventHandlerRegistry,
    private readonly store: PostgresProcessedEventStore,
    private readonly logger: AppLogger,
  ) {}

  onApplicationBootstrap(): void {
    if (this.handlers.isEmpty()) {
      return;
    }
    this.registry.ready
      .then(() => this.ensureLoop())
      .catch((error: unknown) => {
        this.logger.warn({ err: describeError(error) }, 'RabbitConsumer idle: database unavailable');
      });
  }

  onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.waitTimer !== null) {
      clearTimeout(this.waitTimer);
      this.waitTimer = null;
    }
    this.resolveWait?.();
    this.resolveWait = null;
    return this.teardown();
  }

  /** True once every registered queue is bound and consuming on the active channel. */
  isReady(): boolean {
    return this.channel !== null;
  }

  private ensureLoop(): void {
    if (this.stopped || this.connecting !== null || this.channel !== null) {
      return;
    }
    this.connecting = this.connectOnce().finally(() => {
      this.connecting = null;
    });
  }

  private async connectOnce(): Promise<void> {
    if (this.stopped || this.channel !== null) {
      return;
    }
    try {
      await this.connectAndConsume();
      this.attempt = 0;
    } catch (error) {
      this.scheduleRetry(error);
    }
  }

  private async connectAndConsume(): Promise<void> {
    let connection: AmqpConnection;
    try {
      connection = await connect(this.config.rabbitmqUrl);
    } catch (error) {
      throw new BrokerUnavailableError('Cannot connect to RabbitMQ', { cause: error });
    }

    connection.on('error', (error: unknown) => this.onDown(error));
    connection.on('close', () => this.onDown(new Error('connection closed')));

    try {
      const channel = await connection.createChannel();
      await channel.prefetch(CONSUMER_PREFETCH);
      await channel.assertExchange(EVENT_EXCHANGE, 'topic', { durable: true });
      for (const consumer of this.handlers.queues()) {
        await this.assertTopology(channel, consumer);
        await channel.consume(consumer.queue, (message) => {
          if (message !== null) {
            void this.onMessage(consumer, message);
          }
        });
      }
      // Shutdown may have run while we were connecting: tear the fresh socket down
      // instead of publishing it, otherwise a live connection would outlive
      // app.close() and keep the process (and the CI job) alive forever.
      if (this.stopped) {
        await this.closeQuietly(channel, connection);
        return;
      }
      this.connection = connection;
      this.channel = channel;
    } catch (error) {
      try {
        await connection.close();
      } catch {
        /* already closed */
      }
      throw error instanceof BrokerUnavailableError
        ? error
        : new BrokerUnavailableError('Cannot set up RabbitMQ consumer channel', { cause: error });
    }
  }

  private async closeQuietly(channel: AmqpChannel, connection: AmqpConnection): Promise<void> {
    try {
      await channel.close();
    } catch {
      /* already closed */
    }
    try {
      await connection.close();
    } catch {
      /* already closed */
    }
  }

  /**
   * One module queue, its retry queue and its DLQ, then one binding per routing key
   * (ADR-013 Amendment B).
   *
   * The retry queue used to dead-letter to the topic exchange with the event type baked in as
   * `x-dead-letter-routing-key`. That was exact while a queue served one event type. A module
   * queue serves many, and the header cannot vary per message, so the retry queue now dead-letters
   * to the **default exchange addressed to its own module queue**. The message returns to the
   * consumer that failed it and is dispatched again by the `eventType` in its envelope, which is
   * where the type actually lives.
   */
  private async assertTopology(channel: AmqpChannel, consumer: ConsumerQueue): Promise<void> {
    const { queue } = consumer;
    await channel.assertQueue(queue, { durable: true });
    await channel.assertQueue(`${queue}.retry`, {
      durable: true,
      arguments: {
        'x-message-ttl': RETRY_QUEUE_TTL_MS,
        'x-dead-letter-exchange': DEFAULT_EXCHANGE,
        'x-dead-letter-routing-key': queue,
      },
    });
    await channel.assertQueue(`${queue}.dlq`, { durable: true });
    for (const eventType of consumer.eventTypes) {
      await channel.bindQueue(queue, EVENT_EXCHANGE, eventType);
    }
  }

  private async onMessage(
    consumer: ConsumerQueue,
    message: AmqpConsumeMessage,
  ): Promise<void> {
    try {
      await this.handle(consumer, message);
    } catch (error) {
      this.logger.error(
        { queue: consumer.queue, err: describeError(error) },
        'Message handling failed — requeue',
      );
      this.safeNack(message, true);
    }
  }

  private async handle(
    consumer: ConsumerQueue,
    message: AmqpConsumeMessage,
  ): Promise<void> {
    try {
      const parsed = parseEnvelope(JSON.parse(message.content.toString('utf8')));
      const handlers = this.handlers.handlersFor(consumer.queue, parsed.eventType);
      if (handlers.length === 0) {
        // Bound but unknown: the routing key reached this queue, so something claims it. Acking
        // would report success for work nobody did, so it is classified as a payload defect.
        throw new PermanentHandlerError(
          `No handler for ${parsed.eventType} on queue ${consumer.queue}`,
        );
      }
      await this.store.runOnce(
        consumer.moduleName,
        consumer.queue,
        parsed.id,
        // Every handler for the event runs before the message is acked. All-or-nothing is
        // deliberate: a partial success would mark the event DONE for a consumer that never
        // applied it, and the sibling that did run is already required to be idempotent.
        async () => {
          for (const handler of handlers) {
            await handler(parsed);
          }
        },
        // ADR-013 Amendment A (W2 C1): every envelope is placed within its aggregate here,
        // so no handler has to remember to compare sequences itself.
        { aggregateId: orderingKeyOf(parsed.eventType, parsed.payload), sequence: sequenceOf(parsed) },
      );
      this.safeAck(message);
    } catch (error) {
      await this.classify(consumer, message, error);
    }
  }

  private async classify(
    consumer: ConsumerQueue,
    message: AmqpConsumeMessage,
    error: unknown,
  ): Promise<void> {
    if (isPermanent(error)) {
      this.logger.error(
        { queue: consumer.queue, err: describeError(error) },
        'Permanent failure — dead-lettering',
      );
      if (this.sendToDlq(consumer, message)) {
        this.safeAck(message);
      } else {
        this.safeNack(message, true);
      }
      return;
    }

    if (isTransient(error)) {
      await this.wait(TRANSIENT_RETRY_DELAY_MS);
      this.safeNack(message, true);
      return;
    }

    const count = retryCount(message.properties.headers) + 1;
    if (count >= this.config.maxDeliveryAttempts) {
      this.logger.error(
        { queue: consumer.queue, attempts: count, err: describeError(error) },
        'Max delivery attempts reached — dead-lettering',
      );
      if (this.sendToDlq(consumer, message)) {
        this.safeAck(message);
      } else {
        this.safeNack(message, true);
      }
      return;
    }

    const delivered = this.sendToRetry(consumer, message, count);
    if (delivered) {
      this.safeAck(message);
    } else {
      this.safeNack(message, true);
    }
  }

  private sendToRetry(
    consumer: ConsumerQueue,
    message: AmqpConsumeMessage,
    count: number,
  ): boolean {
    const channel = this.channel;
    if (channel === null) {
      return false;
    }
    return channel.sendToQueue(`${consumer.queue}.retry`, message.content, {
      persistent: true,
      headers: { ...message.properties.headers, 'x-retry-count': count },
      contentType: message.properties.contentType,
    });
  }

  private sendToDlq(
    consumer: ConsumerQueue,
    message: AmqpConsumeMessage,
  ): boolean {
    const channel = this.channel;
    if (channel === null) {
      return false;
    }
    return channel.sendToQueue(`${consumer.queue}.dlq`, message.content, {
      persistent: true,
      headers: message.properties.headers,
      contentType: message.properties.contentType,
    });
  }

  private safeAck(message: AmqpConsumeMessage): void {
    try {
      this.channel?.ack(message);
    } catch {
      /* channel already closed — broker requeues unacked messages */
    }
  }

  private safeNack(message: AmqpConsumeMessage, requeue: boolean): void {
    try {
      this.channel?.nack(message, false, requeue);
    } catch {
      /* channel already closed — broker requeues unacked messages */
    }
  }

  private onDown(error: unknown): void {
    const wasConnected = this.connection !== null || this.channel !== null;
    this.connection = null;
    this.channel = null;
    if (this.stopped) {
      return;
    }
    if (wasConnected) {
      this.logger.warn({ err: describeError(error) }, 'RabbitMQ consumer connection lost');
    }
    this.scheduleRetry(error);
  }

  private scheduleRetry(error: unknown): void {
    if (this.stopped || this.retryTimer !== null) {
      return;
    }
    const delay = Math.min(30000, 1000 * 2 ** Math.min(this.attempt, 5));
    this.attempt += 1;
    this.logger.warn({ delayMs: delay, err: describeError(error) }, 'RabbitMQ consumer retrying');
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.ensureLoop();
    }, delay);
    this.retryTimer.unref();
  }

  private wait(ms: number): Promise<void> {
    if (this.stopped) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.resolveWait = resolve;
      this.waitTimer = setTimeout(() => {
        this.waitTimer = null;
        this.resolveWait = null;
        resolve();
      }, ms);
      this.waitTimer.unref();
    });
  }

  private async teardown(): Promise<void> {
    // If a connect is still in flight it may assign a fresh socket after we return;
    // wait for it to settle (connectAndConsume re-checks `stopped` and closes it) so
    // nothing is left open when the app has fully shut down.
    if (this.connecting !== null) {
      try {
        await this.connecting;
      } catch {
        /* connect failure is already handled by scheduleRetry (a no-op when stopped) */
      }
    }
    const channel = this.channel;
    const connection = this.connection;
    this.channel = null;
    this.connection = null;
    if (channel !== null) {
      try {
        await channel.close();
      } catch {
        /* already closed */
      }
    }
    if (connection !== null) {
      try {
        await connection.close();
      } catch {
        /* already closed */
      }
    }
  }
}
