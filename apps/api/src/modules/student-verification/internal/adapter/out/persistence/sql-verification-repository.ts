import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { insertOutboxStatement } from '../../../../../../shared/messaging/outbox-statements';
import { InvalidCursorError } from '../../../../../../shared/errors';
import { decodeCursor, toKeysetPage } from '../../../../../../shared/http/keyset-cursor';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import {
  DuplicateActiveVerificationError,
  VERIFICATION_EVENTS,
  Verification,
  type VerificationStatus,
} from '../../../domain/verification';
import type {
  AdminVerificationPage,
  AdminVerificationSort,
  ApplyDecisionRequest,
  ApplyDecisionResult,
  CreateVerificationRequest,
  ListVerificationsForAdminRequest,
  RevokeVerificationRequest,
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
  revoked_at: Date | string | null;
  revocation_reason: string | null;
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
    revokedAt: toDate(row.revoked_at),
    revocationReason: row.revocation_reason,
  });
}

const SELECT_COLUMNS =
  '"id", "account_id", "school_name", "major", "document_ref", "status", ' +
  '"reviewer_id", "reason", "decided_at", "created_at", "revoked_at", "revocation_reason"';

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
      return await source.transaction(async (manager) => {
        const rows = returnedRows<VerificationRow>(
          await manager.query(
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
        // Emit in the same transaction as the state write (ADR-013/ADR-023 §7),
        // so FR-017/FR-016/FR-019 can project the pending status.
        await manager.query(insertOutboxStatement(this.schema), [
          VERIFICATION_EVENTS.submitted,
          {
            verificationId: row.id,
            accountId: row.account_id,
            status: row.status,
            schoolName: row.school_name,
            reason: row.reason,
            occurredAt: request.submittedAt.toISOString(),
          },
        ]);
        return toDomain(row);
      });
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

  async revoke(request: RevokeVerificationRequest): Promise<ApplyDecisionResult> {
    const source = this.registry.get(this.moduleName);
    return source.transaction(async (manager) => {
      // Only an effective (pending|approved) verification can be revoked.
      const rows = returnedRows<VerificationRow>(
        await manager.query(
          `UPDATE ${this.table}
             SET "status" = 'revoked', "reviewer_id" = $2, "revocation_reason" = $3,
                 "revoked_at" = $4, "updated_at" = now()
           WHERE "id" = $1 AND "status" IN ('pending', 'approved')
           RETURNING ${SELECT_COLUMNS}`,
          [
            request.verificationId,
            request.reviewerId,
            request.reason,
            request.revokedAt.toISOString(),
          ],
        ),
      );
      const row = rows[0];
      if (row === undefined) {
        return { applied: false };
      }
      await manager.query(insertOutboxStatement(this.schema), [
        VERIFICATION_EVENTS.revoked,
        {
          verificationId: row.id,
          accountId: row.account_id,
          status: row.status,
          schoolName: row.school_name,
          reason: row.revocation_reason,
          occurredAt: request.revokedAt.toISOString(),
        },
      ]);
      return { applied: true };
    });
  }

  /**
   * FR-015: the admin-wide verification queue (NFR-014).
   *
   * The WHERE clause is shared between the page query and the `COUNT(*)` so `total` cannot
   * describe a different set of rows than `items`. Pagination is keyset on the sort column
   * plus `id`, and only whitelisted sorts reach SQL — the sort string is never interpolated
   * from user input, it selects from the closed table below.
   */
  async listForAdmin(
    request: ListVerificationsForAdminRequest,
  ): Promise<AdminVerificationPage> {
    const source = this.registry.get(this.moduleName);

    const filters: string[] = [];
    const filterParams: unknown[] = [];
    if (request.status !== undefined) {
      filterParams.push(request.status);
      filters.push(`"status" = $${filterParams.length}`);
    }
    if (request.q !== undefined) {
      filterParams.push(`%${request.q}%`);
      filters.push(`"school_name" ILIKE $${filterParams.length}`);
    }
    const where = filters.length === 0 ? '' : `WHERE ${filters.join(' AND ')}`;

    // Only these four spellings reach SQL. `decided_at` is nullable, so its ordering has to
    // put NULLs last explicitly rather than rely on the default (which differs by direction).
    const orders: Record<AdminVerificationSort, { column: string; direction: 'ASC' | 'DESC'; nulls: string }> = {
      submittedAt: { column: '"created_at"', direction: 'ASC', nulls: '' },
      '-submittedAt': { column: '"created_at"', direction: 'DESC', nulls: '' },
      decidedAt: { column: '"decided_at"', direction: 'ASC', nulls: ' NULLS LAST' },
      '-decidedAt': { column: '"decided_at"', direction: 'DESC', nulls: ' NULLS LAST' },
    };
    const order = orders[request.sort ?? 'submittedAt'];
    const comparison = order.direction === 'ASC' ? '>' : '<';

    const pageParams = [...filterParams];
    let cursorClause = '';
    const decoded = decodeCursor(request.cursor);
    if (decoded !== null) {
      // A malformed cursor is decoded to null upstream by the DTO's schema; a decoded one that
      // does not carry exactly (sortKey, id) cannot be honoured, so it is rejected rather than
      // silently ignored (which would restart at page one and look like corruption).
      if (decoded.length !== 2) {
        throw new InvalidCursorError();
      }
      pageParams.push(decoded[0], decoded[1]);
      cursorClause = ` AND (${order.column}, "id") ${comparison} ($${pageParams.length - 1}::timestamptz, $${pageParams.length}::uuid)`;
    }
    pageParams.push(request.limit + 1);
    const limitParam = pageParams.length;

    const [rows, countRows] = await Promise.all([
      source.query(
        `SELECT ${SELECT_COLUMNS} FROM ${this.table}
          ${where}${cursorClause}
          ORDER BY ${order.column} ${order.direction}${order.nulls}, "id" ${order.direction}
          LIMIT $${limitParam}`,
        pageParams,
      ),
      source.query(`SELECT COUNT(*)::int AS "total" FROM ${this.table} ${where}`, filterParams),
    ]);

    const { items, nextCursor } = toKeysetPage(
      rows as VerificationRow[],
      request.limit,
      (row) => [toIsoSortKey(row, order.column), row.id],
    );
    return { items: items.map(toDomain), nextCursor, total: countRows[0]?.total ?? 0 };
  }
}

/**
 * The cursor key must be the **same value the ORDER BY compared**, so it is read from the
 * column the sort selected rather than guessed from the row.
 */
function toIsoSortKey(row: VerificationRow, column: string): string {
  if (column === '"decided_at"') {
    const decided = toDate(row.decided_at);
    // A NULL sort key cannot be encoded into a cursor; rows with a NULL key are only ever
    // reached when the filter excludes them, and the cursor is taken from the last row of a
    // page. An undefined key here would produce a cursor that silently never advances, so it
    // is surfaced instead.
    if (decided === null) {
      throw new InvalidCursorError();
    }
    return decided.toISOString();
  }
  return new Date(row.created_at).toISOString();
}

/** Detects the Postgres unique-violation SQLSTATE (23505) from a pg error. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}
