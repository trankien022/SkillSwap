import type { EntityManager } from 'typeorm';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type { EvidenceStatus, EvidenceType, SkillLevel } from '../../../domain/evidence';
import type {
  EvidenceAuditAction,
  EvidenceAuditEntry,
  NewEvidenceAuditEntry,
} from '../../../domain/history';
import type { EvidenceAuditRepository } from '../../../application/port/out/skill-evidence-repository';

interface AuditRow {
  id: string;
  evidence_id: string;
  profile_skill_id: string;
  version: number;
  action: string;
  actor_id: string | null;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  snapshot: {
    version: number;
    status: string;
    evidenceType: string;
    requestedLevel: string;
    approvedLevel: string | null;
    reason: string | null;
  };
  occurred_at: Date | string;
  trace_id: string | null;
}

function toDomain(row: AuditRow): EvidenceAuditEntry {
  return {
    id: row.id,
    evidenceId: row.evidence_id,
    profileSkillId: row.profile_skill_id,
    version: row.version,
    action: row.action as EvidenceAuditAction,
    actorId: row.actor_id,
    fromStatus: row.from_status as EvidenceStatus | null,
    toStatus: row.to_status as EvidenceStatus,
    reason: row.reason,
    snapshot: {
      version: row.snapshot.version,
      status: row.snapshot.status as EvidenceStatus,
      evidenceType: row.snapshot.evidenceType as EvidenceType,
      requestedLevel: row.snapshot.requestedLevel as SkillLevel,
      approvedLevel: row.snapshot.approvedLevel as SkillLevel | null,
      reason: row.snapshot.reason,
    },
    occurredAt: row.occurred_at instanceof Date ? row.occurred_at : new Date(row.occurred_at),
    traceId: row.trace_id,
  };
}

export function auditTable(schema: string): string {
  return qualified(schema, 'skill_evidence_audit');
}

/**
 * FR-018 / ADR-028: appends one immutable audit entry. Call inside the caller's
 * transaction (same `manager`) so it commits with the state change (NFR-005).
 */
export async function appendEvidenceAudit(
  manager: Pick<EntityManager, 'query'>,
  schema: string,
  entry: NewEvidenceAuditEntry,
): Promise<void> {
  await manager.query(
    `INSERT INTO ${auditTable(schema)}
       ("id", "evidence_id", "profile_skill_id", "version", "action", "actor_id",
        "from_status", "to_status", "reason", "snapshot", "occurred_at", "trace_id")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)`,
    [
      entry.id,
      entry.evidenceId,
      entry.profileSkillId,
      entry.version,
      entry.action,
      entry.actorId,
      entry.fromStatus,
      entry.toStatus,
      entry.reason,
      JSON.stringify(entry.snapshot),
      entry.occurredAt.toISOString(),
      entry.traceId,
    ],
  );
}

/** FR-018: reads the append-only history for a profile-skill (newest first). */
export class SqlEvidenceAuditRepository implements EvidenceAuditRepository {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  async listByProfileSkill(profileSkillId: string): Promise<EvidenceAuditEntry[]> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT "id", "evidence_id", "profile_skill_id", "version", "action", "actor_id",
              "from_status", "to_status", "reason", "snapshot", "occurred_at", "trace_id"
         FROM ${auditTable(this.registry.getSchema(this.moduleName))}
        WHERE "profile_skill_id" = $1
        ORDER BY "version" DESC, "occurred_at" DESC`,
      [profileSkillId],
    )) as AuditRow[];
    return rows.map(toDomain);
  }
}
