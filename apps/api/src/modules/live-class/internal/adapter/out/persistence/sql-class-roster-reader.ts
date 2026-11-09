import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type {
  ClassRosterEntry,
  ClassRosterReader,
} from '../../../application/port/out/class-roster-reader';

const BOOKINGS_TABLE = 'bookings';

interface RawRosterRow {
  booking_id: string;
  learner_id: string;
  state: string;
  created_at: Date | string;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * FR-011 / ADR-040: the teacher's view of who holds a seat.
 *
 * Reads `live_class.bookings` only. Learner names are resolved separately through the
 * `account-profile` facade — `account_profile` is another schema, so a join here is not
 * allowed (ADR-014). The `sql-*.spec.ts` guards assert this SQL never mentions it.
 *
 * "Active" mirrors the seat arithmetic elsewhere: a `pending` booking only counts while its
 * hold is unexpired, so a teacher does not see a seat that is about to be released as though
 * somebody had taken it.
 */
export class SqlClassRosterReader implements ClassRosterReader {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  async findActiveSeats(criteria: {
    classId: string;
    now: Date;
  }): Promise<readonly ClassRosterEntry[]> {
    const source = this.registry.get(this.moduleName);
    const bookings = qualified(this.registry.getSchema(this.moduleName), BOOKINGS_TABLE);

    const rows = (await source.query(
      `SELECT b."id" AS booking_id,
              b."learner_id",
              b."state",
              b."created_at"
         FROM ${bookings} b
        WHERE b."class_id" = $1
          AND (
                b."state" = 'confirmed'
                OR (b."state" = 'pending' AND b."expires_at" > $2)
              )
        ORDER BY b."created_at" ASC, b."id" ASC`,
      [criteria.classId, criteria.now.toISOString()],
    )) as RawRosterRow[];

    return rows.map((row) => ({
      bookingId: row.booking_id,
      learnerId: row.learner_id,
      state: row.state === 'pending' ? 'pending' : 'confirmed',
      createdAt: toDate(row.created_at),
    }));
  }
}
