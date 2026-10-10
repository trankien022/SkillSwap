import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { insertOutboxStatement } from '../../../../../../shared/messaging/outbox-statements';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import {
  SKILL_EVIDENCE_EVENTS,
  SkillEvidence,
  type EvidenceStatus,
  type EvidenceType,
  type SkillLevel,
} from '../../../domain/evidence';
import type {
  CreateSkillEvidenceRequest,
  SkillEvidenceRepository,
} from '../../../application/port/out/skill-evidence-repository';

interface EvidenceRow {
  id: string;
  profile_skill_id: string;
  evidence_type: string;
  document_ref: string | null;
  description: string | null;
  version: number;
  requested_level: string;
  approved_level: string | null;
  status: string;
  reviewer_id: string | null;
  reason: string | null;
  decided_at: Date | string | null;
  submitted_at: Date | string;
}

function toDate(value: Date | string | null): Date | null {
  if (value === null) return null;
  return value instanceof Date ? value : new Date(value);
}

function toDomain(row: EvidenceRow): SkillEvidence {
  return SkillEvidence.reconstitute({
    id: row.id,
    profileSkillId: row.profile_skill_id,
    evidenceType: row.evidence_type as EvidenceType,
    documentRef: row.document_ref,
    description: row.description,
    version: row.version,
    requestedLevel: row.requested_level as SkillLevel,
    approvedLevel: row.approved_level as SkillLevel | null,
    status: row.status as EvidenceStatus,
    reviewerId: row.reviewer_id,
    reason: row.reason,
    decidedAt: toDate(row.decided_at),
    submittedAt: toDate(row.submitted_at) as Date,
  });
}

const SELECT_COLUMNS =
  '"id", "profile_skill_id", "evidence_type", "document_ref", "description", "version", ' +
  '"requested_level", "approved_level", "status", "reviewer_id", "reason", "decided_at", "submitted_at"';

/** FR-003 / ADR-013: evidence versions; the submit write and the event share a transaction. */
export class SqlSkillEvidenceRepository implements SkillEvidenceRepository {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get schema(): string {
    return this.registry.getSchema(this.moduleName);
  }

  private get table(): string {
    return qualified(this.schema, 'skill_evidence');
  }

  async nextVersion(profileSkillId: string): Promise<number> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT COALESCE(MAX("version"), 0) + 1 AS next FROM ${this.table} WHERE "profile_skill_id" = $1`,
      [profileSkillId],
    )) as { next: number | string }[];
    return Number(rows[0]?.next ?? 1);
  }

  async create(request: CreateSkillEvidenceRequest): Promise<SkillEvidence> {
    const source = this.registry.get(this.moduleName);
    return source.transaction(async (manager) => {
      const rows = returnedRows<EvidenceRow>(
        await manager.query(
          `INSERT INTO ${this.table}
             ("id", "profile_skill_id", "evidence_type", "document_ref", "description", "version",
              "requested_level", "status", "submitted_at")
           VALUES ($1, $2, $3, $4, $5,
             (SELECT COALESCE(MAX("version"), 0) + 1 FROM ${this.table} WHERE "profile_skill_id" = $2),
             $6, 'pending', $7)
           RETURNING ${SELECT_COLUMNS}`,
          [
            request.id,
            request.profileSkillId,
            request.evidenceType,
            request.documentRef,
            request.description,
            request.requestedLevel,
            request.submittedAt.toISOString(),
          ],
        ),
      );
      const row = rows[0];
      if (row === undefined) {
        throw new Error('Failed to insert skill evidence');
      }
      await manager.query(insertOutboxStatement(this.schema), [
        SKILL_EVIDENCE_EVENTS.submitted,
        {
          evidenceId: row.id,
          profileSkillId: row.profile_skill_id,
          accountId: request.accountId,
          skillId: request.skillId,
          version: row.version,
          requestedLevel: row.requested_level,
          status: row.status,
          occurredAt: request.submittedAt.toISOString(),
        },
      ]);
      return toDomain(row);
    });
  }

  async listByProfileSkill(profileSkillId: string): Promise<SkillEvidence[]> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT ${SELECT_COLUMNS} FROM ${this.table}
        WHERE "profile_skill_id" = $1 ORDER BY "version" DESC`,
      [profileSkillId],
    )) as EvidenceRow[];
    return rows.map(toDomain);
  }
}
