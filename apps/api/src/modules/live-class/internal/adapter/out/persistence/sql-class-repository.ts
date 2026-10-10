import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { insertOutboxStatement } from '../../../../../../shared/messaging/outbox-statements';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import type {
  ClassEdit,
  ClassRepository,
  CompletableClass,
  CreateClassRecord,
  PersistedClass,
} from '../../../application/port/out/class-repository';
import type { ClassCancellationReason, ClassState, CompletionBasis } from '../../../domain/class';

const CLASSES_TABLE = 'classes';
const CLASS_SKILLS_TABLE = 'class_skills';
const BOOKINGS_TABLE = 'bookings';
const CLASS_STARTED_EVENT = 'class.started';
const CLASS_COMPLETED_EVENT = 'class.completed';
const CLASS_CANCELLED_EVENT = 'class.cancelled';

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
      const rows = returnedRows<{ id: string; teacher_id: string }>(
        await manager.query(
          `UPDATE ${classes}
             SET "state" = 'completed', "completed_at" = now(), "completion_basis" = $2, "updated_at" = now()
           WHERE "id" = $1 AND "state" IN ('published', 'full', 'in_progress')
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
}
