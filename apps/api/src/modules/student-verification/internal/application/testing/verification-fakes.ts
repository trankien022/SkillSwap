import { DuplicateActiveVerificationError, Verification } from '../../domain/verification';
import type { Clock } from '../port/out/clock';
import type { CreateUploadTargetInput, DocumentStore, UploadTarget } from '../port/out/document-store';
import type {
  CreateDocumentRequest,
  VerificationDocument,
  VerificationDocumentRepository,
} from '../port/out/verification-document-repository';
import type {
  AdminVerificationPage,
  ApplyDecisionRequest,
  ApplyDecisionResult,
  CreateVerificationRequest,
  ListVerificationsForAdminRequest,
  RevokeVerificationRequest,
  VerificationRepository,
} from '../port/out/verification-repository';

/** In-memory VerificationRepository for use-case specs. */
export class InMemoryVerificationRepository implements VerificationRepository {
  private readonly rows: Verification[] = [];

  async create(request: CreateVerificationRequest): Promise<Verification> {
    if (this.rows.some((row) => row.accountId === request.accountId && row.isEffective)) {
      throw new DuplicateActiveVerificationError(request.accountId);
    }
    const verification = Verification.submit({
      id: request.id,
      accountId: request.accountId,
      schoolName: request.schoolName,
      major: request.major,
      documentRef: request.documentRef,
      submittedAt: request.submittedAt,
    });
    this.rows.push(verification);
    return verification;
  }

  async findEffective(accountId: string): Promise<Verification | null> {
    return (
      [...this.rows].reverse().find((row) => row.accountId === accountId && row.isEffective) ?? null
    );
  }

  async findLatestByAccount(accountId: string): Promise<Verification | null> {
    return [...this.rows].reverse().find((row) => row.accountId === accountId) ?? null;
  }

  async findById(verificationId: string): Promise<Verification | null> {
    return this.rows.find((row) => row.id === verificationId) ?? null;
  }

  async decide(request: ApplyDecisionRequest): Promise<ApplyDecisionResult> {
    const index = this.rows.findIndex((row) => row.id === request.verificationId);
    if (index === -1 || this.rows[index].status !== 'pending') {
      return { applied: false };
    }
    const current = this.rows[index];
    this.rows[index] = Verification.reconstitute({
      id: current.id,
      accountId: current.accountId,
      schoolName: current.schoolName,
      major: request.major ?? current.major,
      documentRef: current.documentRef,
      status: request.status,
      reviewerId: request.reviewerId,
      reason: request.reason,
      decidedAt: request.decidedAt,
      submittedAt: current.submittedAt,
    });
    return { applied: true };
  }

  async revoke(request: RevokeVerificationRequest): Promise<ApplyDecisionResult> {
    const index = this.rows.findIndex((row) => row.id === request.verificationId);
    if (index === -1 || !this.rows[index].isEffective) {
      return { applied: false };
    }
    const current = this.rows[index];
    this.rows[index] = Verification.reconstitute({
      id: current.id,
      accountId: current.accountId,
      schoolName: current.schoolName,
      major: current.major,
      documentRef: current.documentRef,
      status: 'revoked',
      reviewerId: request.reviewerId,
      reason: current.reason,
      decidedAt: current.decidedAt,
      submittedAt: current.submittedAt,
      revokedAt: request.revokedAt,
      revocationReason: request.reason,
    });
    return { applied: true };
  }

  /**
   * FR-015: the admin-wide queue, mirroring the SQL adapter's semantics (filters, whitelisted
   * sort, keyset on the sort key + id) so a handler spec exercises the same behaviour the
   * database will.
   */
  async listForAdmin(request: ListVerificationsForAdminRequest): Promise<AdminVerificationPage> {
    const matched = this.rows.filter((row) => {
      if (request.status !== undefined && row.status !== request.status) return false;
      if (
        request.q !== undefined &&
        !row.schoolName.toLowerCase().includes(request.q.toLowerCase())
      ) {
        return false;
      }
      return true;
    });

    const sort = request.sort ?? 'submittedAt';
    const descending = sort.startsWith('-');
    const byDecided = sort === 'decidedAt' || sort === '-decidedAt';
    const keyOf = (row: Verification): string =>
      (byDecided ? row.decidedAt : row.submittedAt)?.toISOString() ?? '';

    const sorted = [...matched].sort((a, b) => {
      const left = keyOf(a);
      const right = keyOf(b);
      const order = left < right ? -1 : left > right ? 1 : 0;
      const tie = a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      const comparison = order !== 0 ? order : tie;
      return descending ? -comparison : comparison;
    });

    // Test-seam paging: the fake's cursor is the *index* of the next row, not the opaque keyset
    // cursor the real adapter emits. An application-layer test double may not import `shared`
    // (`domain-application-stay-inside-module`, ADR-009), so the real cursor encoding is pinned
    // where it actually lives — `sql-verification-repository.spec.ts`.
    const start = request.cursor === undefined ? 0 : Number.parseInt(request.cursor, 10);
    if (Number.isNaN(start)) {
      throw new Error(`Test cursor must be a row index, received: ${request.cursor}`);
    }
    const items = sorted.slice(start, start + request.limit);
    const next = start + request.limit < sorted.length ? String(start + request.limit) : null;

    return { items, nextCursor: next, total: matched.length };
  }
}

/** Fixed-time Clock for deterministic decision timestamps. */
export function fixedClock(now: Date): Clock {
  return { now: () => now };
}

/** In-memory VerificationDocumentRepository for use-case specs. */
export class InMemoryVerificationDocumentRepository implements VerificationDocumentRepository {
  private readonly rows: VerificationDocument[] = [];

  async create(request: CreateDocumentRequest): Promise<VerificationDocument> {
    const document: VerificationDocument = {
      id: request.id,
      accountId: request.accountId,
      objectKey: request.objectKey,
      fileName: request.fileName,
      contentType: request.contentType,
      sizeBytes: request.sizeBytes,
      status: 'pending',
      createdAt: new Date(),
    };
    this.rows.push(document);
    return document;
  }

  async findById(documentId: string): Promise<VerificationDocument | null> {
    return this.rows.find((row) => row.id === documentId) ?? null;
  }

  async attach(documentId: string, accountId: string): Promise<boolean> {
    const index = this.rows.findIndex(
      (row) => row.id === documentId && row.accountId === accountId && row.status === 'pending',
    );
    if (index === -1) {
      return false;
    }
    this.rows[index] = { ...this.rows[index], status: 'attached' };
    return true;
  }
}

/** Fake DocumentStore that returns a deterministic pre-signed URL. */
export class FakeDocumentStore implements DocumentStore {
  constructor(private readonly now: () => Date = () => new Date()) {}

  async createUploadTarget(input: CreateUploadTargetInput): Promise<UploadTarget> {
    return {
      uploadUrl: `https://s3.local/${input.objectKey}?sig=fake`,
      objectKey: input.objectKey,
      expiresAt: new Date(this.now().getTime() + input.expiresInSeconds * 1000),
    };
  }

  async delete(): Promise<void> {
    return Promise.resolve();
  }
}
