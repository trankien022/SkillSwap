import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { insertOutboxStatement } from '../../../../../../shared/messaging/outbox-statements';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import type {
  ClassEdit,
  ClassReminderKind,
  ClassRepository,
  CompletableClass,
  CreateClassRecord,
  PersistedClass,
} from '../../../application/port/out/class-repository';
import type {
  ClassCancellationReason,
  ClassState,
  ClassView,
  CompletionBasis,
} from '../../../domain/class';

const CLASSES_TABLE = 'classes';
const CLASS_SKILLS_TABLE = 'class_skills';
const BOOKINGS_TABLE = 'bookings';
const CLASS_REMINDERS_TABLE = 'class_reminders';
const CLASS_STARTED_EVENT = 'class.started';
const CLASS_COMPLETED_EVENT = 'class.completed';
const CLASS_CANCELLED_EVENT = 'class.cancelled';
const CLASS_STARTING_SOON_EVENT = 'class.starting.soon';

interface ClassRow {
  id: string;
  teacher_id: string;
  state: string;
  starts_at: Date | string;
  duration_minutes: number;
  price_credits: number;
  capacity: number;
  description: string;
  skill_ids: string[] | null;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toPersisted(row: ClassRow): PersistedClass {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    state: row.state as ClassState,
    startsAt: toDate(row.starts_at),
    durationMinutes: row.duration_minutes,
    priceCredits: row.price_credits,
    capacity: row.capacity,
    description: row.description,
    skillIds: row.skill_ids ?? [],
  };
}

export class SqlClassRepository implements ClassRepository {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get schema(): string {
    return this.registry.getSchema(this.moduleName);
  }

  async insert(record: CreateClassRecord): Promise<PersistedClass> {
    const source = this.registry.get(this.moduleName);
    const classes = qualified(this.schema, CLASSES_TABLE);
    const skills = qualified(this.schema, CLASS_SKILLS_TABLE);
    return source.transaction(async (manager) => {
      const rows = (await manager.query(
        `INSERT INTO ${classes} ("teacher_id", "state", "starts_at", "duration_minutes", "price_credits", "capacity", "description")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING "id", "teacher_id", "state", "starts_at", "duration_minutes", "price_credits", "capacity", "description"`,
        [
          record.teacherId,
          record.state,
          record.startsAt.toISOString(),
          record.durationMinutes,
          record.priceCredits,
          record.capacity,
          record.description,
        ],
      )) as Array<Omit<ClassRow, 'skill_ids'>>;
      const created = rows[0];
      if (created === undefined) {
        throw new Error('Class insert returned no row');
      }
      for (const skillId of record.skillIds) {
        await manager.query(
          `INSERT INTO ${skills} ("class_id", "skill_id") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [created.id, skillId],
        );
      }
      return toPersisted({ ...created, skill_ids: record.skillIds });
    });
  }

  async findById(id: string): Promise<PersistedClass | null> {
    const source = this.registry.get(this.moduleName);
    const classes = qualified(this.schema, CLASSES_TABLE);
    const skills = qualified(this.schema, CLASS_SKILLS_TABLE);
    const rows = (await source.query(
      `SELECT c."id", c."teacher_id", c."state", c."starts_at", c."duration_minutes",
              c."price_credits", c."capacity", c."description",
              COALESCE(array_agg(s."skill_id") FILTER (WHERE s."skill_id" IS NOT NULL), '{}') AS "skill_ids"
         FROM ${classes} c
         LEFT JOIN ${skills} s ON s."class_id" = c."id"
        WHERE c."id" = $1
        GROUP BY c."id"`,
      [id],
    )) as ClassRow[];
    const row = rows[0];
    return row === undefined ? null : toPersisted(row);
  }

  async markCancelled(id: string): Promise<void> {
    const source = this.registry.get(this.moduleName);
    const classes = qualified(this.schema, CLASSES_TABLE);
    await source.query(
      `UPDATE ${classes} SET "state" = 'cancelled', "updated_at" = now()
        WHERE "id" = $1 AND "state" <> 'cancelled'`,
      [id],
    );
  }

  async update(id: string, edit: ClassEdit): Promise<PersistedClass> {
    const source = this.registry.get(this.moduleName);
    const classes = qualified(this.schema, CLASSES_TABLE);
    const skills = qualified(this.schema, CLASS_SKILLS_TABLE);
    return source.transaction(async (manager) => {
      const rows = returnedRows<Omit<ClassRow, 'skill_ids'>>(
        await manager.query(
          `UPDATE ${classes}
             SET "starts_at" = $2, "duration_minutes" = $3, "price_credits" = $4,
                 "capacity" = $5, "description" = $6, "updated_at" = now()
           WHERE "id" = $1
           RETURNING "id", "teacher_id", "state", "starts_at", "duration_minutes", "price_credits", "capacity", "description"`,
          [
            id,
            edit.startsAt.toISOString(),
            edit.durationMinutes,
            edit.priceCredits,
            edit.capacity,
            edit.description,
          ],
        ),
      );
      const updated = rows[0];
      if (updated === undefined) {
        throw new Error(`Class ${id} not found for update`);
      }
      await manager.query(`DELETE FROM ${skills} WHERE "class_id" = $1`, [id]);
      for (const skillId of edit.skillIds) {
        await manager.query(
          `INSERT INTO ${skills} ("class_id", "skill_id") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, skillId],
        );
      }
      return toPersisted({ ...updated, skill_ids: edit.skillIds });
    });
  }

  async startAndEmit(classId: string): Promise<{ started: boolean }> {
    const source = this.registry.get(this.moduleName);
    const classes = qualified(this.schema, CLASSES_TABLE);
    return source.transaction(async (manager) => {
      const rows = returnedRows<{ id: string }>(
        await manager.query(
          `UPDATE ${classes} SET "state" = 'in_progress', "updated_at" = now()
            WHERE "id" = $1 AND "state" IN ('published', 'full')
          RETURNING "id"`,
          [classId],
        ),
      );
      if (rows.length === 0) {
        return { started: false };
      }
      await manager.query(insertOutboxStatement(this.schema), [
        CLASS_STARTED_EVENT,
        { classId, startedAt: new Date().toISOString() },
      ]);
      return { started: true };
    });
  }

  async completeAndEmit(
    classId: string,
    basis: CompletionBasis,
  ): Promise<{ completed: boolean; bookingIds: string[] }> {
    const source = this.registry.get(this.moduleName);
    const classes = qualified(this.schema, CLASSES_TABLE);
    const bookings = qualified(this.schema, BOOKINGS_TABLE);
    return source.transaction(async (manager) => {
      // AC-035: an idle room may only end a class that has already started. The
      // condition lives in the UPDATE, not only in the caller, so the basis cannot be
      // recorded for an unstarted class by any code path — this is the statement that
      // releases the Teacher's income, and "completed before it started" must stay
      // unrepresentable rather than merely forbidden (ADR-021 Amendment A).
      const basisGuard = basis === 'room_idle' ? ` AND "starts_at" <= now()` : '';
      const rows = returnedRows<{ id: string; teacher_id: string }>(
        await manager.query(
          `UPDATE ${classes}
             SET "state" = 'completed', "completed_at" = now(), "completion_basis" = $2, "updated_at" = now()
           WHERE "id" = $1 AND "state" IN ('published', 'full', 'in_progress')${basisGuard}
           RETURNING "id", "teacher_id"`,
          [classId, basis],
        ),
      );
      const completed = rows[0];
      if (completed === undefined) {
        return { completed: false, bookingIds: [] };
      }
      // Confirmed bookings of this class earn the teacher's income (ADR-021).
      const confirmed = (await manager.query(
        `SELECT "id", "learner_id", "price_credits" FROM ${bookings}
          WHERE "class_id" = $1 AND "state" = 'confirmed'`,
        [classId],
      )) as Array<{ id: string; learner_id: string; price_credits: number }>;
      await manager.query(insertOutboxStatement(this.schema), [
        CLASS_COMPLETED_EVENT,
        {
          classId,
          teacherId: completed.teacher_id,
          basis,
          completedAt: new Date().toISOString(),
          bookings: confirmed.map((row) => ({
            bookingId: row.id,
            learnerId: row.learner_id,
            priceCredits: row.price_credits,
          })),
        },
      ]);
      return { completed: true, bookingIds: confirmed.map((row) => row.id) };
    });
  }

  async cancelWithReason(
    classId: string,
    reason: ClassCancellationReason,
  ): Promise<{ cancelled: boolean }> {
    const source = this.registry.get(this.moduleName);
    const classes = qualified(this.schema, CLASSES_TABLE);
    return source.transaction(async (manager) => {
      const rows = returnedRows<{ id: string }>(
        await manager.query(
          `UPDATE ${classes}
             SET "state" = 'cancelled', "cancelled_at" = now(), "cancellation_reason" = $2, "updated_at" = now()
           WHERE "id" = $1 AND "state" NOT IN ('completed', 'cancelled')
           RETURNING "id"`,
          [classId, reason],
        ),
      );
      if (rows.length === 0) {
        return { cancelled: false };
      }
      await manager.query(insertOutboxStatement(this.schema), [
        CLASS_CANCELLED_EVENT,
        { classId, reason, cancelledAt: new Date().toISOString() },
      ]);
      return { cancelled: true };
    });
  }

  async findInProgressBeforeEnd(now: Date): Promise<CompletableClass[]> {
    const source = this.registry.get(this.moduleName);
    const classes = qualified(this.schema, CLASSES_TABLE);
    const rows = (await source.query(
      `SELECT "id", "teacher_id", "state", "starts_at", "duration_minutes" FROM ${classes}
        WHERE "state" IN ('published', 'full', 'in_progress')
          AND "starts_at" <= $1
          AND ("starts_at" + ("duration_minutes" || ' minutes')::interval) > $1`,
      [now.toISOString()],
    )) as Array<{
      id: string;
      teacher_id: string;
      state: string;
      starts_at: Date | string;
      duration_minutes: number;
    }>;
    return rows.map((row) => ({
      id: row.id,
      teacherId: row.teacher_id,
      state: row.state as ClassState,
      startsAt: toDate(row.starts_at),
      durationMinutes: row.duration_minutes,
    }));
  }

  async findAwaitingCompletion(now: Date): Promise<CompletableClass[]> {
    const source = this.registry.get(this.moduleName);
    const classes = qualified(this.schema, CLASSES_TABLE);
    const rows = (await source.query(
      `SELECT "id", "teacher_id", "state", "starts_at", "duration_minutes" FROM ${classes}
        WHERE "state" IN ('published', 'full', 'in_progress')
          AND ("starts_at" + ("duration_minutes" || ' minutes')::interval) <= $1`,
      [now.toISOString()],
    )) as Array<{
      id: string;
      teacher_id: string;
      state: string;
      starts_at: Date | string;
      duration_minutes: number;
    }>;
    return rows.map((row) => ({
      id: row.id,
      teacherId: row.teacher_id,
      state: row.state as ClassState,
      startsAt: toDate(row.starts_at),
      durationMinutes: row.duration_minutes,
    }));
  }

  /**
   * FR-016 (W3 C1/C2): classes inside the reminder window that have not been reminded.
   *
   * The window is half-open `[starts_at - offset, starts_at)`, matching `isReminderDue`: it is an
   * interval rather than an instant so a 60-second sweep cannot miss a class between ticks, and it
   * closes at `starts_at` because by then the reminder would be a late arrival.
   *
   * The state filter and the "already reminded" exclusion both live in this statement, not in the
   * caller, so a second sweep path cannot forget them. `LIMIT` is deliberately absent: the window
   * is 15 minutes wide and a bounded batch would silently starve the tail of a busy slot.
   */
  async findAwaitingReminder(
    now: Date,
    offsetMinutes: number,
  ): Promise<Array<Pick<ClassView, 'id' | 'state' | 'startsAt'>>> {
    const source = this.registry.get(this.moduleName);
    const classes = qualified(this.schema, CLASSES_TABLE);
    const reminders = qualified(this.schema, CLASS_REMINDERS_TABLE);
    const rows = (await source.query(
      `SELECT c."id", c."state", c."starts_at" FROM ${classes} c
        WHERE c."state" IN ('published', 'full')
          AND c."starts_at" - ($2::int * interval '1 minute') <= $1
          AND c."starts_at" > $1
          AND NOT EXISTS (
            SELECT 1 FROM ${reminders} r
             WHERE r."class_id" = c."id" AND r."kind" = 'starting_soon'
          )`,
      [now.toISOString(), offsetMinutes],
    )) as Array<{ id: string; state: string; starts_at: Date | string }>;
    return rows.map((row) => ({
      id: row.id,
      state: row.state as ClassState,
      startsAt: toDate(row.starts_at),
    }));
  }

  /**
   * FR-016 (W3): claims the reminder and emits it, in one transaction.
   *
   * The claim is the lease. `ON CONFLICT DO NOTHING` means a second sweep — another instance, or
   * this one on its next tick — gets no row back and returns without emitting, so exactly one
   * `class.starting.soon` exists per class per kind. Because the claim and the outbox insert share
   * a transaction, a failure between them rolls both back: the class is then simply still due, and
   * the next sweep tries again. There is no state where a reminder is marked sent but never
   * queued.
   *
   * Participants are confirmed bookings plus the class's Teacher (W3 C4: both parties). A Pending
   * booking is excluded (W3 C2): its hold has not settled, so that learner is not yet a party.
   */
  async claimReminderAndEmit(
    classId: string,
    kind: ClassReminderKind,
    startsAt: Date,
  ): Promise<{ reminded: boolean; participants: number }> {
    const source = this.registry.get(this.moduleName);
    const classes = qualified(this.schema, CLASSES_TABLE);
    const bookings = qualified(this.schema, BOOKINGS_TABLE);
    const reminders = qualified(this.schema, CLASS_REMINDERS_TABLE);
    return source.transaction(async (manager) => {
      const claimed = returnedRows<{ class_id: string }>(
        await manager.query(
          `INSERT INTO ${reminders} ("class_id", "kind") VALUES ($1, $2)
           ON CONFLICT ("class_id", "kind") DO NOTHING
           RETURNING "class_id"`,
          [classId, kind],
        ),
      );
      if (claimed.length === 0) {
        return { reminded: false, participants: 0 };
      }

      // Read the class inside the same transaction, after the claim: if it was cancelled between
      // the scan and now, the state filter below drops it and we must not emit a reminder for a
      // class that will not happen.
      const owner = returnedRows<{ teacher_id: string; state: string }>(
        await manager.query(
          `SELECT "teacher_id", "state" FROM ${classes}
            WHERE "id" = $1 AND "state" IN ('published', 'full')`,
          [classId],
        ),
      )[0];
      if (owner === undefined) {
        return { reminded: false, participants: 0 };
      }

      const learners = (await manager.query(
        `SELECT DISTINCT "learner_id" FROM ${bookings}
          WHERE "class_id" = $1 AND "state" = 'confirmed'`,
        [classId],
      )) as Array<{ learner_id: string }>;

      const participants = [
        ...learners.map((row) => ({ accountId: row.learner_id, role: 'learner' as const })),
        { accountId: owner.teacher_id, role: 'teacher' as const },
      ];

      await manager.query(insertOutboxStatement(this.schema), [
        CLASS_STARTING_SOON_EVENT,
        { classId, startsAt: startsAt.toISOString(), participants },
      ]);
      return { reminded: true, participants: participants.length };
    });
  }
}
