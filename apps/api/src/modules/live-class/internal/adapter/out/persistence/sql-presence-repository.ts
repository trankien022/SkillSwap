import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type { PresenceSession } from '../../../domain/presence';
import type {
  PresenceRecord,
  PresenceRepository,
} from '../../../application/port/out/presence-repository';

const PRESENCE_TABLE = 'class_presence';

interface PresenceRow {
  account_id: string;
  joined_at: Date | string;
  left_at: Date | string | null;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * FR-011 / FR-020 (AC-035): `class_presence`, one row per participant session.
 *
 * The two writes are deliberately asymmetric. A join is **insert-if-absent** so a
 * redelivered `participant-joined` cannot open a second session; a leave is
 * **update-most-recent-open** so a redelivered `participant-left` finds nothing open
 * and does nothing. Jitsi retries webhooks, so both must be idempotent, and neither
 * may invent a session that the room never had.
 */
export class SqlPresenceRepository implements PresenceRepository {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get table(): string {
    return qualified(this.registry.getSchema(this.moduleName), PRESENCE_TABLE);
  }

  async recordJoin(record: PresenceRecord): Promise<void> {
    const source = this.registry.get(this.moduleName);
    const table = this.table;
    await source.query(
      `INSERT INTO ${table} ("class_id", "account_id", "joined_at", "left_at")
       SELECT $1, $2, $3, NULL
        WHERE NOT EXISTS (
          SELECT 1 FROM ${table}
           WHERE "class_id" = $1 AND "account_id" = $2 AND "left_at" IS NULL
        )`,
      [record.classId, record.accountId, record.joinedAt.toISOString()],
    );
  }

  async recordLeave(record: PresenceRecord): Promise<void> {
    const source = this.registry.get(this.moduleName);
    const table = this.table;
    // Closes the newest open session only. If the participant re-joined twice without
    // an intervening leave, one leave corresponds to the session they are in now.
    await source.query(
      `UPDATE ${table} SET "left_at" = $3
        WHERE "id" = (
          SELECT "id" FROM ${table}
           WHERE "class_id" = $1 AND "account_id" = $2 AND "left_at" IS NULL
           ORDER BY "joined_at" DESC
           LIMIT 1
        )`,
      [record.classId, record.accountId, record.joinedAt.toISOString()],
    );
  }

  async listSessions(classId: string): Promise<PresenceSession[]> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT "account_id", "joined_at", "left_at" FROM ${this.table}
        WHERE "class_id" = $1
        ORDER BY "joined_at" ASC`,
      [classId],
    )) as PresenceRow[];
    return rows.map((row) => ({
      accountId: row.account_id,
      joinedAt: toDate(row.joined_at),
      leftAt: row.left_at === null ? null : toDate(row.left_at),
    }));
  }

  async findTeacherFirstJoin(classId: string, teacherId: string): Promise<Date | null> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT MIN("joined_at") AS "first_joined_at" FROM ${this.table}
        WHERE "class_id" = $1 AND "account_id" = $2`,
      [classId, teacherId],
    )) as Array<{ first_joined_at: Date | string | null }>;
    const first = rows[0]?.first_joined_at;
    return first === undefined || first === null ? null : toDate(first);
  }
}
