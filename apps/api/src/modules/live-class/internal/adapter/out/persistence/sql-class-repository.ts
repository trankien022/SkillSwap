import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type {
  ClassRepository,
  CreateClassRecord,
  PersistedClass,
} from '../../../application/port/out/class-repository';
import type { ClassState } from '../../../domain/class';

const CLASSES_TABLE = 'classes';
const CLASS_SKILLS_TABLE = 'class_skills';

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
}
