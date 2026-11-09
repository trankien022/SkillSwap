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

interface FakeChannel {
  prefetch: jest.Mock;
  assertExchange: jest.Mock;
  assertQueue: jest.Mock;
  bindQueue: jest.Mock;
  consume: jest.Mock;
  close: jest.Mock;
  ack: jest.Mock;
  nack: jest.Mock;
  sendToQueue: jest.Mock;
}

interface FakeConnection {
  close: jest.Mock<Promise<void>, []>;
  on: jest.Mock;
  createChannel: jest.Mock;
  emitClose: () => void;
  channel: FakeChannel;
}

function makeChannel(): FakeChannel {
  return {
    prefetch: jest.fn(async () => undefined),
    assertExchange: jest.fn(async () => undefined),
    assertQueue: jest.fn(async () => undefined),
    bindQueue: jest.fn(async () => undefined),
    consume: jest.fn(async () => undefined),
    close: jest.fn(async () => undefined),
    ack: jest.fn(),
    nack: jest.fn(),
    sendToQueue: jest.fn(() => true),
  };
}

function makeConnection(): FakeConnection {
  const listeners: Record<string, Array<() => void>> = {};
  const channel = makeChannel();
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
    createChannel: jest.fn(async () => channel),
    emitClose: () => (listeners.close ?? []).forEach((fn) => fn()),
    channel,
  };
  return connection;
}

/** A registry with `queueCount` modules, each bound to two routing keys. */
function makeRegistry(queueCount: number): EventHandlerRegistry {
  const queues = Array.from({ length: queueCount }, (_unused, index) => {
    const moduleName = `module-${index}`;
    return {
      moduleName,
      queue: moduleName,
      eventTypes: [`${moduleName}.first`, `${moduleName}.second`],
    };
  });
  return {
    isEmpty: () => false,
    queues: () => queues,
    handlersFor: () => [async () => undefined],
  } as unknown as EventHandlerRegistry;
}

function makeConsumer(handlerCount = 1): RabbitConsumer {
  const config = { rabbitmqUrl: 'amqp://localhost', maxDeliveryAttempts: 5 } as unknown as ApiConfig;
  const registry = { ready: Promise.resolve(), names: () => [] } as unknown as ModuleDataSourceRegistry;
  const store = { runOnce: jest.fn(async () => undefined) } as unknown as PostgresProcessedEventStore;
  return new RabbitConsumer(config, registry, makeRegistry(handlerCount), store, makeLogger());
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

describe('RabbitConsumer topology (ADR-013 Amendment B)', () => {
  /** Boots a consumer against a fake broker and returns the channel it set up. */
  async function boot(handlerCount: number): Promise<FakeChannel> {
    const consumer = makeConsumer(handlerCount);
    consumer.onApplicationBootstrap();
    await flush();
    const connection = makeConnection();
    resolveConnect(connection);
    await new Promise<void>((resolve) => setImmediate(resolve));
    await consumer.onApplicationShutdown();
    return connection.channel;
  }

  it('declares three queues per module, not per handler', async () => {
    const channel = await boot(5);

    // 5 modules × (main + retry + dlq).
    expect(channel.assertQueue).toHaveBeenCalledTimes(15);
    const declared = channel.assertQueue.mock.calls.map((call) => call[0] as string);
    expect(declared).toEqual(
      expect.arrayContaining([
        'module-0',
        'module-0.retry',
        'module-0.dlq',
        'module-4',
        'module-4.retry',
        'module-4.dlq',
      ]),
    );
  });

  it('binds every routing key of a module to its one queue', async () => {
    const channel = await boot(2);

    const bindings = channel.bindQueue.mock.calls.map((call) => [call[0], call[2]]);
    expect(bindings).toEqual([
      ['module-0', 'module-0.first'],
      ['module-0', 'module-0.second'],
      ['module-1', 'module-1.first'],
      ['module-1', 'module-1.second'],
    ]);
  });

  it('consumes one queue per module', async () => {
    const channel = await boot(3);
    expect(channel.consume).toHaveBeenCalledTimes(3);
  });

  it('dead-letters a retried event back to its own module queue', async () => {
    const channel = await boot(1);
    const retry = channel.assertQueue.mock.calls.find(
      (call) => call[0] === 'module-0.retry',
    );
    expect(retry?.[1]).toMatchObject({
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': 'module-0',
      },
    });
  });
});
