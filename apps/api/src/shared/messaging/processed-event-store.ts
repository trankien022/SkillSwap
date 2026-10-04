import { describeError } from '../errors';
import { PROCESSED_EVENTS_TABLE } from './constants';
import type { ModuleDataSourceRegistry } from './module-registry';
import { qualified } from '../sql/ident';

/**
 * Idempotent consumer bookkeeping (ADR-010): at-least-once delivery is made
 * safe by recording event ids per module schema.
 */
export class PostgresProcessedEventStore {
  constructor(private readonly registry: ModuleDataSourceRegistry) {}

  async runOnce(moduleName: string, eventId: string, handler: () => Promise<void>): Promise<void> {
    const source = this.registry.get(moduleName);
    const schema = this.registry.getSchema(moduleName);
    const table = qualified(schema, PROCESSED_EVENTS_TABLE);

    const inserted = (await source.query(
      `INSERT INTO ${table} (id, status) VALUES ($1, 'PROCESSING') ON CONFLICT (id) DO NOTHING RETURNING id`,
      [eventId],
    )) as unknown[];

    if (inserted.length === 0) {
      const existing = (await source.query(`SELECT status FROM ${table} WHERE id = $1`, [
        eventId,
      ])) as Array<{ status: string }>;
      if (existing[0]?.status === 'DONE') {
        return;
      }
    }

    try {
      await handler();
      await source.query(
        `UPDATE ${table} SET status = 'DONE', processed_at = now() WHERE id = $1`,
        [eventId],
      );
    } catch (error) {
      await source
        .query(
          `UPDATE ${table} SET status = 'FAILED', error = $2, processed_at = now() WHERE id = $1 AND status <> 'DONE'`,
          [eventId, describeError(error)],
        )
        .catch(() => undefined);
      throw error;
    }
  }
}
