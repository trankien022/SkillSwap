import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type { SkillLevel, TeacherTrust } from '../../../domain/publish-policy';
import { isSkillLevel } from '../../../domain/skill-level';
import type {
  TeacherTrustReader,
  TeacherTrustWriter,
  UpsertSkillApprovalRequest,
  UpsertVerifiedTeacherRequest,
} from '../../../application/port/out/teacher-trust';

/**
 * FR-005 / ADR-024 extension: the `live-class` local projection of Teacher publish rights.
 * Written by event consumers (idempotent, last-writer-wins by `occurred_at`); read by the
 * publish gate. No cross-schema access (ADR-014).
 */
export class SqlTeacherTrustProjector implements TeacherTrustReader, TeacherTrustWriter {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get verifiedTable(): string {
    return qualified(this.registry.getSchema(this.moduleName), 'teacher_verified');
  }

  private get approvalTable(): string {
    return qualified(this.registry.getSchema(this.moduleName), 'teacher_skill_approval');
  }

  async read(teacherId: string): Promise<TeacherTrust> {
    const source = this.registry.get(this.moduleName);
    const verifiedRows = (await source.query(
      `SELECT "verified" FROM ${this.verifiedTable} WHERE "account_id" = $1`,
      [teacherId],
    )) as { verified: boolean }[];
    const approvalRows = (await source.query(
      `SELECT "skill_id", "approved_level" FROM ${this.approvalTable} WHERE "account_id" = $1`,
      [teacherId],
    )) as { skill_id: string; approved_level: string | null }[];
    const approvedLevels = new Map<string, SkillLevel | null>();
    for (const row of approvalRows) {
      approvedLevels.set(
        row.skill_id,
        row.approved_level !== null && isSkillLevel(row.approved_level) ? row.approved_level : null,
      );
    }
    return {
      verified: verifiedRows[0]?.verified ?? false,
      approvedLevel: (skillId: string): SkillLevel | null => approvedLevels.get(skillId) ?? null,
    };
  }

  async upsertVerified(request: UpsertVerifiedTeacherRequest): Promise<void> {
    const source = this.registry.get(this.moduleName);
    await source.query(
      `INSERT INTO ${this.verifiedTable} ("account_id", "verified", "occurred_at", "updated_at")
       VALUES ($1, $2, $3, now())
       ON CONFLICT ("account_id") DO UPDATE
         SET "verified" = EXCLUDED."verified", "occurred_at" = EXCLUDED."occurred_at", "updated_at" = now()
       WHERE ${this.verifiedTable}."occurred_at" < EXCLUDED."occurred_at"`,
      [request.accountId, request.verified, request.occurredAt],
    );
  }

  async upsertSkillApproval(request: UpsertSkillApprovalRequest): Promise<void> {
    const source = this.registry.get(this.moduleName);
    await source.query(
      `INSERT INTO ${this.approvalTable} ("account_id", "skill_id", "approved_level", "occurred_at", "updated_at")
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT ("account_id", "skill_id") DO UPDATE
         SET "approved_level" = EXCLUDED."approved_level",
             "occurred_at" = EXCLUDED."occurred_at",
             "updated_at" = now()
       WHERE ${this.approvalTable}."occurred_at" < EXCLUDED."occurred_at"`,
      [request.accountId, request.skillId, request.approvedLevel, request.occurredAt],
    );
  }
}
