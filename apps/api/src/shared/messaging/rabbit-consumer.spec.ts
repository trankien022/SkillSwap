import { RabbitConsumer } from './rabbit-consumer';
import type { EventHandlerRegistry } from './event-handler-registry';
import type { ModuleDataSourceRegistry } from './module-registry';
import type { PostgresProcessedEventStore } from './processed-event-store';
import type { ApiConfig } from '../config/api-config';
import type { AppLogger } from '../logger/app-logger';

// amqplib's `connect` is deferred so a test can shut the consumer down WHILE a
// connection is in flight, then let it resolve and assert it is torn down.
let resolveConnect: (connection: unknown) => void;

jest.mock('amqplib', () => ({
  connect: jest.fn(
    () =>
      new Promise((resolve) => {
        resolveConnect = resolve;
      }),
  ),
}));

function makeLogger(): AppLogger {
  const noop = (): void => undefined;
  const logger = { log: noop, warn: noop, error: noop, child: () => logger } as unknown as AppLogger;
  return logger;
}

interface FakeConnection {
  close: jest.Mock<Promise<void>, []>;
  on: jest.Mock;
  createChannel: jest.Mock;
  emitClose: () => void;
}

function makeConnection(): FakeConnection {
  const listeners: Record<string, Array<() => void>> = {};
  const connection: FakeConnection = {
    close: jest.fn(async () => {
      // amqplib emits 'close' after the socket is torn down; the consumer must not
      // react to it by reconnecting once it is stopped.
      (listeners.close ?? []).forEach((fn) => fn());
    }),
    on: jest.fn((event: string, fn: () => void) => {
      (listeners[event] ??= []).push(fn);
      return connection;
    }),
    createChannel: jest.fn(async () => ({
      prefetch: jest.fn(async () => undefined),
      assertExchange: jest.fn(async () => undefined),
      assertQueue: jest.fn(async () => undefined),
      bindQueue: jest.fn(async () => undefined),
      consume: jest.fn(async () => undefined),
      close: jest.fn(async () => undefined),
      ack: jest.fn(),
      nack: jest.fn(),
      sendToQueue: jest.fn(() => true),
    })),
    emitClose: () => (listeners.close ?? []).forEach((fn) => fn()),
  };
  return connection;
}

function makeConsumer(): RabbitConsumer {
  const config = { rabbitmqUrl: 'amqp://localhost', maxDeliveryAttempts: 5 } as unknown as ApiConfig;
  const registry = { ready: Promise.resolve(), names: () => [] } as unknown as ModuleDataSourceRegistry;
  const handlers = {
    isEmpty: () => false,
    list: () => [
      { moduleName: 'schedule', eventType: 'evt', queue: 'q', handler: async () => undefined },
    ],
  } as unknown as EventHandlerRegistry;
  const store = {} as PostgresProcessedEventStore;
  return new RabbitConsumer(config, registry, handlers, store, makeLogger());
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  (jest.requireMock('amqplib') as { connect: jest.Mock }).connect.mockClear();
});

describe('RabbitConsumer shutdown race', () => {
  it('reports ready only after queues are bound and consuming', async () => {
    const consumer = makeConsumer();
    consumer.onApplicationBootstrap();
    await flush();
    expect(consumer.isReady()).toBe(false);

    resolveConnect(makeConnection());
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(consumer.isReady()).toBe(true);
    await consumer.onApplicationShutdown();
  });

  it('closes a connection that resolves after shutdown instead of adopting it', async () => {
    const consumer = makeConsumer();
    consumer.onApplicationBootstrap();
    await flush();

    const shutdown = consumer.onApplicationShutdown();
    const connection = makeConnection();
    resolveConnect(connection);

    await shutdown;

    expect(connection.close).toHaveBeenCalledTimes(1);
  });

  it('does not reconnect once stopped, even after the socket closes', async () => {
    const consumer = makeConsumer();
    consumer.onApplicationBootstrap();
    await flush();
    const shutdown = consumer.onApplicationShutdown();

    const connection = makeConnection();
    resolveConnect(connection);
    await shutdown;
    // The fresh connection was closed (which emits 'close' on a real socket);
    // a stopped consumer must not react by scheduling a reconnect.
    connection.emitClose();
    await flush();

    const { connect } = jest.requireMock('amqplib') as { connect: jest.Mock };
    expect(connect).toHaveBeenCalledTimes(1);
  });
});
