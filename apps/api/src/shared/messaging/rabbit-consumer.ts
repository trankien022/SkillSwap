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
  EVENT_EXCHANGE,
  RETRY_QUEUE_TTL_MS,
  TRANSIENT_RETRY_DELAY_MS,
} from './constants';
import type { EventHandlerRegistration, EventHandlerRegistry } from './event-handler-registry';
import { parseEnvelope } from './event-handler-registry';
import type { ModuleDataSourceRegistry } from './module-registry';
import type { PostgresProcessedEventStore } from './processed-event-store';

function isPermanent(error: unknown): boolean {
  if (error instanceof PermanentHandlerError || error instanceof SyntaxError) {
    return true;
  }
  return typeof error === 'object' && error !== null && (error as { name?: string }).name === 'ZodError';
}

function isTransient(error: unknown): boolean {
  if (error instanceof ModuleNotInitialisedError || error instanceof BrokerUnavailableError) {
    return true;
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
      for (const registration of this.handlers.list()) {
        await this.assertTopology(channel, registration);
        await channel.consume(registration.queue, (message) => {
          if (message !== null) {
            void this.onMessage(registration, message);
          }
        });
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

  private async assertTopology(
    channel: AmqpChannel,
    registration: EventHandlerRegistration,
  ): Promise<void> {
    const { queue, eventType } = registration;
    await channel.assertQueue(queue, { durable: true });
    await channel.assertQueue(`${queue}.retry`, {
      durable: true,
      arguments: {
        'x-message-ttl': RETRY_QUEUE_TTL_MS,
        'x-dead-letter-exchange': EVENT_EXCHANGE,
        'x-dead-letter-routing-key': eventType,
      },
    });
    await channel.assertQueue(`${queue}.dlq`, { durable: true });
    await channel.bindQueue(queue, EVENT_EXCHANGE, eventType);
  }

  private async onMessage(
    registration: EventHandlerRegistration,
    message: AmqpConsumeMessage,
  ): Promise<void> {
    try {
      await this.handle(registration, message);
    } catch (error) {
      this.logger.error(
        { queue: registration.queue, err: describeError(error) },
        'Message handling failed — requeue',
      );
      this.safeNack(message, true);
    }
  }

  private async handle(
    registration: EventHandlerRegistration,
    message: AmqpConsumeMessage,
  ): Promise<void> {
    try {
      const parsed = parseEnvelope(JSON.parse(message.content.toString('utf8')));
      await this.store.runOnce(registration.moduleName, parsed.id, () =>
        registration.handler(parsed),
      );
      this.safeAck(message);
    } catch (error) {
      await this.classify(registration, message, error);
    }
  }

  private async classify(
    registration: EventHandlerRegistration,
    message: AmqpConsumeMessage,
    error: unknown,
  ): Promise<void> {
    if (isPermanent(error)) {
      this.logger.error(
        { queue: registration.queue, err: describeError(error) },
        'Permanent failure — dead-lettering',
      );
      if (this.sendToDlq(registration, message)) {
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
        { queue: registration.queue, attempts: count, err: describeError(error) },
        'Max delivery attempts reached — dead-lettering',
      );
      if (this.sendToDlq(registration, message)) {
        this.safeAck(message);
      } else {
        this.safeNack(message, true);
      }
      return;
    }

    const delivered = this.sendToRetry(registration, message, count);
    if (delivered) {
      this.safeAck(message);
    } else {
      this.safeNack(message, true);
    }
  }

  private sendToRetry(
    registration: EventHandlerRegistration,
    message: AmqpConsumeMessage,
    count: number,
  ): boolean {
    const channel = this.channel;
    if (channel === null) {
      return false;
    }
    return channel.sendToQueue(`${registration.queue}.retry`, message.content, {
      persistent: true,
      headers: { ...message.properties.headers, 'x-retry-count': count },
      contentType: message.properties.contentType,
    });
  }

  private sendToDlq(
    registration: EventHandlerRegistration,
    message: AmqpConsumeMessage,
  ): boolean {
    const channel = this.channel;
    if (channel === null) {
      return false;
    }
    return channel.sendToQueue(`${registration.queue}.dlq`, message.content, {
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
