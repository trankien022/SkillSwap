import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { insertOutboxStatement } from '../../../../../../shared/messaging/outbox-statements';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import {
  DuplicateActiveVerificationError,
  VERIFICATION_EVENTS,
  Verification,
  type VerificationStatus,
} from '../../../domain/verification';
import type {
  ApplyDecisionRequest,
  ApplyDecisionResult,
  CreateVerificationRequest,
  VerificationRepository,
} from '../../../application/port/out/verification-repository';

interface VerificationRow {
  id: string;
  account_id: string;
  school_name: string;
  major: string | null;
  document_ref: string;
  status: string;
  reviewer_id: string | null;
  reason: string | null;
  decided_at: Date | string | null;
  created_at: Date | string;
}

function toDate(value: Date | string | null): Date | null {
  if (value === null) return null;
  return value instanceof Date ? value : new Date(value);
}

function toDomain(row: VerificationRow): Verification {
  return Verification.reconstitute({
    id: row.id,
    accountId: row.account_id,
    schoolName: row.school_name,
    major: row.major,
    documentRef: row.document_ref,
    status: row.status as VerificationStatus,
    reviewerId: row.reviewer_id,
    reason: row.reason,
    decidedAt: toDate(row.decided_at),
    submittedAt: new Date(row.created_at),
  });
}

const SELECT_COLUMNS =
  '"id", "account_id", "school_name", "major", "document_ref", "status", ' +
  '"reviewer_id", "reason", "decided_at", "created_at"';

export class SqlVerificationRepository implements VerificationRepository {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get schema(): string {
    return this.registry.getSchema(this.moduleName);
  }

  private get table(): string {
    return qualified(this.schema, 'student_verifications');
  }

  async create(request: CreateVerificationRequest): Promise<Verification> {
    const source = this.registry.get(this.moduleName);
    try {
      const rows = returnedRows<VerificationRow>(
        await source.query(
          `INSERT INTO ${this.table}
             ("id", "account_id", "school_name", "major", "document_ref", "status", "created_at")
           VALUES ($1, $2, $3, $4, $5, 'pending', $6)
           RETURNING ${SELECT_COLUMNS}`,
          [
            request.id,
            request.accountId,
            request.schoolName,
            request.major,
            request.documentRef,
            request.submittedAt.toISOString(),
          ],
        ),
      );
      const row = rows[0];
      if (row === undefined) {
        throw new Error('Failed to insert student verification');
      }
      return toDomain(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateActiveVerificationError(request.accountId);
      }
      throw error;
    }
  }

  async findEffective(accountId: string): Promise<Verification | null> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT ${SELECT_COLUMNS} FROM ${this.table}
        WHERE "account_id" = $1 AND "status" IN ('pending', 'approved')
        ORDER BY "created_at" DESC LIMIT 1`,
      [accountId],
    )) as VerificationRow[];
    return rows[0] === undefined ? null : toDomain(rows[0]);
  }

  async findLatestByAccount(accountId: string): Promise<Verification | null> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT ${SELECT_COLUMNS} FROM ${this.table}
        WHERE "account_id" = $1
        ORDER BY "created_at" DESC LIMIT 1`,
      [accountId],
    )) as VerificationRow[];
    return rows[0] === undefined ? null : toDomain(rows[0]);
  }

  async findById(verificationId: string): Promise<Verification | null> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT ${SELECT_COLUMNS} FROM ${this.table} WHERE "id" = $1`,
      [verificationId],
    )) as VerificationRow[];
    return rows[0] === undefined ? null : toDomain(rows[0]);
  }

  async decide(request: ApplyDecisionRequest): Promise<ApplyDecisionResult> {
    const source = this.registry.get(this.moduleName);
    return source.transaction(async (manager) => {
      // Only a pending verification can be decided; a replay is a no-op.
      const rows = returnedRows<VerificationRow>(
        await manager.query(
          `UPDATE ${this.table}
             SET "status" = $2, "reviewer_id" = $3, "reason" = $4, "major" = COALESCE($5, "major"),
                 "decided_at" = $6, "updated_at" = now()
           WHERE "id" = $1 AND "status" = 'pending'
           RETURNING ${SELECT_COLUMNS}`,
          [
            request.verificationId,
            request.status,
            request.reviewerId,
            request.reason,
            request.major,
            request.decidedAt.toISOString(),
          ],
        ),
      );
      const row = rows[0];
      if (row === undefined) {
        return { applied: false };
      }
      const eventType =
        request.status === 'approved'
          ? VERIFICATION_EVENTS.approved
          : VERIFICATION_EVENTS.rejected;
      await manager.query(insertOutboxStatement(this.schema), [
        eventType,
        {
          verificationId: row.id,
          accountId: row.account_id,
          status: row.status,
          schoolName: row.school_name,
          reason: row.reason,
          occurredAt: request.decidedAt.toISOString(),
        },
      ]);
      return { applied: true };
    });
  }
}

/** Detects the Postgres unique-violation SQLSTATE (23505) from a pg error. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}
