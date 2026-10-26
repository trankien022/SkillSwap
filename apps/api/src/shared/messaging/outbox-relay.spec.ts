import { OutboxRelay } from './outbox-relay';
import type { ApiConfig } from '../config/api-config';
import type { AppLogger } from '../logger/app-logger';
import type { ModuleDataSourceRegistry } from './module-registry';
import type { RabbitPublisher } from './rabbit-publisher';
import { BrokerUnavailableError } from '../errors';
import type { OutboxRow } from './outbox-statements';

/**
 * ADR-013 Amendment A / W2 C2 (decided 2026-10-25): only a schema-validation
 * failure at publish time is terminal. Everything else must retry.
 *
 * The defect these specs pin: `recordAttemptStatement` increments `attempts` and
 * flips the row to `DEAD` at `maxDeliveryAttempts` for *any* error, so a socket
 * reset permanently destroys an event carrying money (BR-033).
 */

const MODULE = 'live-class';
const SCHEMA = 'live_class';

interface RecordedQuery {
  sql: string;
  params?: unknown[];
}

function row(id: string): OutboxRow {
  return {
    id,
    event_type: 'class.completed',
    payload: { classId: 'cls-1' },
    created_at: new Date('2026-10-25T00:00:00.000Z'),
  };
}

function createHarness(options: {
  error: unknown;
  rows?: OutboxRow[];
  maxDeliveryAttempts?: number;
}) {
  const recorded: RecordedQuery[] = [];
  const claimedRows = options.rows ?? [row('row-1')];

  // The relay runs claim + publish + mark inside ONE transaction, and records
  // attempts through the same data source afterwards.
  const source = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      recorded.push({ sql, params });
      return [];
    }),
    transaction: jest.fn(
      async (work: (manager: { query: (sql: string, params?: unknown[]) => Promise<unknown> }) => Promise<void>) =>
        work({
          query: jest.fn(async (sql: string, params?: unknown[]) => {
            recorded.push({ sql, params });
            return /^\s*SELECT/i.test(sql) ? claimedRows : [];
          }),
        }),
    ),
  };

  const registry = {
    names: () => [MODULE],
    get: () => source,
    getSchema: () => SCHEMA,
    ready: Promise.resolve(),
  } as unknown as ModuleDataSourceRegistry;

  const publisher = {
    publish: jest.fn(async () => {
      throw options.error;
    }),
  } as unknown as RabbitPublisher;

  const config = {
    outboxPollIntervalMs: 1000,
    outboxBatchSize: 100,
    maxDeliveryAttempts: options.maxDeliveryAttempts ?? 5,
  } as unknown as ApiConfig;

  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as AppLogger;

  const relay = new OutboxRelay(config, registry, publisher, logger);

  return {
    relay,
    recorded,
    recordedAttempts: () => recorded.filter((q) => /attempts = attempts \+ 1/i.test(q.sql)),
    scheduledRetries: () =>
      recorded.filter((q) => /next_attempt_at = \$3/i.test(q.sql)),
  };
}

/** Runs one drain tick. `drainModule` is private by design; the tick is the public path. */
async function tick(relay: OutboxRelay): Promise<void> {
  await (relay as unknown as { runTick(): Promise<void> }).runTick();
}

describe('OutboxRelay publish-error classification (ADR-013 Amendment A)', () => {
  it('does NOT burn an attempt when the error is transient (ECONNRESET)', async () => {
    const reset = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });
    const harness = createHarness({ error: reset });

    await tick(harness.relay);

    // The bug: today this records a terminal attempt for a socket reset.
    expect(harness.recordedAttempts()).toHaveLength(0);
  });

  it('schedules a backed-off retry instead of retrying on the next tick', async () => {
    // ADR-013 Amendment A (W2 C2): the row stays PENDING but is not due until the delay
    // elapses, so a broker that is up but resetting gets room to recover.
    const reset = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });
    const harness = createHarness({ error: reset });

    await tick(harness.relay);

    const scheduled = harness.scheduledRetries();
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]?.params?.[0]).toBe('row-1');
    // First failure backs off by one poll interval, not a fixed constant.
    const dueAt = new Date(String(scheduled[0]?.params?.[2]));
    expect(dueAt.getTime()).toBeGreaterThan(Date.now());
    expect(dueAt.getTime()).toBeLessThanOrEqual(Date.now() + 5000);
  });

  it('does NOT burn an attempt when the error is unrecognised but not provably the payload', async () => {
    const harness = createHarness({ error: new Error('channel write failed') });

    await tick(harness.relay);

    expect(harness.recordedAttempts()).toHaveLength(0);
    expect(harness.scheduledRetries()).toHaveLength(1);
  });

  it('does NOT burn an attempt when the broker connection is unavailable', async () => {
    const harness = createHarness({ error: new BrokerUnavailableError('down') });

    await tick(harness.relay);

    expect(harness.recordedAttempts()).toHaveLength(0);
    // A broker that is down is not the row's fault: the connection is retried on the normal
    // tick, so no per-row backoff is written and a recovery publishes immediately.
    expect(harness.scheduledRetries()).toHaveLength(0);
  });

  it('marks the row DEAD when the payload fails schema validation', async () => {
    // The only case that may burn a row: a defect in the payload itself.
    const invalid = Object.assign(new Error('payload failed schema validation'), {
      name: 'OutboxPayloadInvalidError',
    });
    const harness = createHarness({ error: invalid });

    await tick(harness.relay);

    expect(harness.recordedAttempts()).toHaveLength(1);
    // The terminal write names the row and the error, and is marked terminal.
    const [attempt] = harness.recordedAttempts();
    expect(attempt.params?.[0]).toBe('row-1');
    expect(String(attempt.params?.[1])).toContain('schema validation');
  });
});
