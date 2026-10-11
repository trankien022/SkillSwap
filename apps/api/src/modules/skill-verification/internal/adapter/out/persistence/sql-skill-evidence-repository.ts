import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { insertOutboxStatement } from '../../../../../../shared/messaging/outbox-statements';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import {
  EvidenceNotClaimableError,
  SKILL_EVIDENCE_EVENTS,
  SkillEvidence,
  type EvidenceStatus,
  type EvidenceType,
  type SkillLevel,
} from '../../../domain/evidence';
import type {
  ApplyEvidenceDecisionRequest,
  ApplyEvidenceDecisionResult,
  ClaimRequest,
  ClaimedEvidence,
  CreateSkillEvidenceRequest,
  PendingEvidenceForVerifier,
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
  claimed_by: string | null;
  claimed_at: Date | string | null;
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
    claimedBy: row.claimed_by,
    claimedAt: toDate(row.claimed_at),
    reviewerId: row.reviewer_id,
    reason: row.reason,
    decidedAt: toDate(row.decided_at),
    submittedAt: toDate(row.submitted_at) as Date,
  });
}

const SELECT_COLUMNS =
  '"id", "profile_skill_id", "evidence_type", "document_ref", "description", "version", ' +
  '"requested_level", "approved_level", "status", "claimed_by", "claimed_at", ' +
  '"reviewer_id", "reason", "decided_at", "submitted_at"';

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

  async findById(evidenceId: string): Promise<SkillEvidence | null> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT ${SELECT_COLUMNS} FROM ${this.table} WHERE "id" = $1`,
      [evidenceId],
    )) as EvidenceRow[];
    return rows[0] === undefined ? null : toDomain(rows[0]);
  }

  async listPendingForExpertise(expertise: readonly string[]): Promise<PendingEvidenceForVerifier[]> {
    if (expertise.length === 0) {
      return [];
    }
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT e.${SELECT_COLUMNS.split(', ').join(', e.')},
              ps."account_id" AS owner_id, s."id" AS skill_id, s."name" AS skill_name,
              s."category" AS category
         FROM ${this.table} e
         JOIN ${qualified(this.schema, 'profile_skills')} ps ON ps."id" = e."profile_skill_id"
         JOIN ${qualified(this.schema, 'skills')} s ON s."id" = ps."skill_id"
        WHERE e."status" = 'pending' AND s."id" = ANY($1::uuid[])
        ORDER BY e."submitted_at" ASC`,
      [expertise],
    )) as (EvidenceRow & {
      owner_id: string;
      skill_id: string;
      skill_name: string;
      category: string;
    })[];
    return rows.map((row) => ({
      id: row.id,
      profileSkillId: row.profile_skill_id,
      skillId: row.skill_id,
      skillName: row.skill_name,
      category: row.category,
      ownerId: row.owner_id,
      evidence: toDomain(row),
    }));
  }

  async claim(request: ClaimRequest): Promise<ClaimedEvidence> {
    const source = this.registry.get(this.moduleName);
    return source.transaction(async (manager) => {
      const rows = returnedRows<EvidenceRow>(
        await manager.query(
          `UPDATE ${this.table}
             SET "status" = 'claimed', "claimed_by" = $2, "claimed_at" = $3
           WHERE "id" = $1 AND "status" = 'pending'
           RETURNING ${SELECT_COLUMNS}`,
          [request.evidenceId, request.verifierId, request.claimedAt.toISOString()],
        ),
      );
      const row = rows[0];
      if (row === undefined) {
        throw new EvidenceNotClaimableError('claimed');
      }
      await manager.query(insertOutboxStatement(this.schema), [
        SKILL_EVIDENCE_EVENTS.claimed,
        {
          evidenceId: row.id,
          profileSkillId: row.profile_skill_id,
          accountId: request.ownerId,
          skillId: request.skillId,
          version: row.version,
          requestedLevel: row.requested_level,
          status: row.status,
          claimedBy: request.verifierId,
          occurredAt: request.claimedAt.toISOString(),
        },
      ]);
      return { evidence: toDomain(row), skillId: request.skillId, ownerId: request.ownerId };
    });
  }

  async decide(request: ApplyEvidenceDecisionRequest): Promise<ApplyEvidenceDecisionResult> {
    const source = this.registry.get(this.moduleName);
    return source.transaction(async (manager) => {
      // Only a request claimed by this Verifier can be decided (BR-013/BR-071).
      const rows = returnedRows<EvidenceRow>(
        await manager.query(
          `UPDATE ${this.table}
             SET "status" = $3, "reviewer_id" = $2, "approved_level" = $4, "reason" = $5,
                 "decided_at" = $6
           WHERE "id" = $1 AND "status" = 'claimed' AND "claimed_by" = $2
           RETURNING ${SELECT_COLUMNS}`,
          [
            request.evidenceId,
            request.reviewerId,
            request.status,
            request.approvedLevel,
            request.reason,
            request.decidedAt.toISOString(),
          ],
        ),
      );
      const row = rows[0];
      if (row === undefined) {
        return { applied: false };
      }
      if (request.status === 'approved') {
        // AC-016: supersede the previous approval in the same transaction. The
        // profile-skill level cache is written by the use case (applyApprovedLevel).
        await manager.query(
          `UPDATE ${this.table}
             SET "status" = 'superseded'
           WHERE "profile_skill_id" = $1 AND "status" = 'approved' AND "id" <> $2`,
          [row.profile_skill_id, row.id],
        );
      }
      await manager.query(insertOutboxStatement(this.schema), [
        request.status === 'approved' ? SKILL_EVIDENCE_EVENTS.approved : SKILL_EVIDENCE_EVENTS.rejected,
        {
          evidenceId: row.id,
          profileSkillId: row.profile_skill_id,
          accountId: request.ownerId,
          skillId: request.skillId,
          version: row.version,
          requestedLevel: row.requested_level,
          status: row.status,
          approvedLevel: row.approved_level,
          reason: row.reason,
          occurredAt: request.decidedAt.toISOString(),
        },
      ]);
      return { applied: true };
    });
  }
}
