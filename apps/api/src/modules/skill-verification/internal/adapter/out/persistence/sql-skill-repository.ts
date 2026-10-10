import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import { ProfileSkill, type Skill, type SkillLevel } from '../../../domain/evidence';
import type { SkillRepository } from '../../../application/port/out/skill-repository';
import type { ProfileSkillRepository } from '../../../application/port/out/skill-evidence-repository';

interface SkillRow {
  id: string;
  name: string;
  category: string;
  active: boolean;
}

interface ProfileSkillRow {
  id: string;
  account_id: string;
  skill_id: string;
  approved_level: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toDomain(row: ProfileSkillRow): ProfileSkill {
  return ProfileSkill.reconstitute({
    id: row.id,
    accountId: row.account_id,
    skillId: row.skill_id,
    approvedLevel: row.approved_level as SkillLevel | null,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  });
}

/** FR-003 / ADR-026: reads the managed skill catalogue from the module schema. */
export class SqlSkillRepository implements SkillRepository {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get table(): string {
    return qualified(this.registry.getSchema(this.moduleName), 'skills');
  }

  async findActiveById(skillId: string): Promise<Skill | null> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT "id", "name", "category", "active" FROM ${this.table}
        WHERE "id" = $1 AND "active" = true`,
      [skillId],
    )) as SkillRow[];
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return { id: row.id, name: row.name, category: row.category, active: row.active };
  }
}

/** FR-003 / ADR-026 §5: the account↔skill link and its effective-level cache. */
export class SqlProfileSkillRepository implements ProfileSkillRepository {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get table(): string {
    return qualified(this.registry.getSchema(this.moduleName), 'profile_skills');
  }

  async findByAccountAndSkill(accountId: string, skillId: string): Promise<ProfileSkill | null> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT "id", "account_id", "skill_id", "approved_level", "created_at", "updated_at"
         FROM ${this.table} WHERE "account_id" = $1 AND "skill_id" = $2`,
      [accountId, skillId],
    )) as ProfileSkillRow[];
    return rows[0] === undefined ? null : toDomain(rows[0]);
  }

  async findOrCreate(accountId: string, skillId: string): Promise<ProfileSkill> {
    const source = this.registry.get(this.moduleName);
    const rows = returnedRows<ProfileSkillRow>(
      await source.query(
        `INSERT INTO ${this.table} ("account_id", "skill_id")
         VALUES ($1, $2)
         ON CONFLICT ("account_id", "skill_id") DO UPDATE SET "updated_at" = now()
         RETURNING "id", "account_id", "skill_id", "approved_level", "created_at", "updated_at"`,
        [accountId, skillId],
      ),
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Failed to upsert profile skill');
    }
    return toDomain(row);
  }
}
