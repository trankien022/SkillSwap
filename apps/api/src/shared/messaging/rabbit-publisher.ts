import type { OnApplicationShutdown } from '@nestjs/common';
import { connect } from 'amqplib';
import { BrokerUnavailableError, describeError } from '../errors';
import type { AppLogger } from '../logger/app-logger';
import type { AmqpConfirmChannel, AmqpConnection } from './amqp-types';
import { EVENT_EXCHANGE, PUBLISH_TIMEOUT_MS } from './constants';

function redactUrl(url: string): string {
  return url.replace(/\/\/[^@/]*@/, '//***@');
}

/** Confirms-publish adapter over RabbitMQ (§4: transactional outbox → broker). */
export class RabbitPublisher implements OnApplicationShutdown {
  private connection: AmqpConnection | null = null;
  private channel: AmqpConfirmChannel | null = null;
  private connecting: Promise<AmqpConnection> | null = null;
  private wasDown = false;

  constructor(
    private readonly url: string,
    private readonly logger: AppLogger,
  ) {}

  async publish(eventType: string, envelope: unknown): Promise<void> {
    const channel = await this.ensureChannel();
    const content = Buffer.from(JSON.stringify(envelope), 'utf8');
    try {
      await this.publishConfirmed(channel, eventType, content);
      if (this.wasDown) {
        this.wasDown = false;
        this.logger.warn({}, 'RabbitMQ connection recovered');
      }
    } catch (error) {
      this.invalidate(error);
      throw error;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    const connection = this.connection;
    this.invalidate();
    if (connection !== null) {
      try {
        await connection.close();
      } catch {
        /* already closed */
      }
    }
  }

  private async ensureChannel(): Promise<AmqpConfirmChannel> {
    if (this.channel !== null) {
      return this.channel;
    }
    const connection = await this.getConnection();
    try {
      const channel = await connection.createConfirmChannel();
      await channel.assertExchange(EVENT_EXCHANGE, 'topic', { durable: true });
      this.channel = channel;
      return channel;
    } catch (error) {
      this.invalidate(error);
      throw new BrokerUnavailableError('Cannot open RabbitMQ channel', { cause: error });
    }
  }

  private getConnection(): Promise<AmqpConnection> {
    if (this.connection !== null) {
      return Promise.resolve(this.connection);
    }
    if (this.connecting === null) {
      this.connecting = this.doConnect().finally(() => {
        this.connecting = null;
      });
    }
    return this.connecting;
  }

  private async doConnect(): Promise<AmqpConnection> {
    try {
      const connection = await connect(this.url);
      connection.on('error', (error: unknown) => this.onConnectionDown(error));
      connection.on('close', () => this.onConnectionDown(new Error('connection closed')));
      this.connection = connection;
      return connection;
    } catch (error) {
      this.onConnectionDown(error);
      throw new BrokerUnavailableError(`Cannot connect to RabbitMQ at ${redactUrl(this.url)}`, {
        cause: error,
      });
    }
  }

  private publishConfirmed(
    channel: AmqpConfirmChannel,
    routingKey: string,
    content: Buffer,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new BrokerUnavailableError(`Publish timed out for ${routingKey}`));
        }
      }, PUBLISH_TIMEOUT_MS);

      const finish = (error?: unknown): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        if (error !== undefined && error !== null) {
          reject(
            error instanceof Error
              ? error
              : new BrokerUnavailableError(`Publish failed for ${routingKey}`, { cause: error }),
          );
        } else {
          resolve();
        }
      };

      try {
        channel.publish(EVENT_EXCHANGE, routingKey, content, { persistent: true }, (error) =>
          finish(error ?? undefined),
        );
      } catch (error) {
        finish(error);
      }
    });
  }

  private onConnectionDown(error: unknown): void {
    const wasConnected = this.connection !== null || this.channel !== null;
    this.connection = null;
    this.channel = null;
    if (wasConnected && !this.wasDown) {
      this.wasDown = true;
      this.logger.warn({ err: describeError(error) }, 'RabbitMQ connection lost');
    }
  }

  private invalidate(error?: unknown): void {
    this.onConnectionDown(error);
  }
}
