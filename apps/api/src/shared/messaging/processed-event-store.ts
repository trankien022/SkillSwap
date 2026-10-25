import { describeError } from '../errors';
import { PROCESSED_EVENTS_TABLE } from './constants';
import type { ModuleDataSourceRegistry } from './module-registry';
import { qualified } from '../sql/ident';
import { UNSEQUENCED, type Watermark } from './event-sequence';

/** A delivery as the ordering guard sees it: which aggregate, and how far along it is. */
export interface DeliveryOrder {
  aggregateId: string | null;
  sequence: number;
}

/**
 * Idempotent consumer bookkeeping (ADR-010): at-least-once delivery is made
 * safe by recording each event id per consumer queue in its owning module schema.
 *
 * ADR-013 Amendment A (W2 C1) adds the neighbour of that problem: the broker has no
 * ordering, so the same consumer can see event 5 before event 4 of one aggregate. The
 * ordering guard lives here because this is the only place every handler must pass through —
 * putting it in each handler is the unwritten convention this programme exists to remove.
 *
 * The watermark is written **after** the handler, so an event that failed can never block a
 * newer one from being applied, and a redelivery of the same event is still handled by the
 * id check above rather than by the sequence.
 */
export class PostgresProcessedEventStore {
  constructor(private readonly registry: ModuleDataSourceRegistry) {}

  async runOnce(
    moduleName: string,
    consumerId: string,
    eventId: string,
    handler: () => Promise<void>,
    order?: DeliveryOrder,
  ): Promise<void> {
    const source = this.registry.get(moduleName);
    const schema = this.registry.getSchema(moduleName);
    const table = qualified(schema, PROCESSED_EVENTS_TABLE);
    const processedId = `${consumerId}:${eventId}`;

    // Only events that can be placed within an aggregate are guarded; a payload without a
    // recognisable id (or an unstamped one) has no sequence worth comparing.
    const guarded =
      order !== undefined && order.aggregateId !== null && order.sequence !== UNSEQUENCED;
    const aggregateId = order?.aggregateId ?? null;
    const sequence = order?.sequence ?? UNSEQUENCED;

    const inserted = (await source.query(
      `INSERT INTO ${table} (id, status) VALUES ($1, 'PROCESSING') ON CONFLICT (id) DO NOTHING RETURNING id`,
      [processedId],
    )) as unknown[];

    if (inserted.length === 0) {
      const existing = (await source.query(`SELECT status FROM ${table} WHERE id = $1`, [
        processedId,
      ])) as Array<{ status: string }>;
      if (existing[0]?.status === 'DONE') {
        return;
      }
    }

    try {
      if (guarded) {
        const seen = await this.loadWatermark(source, table, consumerId, aggregateId!);
        // `seen === undefined` means this aggregate has applied nothing yet — not that its
        // watermark is null. Collapsing the two would silently disable the guard entirely,
        // which is exactly the bug this branch was written to avoid.
        if (seen !== undefined && sequence < seen) {
          // Overtaken: a newer state for this aggregate is already applied. Deliberately
          // recorded as DONE — it is not pending work, and retrying it would loop forever.
          await this.markDone(source, table, processedId);
          return;
        }
      }

      await handler();

      if (guarded) {
        await this.saveWatermark(source, table, consumerId, aggregateId!, sequence);
      }
      await this.markDone(source, table, processedId);
    } catch (error) {
      await source
        .query(
          `UPDATE ${table} SET status = 'FAILED', error = $2, processed_at = now() WHERE id = $1 AND status <> 'DONE'`,
          [processedId, describeError(error)],
        )
        .catch(() => undefined);
      throw error;
    }
  }

  private async markDone(
    source: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    table: string,
    processedId: string,
  ): Promise<void> {
    await source.query(`UPDATE ${table} SET status = 'DONE', processed_at = now() WHERE id = $1`, [
      processedId,
    ]);
  }

  /**
   * The highest sequence this consumer has applied for an aggregate, in memory first and in
   * the database second. The memory copy serves the common case without a round trip; the row
   * is what survives a restart or another instance of the same consumer.
   *
   * `undefined` means "nothing has been applied for this aggregate yet", which is different
   * from a stored row whose `sequence` is null (an unstamped event states no position). Only
   * the former lets a first event through, so the two must not be collapsed into one value.
   */
  private async loadWatermark(
    source: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    table: string,
    consumerId: string,
    aggregateId: string,
  ): Promise<number | undefined> {
    const key = this.key(consumerId, aggregateId);
    const cached = this.watermarks.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const rows = (await source.query(
      `SELECT "sequence" FROM ${table} WHERE id = $1 AND status = 'DONE'`,
      [key],
    )) as Array<{ sequence: number | null }>;
    const stored = rows[0]?.sequence;
    if (typeof stored !== 'number') {
      return undefined;
    }
    this.remember(key, stored);
    return stored;
  }

  /** Writes the watermark, never moving it backwards when two deliveries race. */
  private async saveWatermark(
    source: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    table: string,
    consumerId: string,
    aggregateId: string,
    sequence: number,
  ): Promise<void> {
    const key = this.key(consumerId, aggregateId);
    await source.query(
      `INSERT INTO ${table} (id, status, "sequence") VALUES ($1, 'DONE', $2) ` +
        `ON CONFLICT (id) DO UPDATE SET "sequence" = GREATEST(COALESCE(${table}."sequence", -1), $2)`,
      [key, sequence],
    );
    this.remember(key, sequence);
  }

  private key(consumerId: string, aggregateId: string): string {
    return `${consumerId}:seq:${aggregateId}`;
  }

  private remember(key: string, sequence: number): void {
    this.watermarks.set(key, sequence);
    if (this.watermarks.size > WATERMARK_RETENTION) {
      const oldest = this.watermarks.keys().next();
      if (!oldest.done) {
        this.watermarks.delete(oldest.value);
      }
    }
  }

  private readonly watermarks = new Map<string, number>();
}

/** How many watermarks are cached in memory before the oldest are dropped. */
const WATERMARK_RETENTION = 5000;

export type { Watermark };
