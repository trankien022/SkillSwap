import { DuplicateActiveVerificationError, Verification } from '../../domain/verification';
import type { Clock } from '../port/out/clock';
import type { CreateUploadTargetInput, DocumentStore, UploadTarget } from '../port/out/document-store';
import type {
  CreateDocumentRequest,
  VerificationDocument,
  VerificationDocumentRepository,
} from '../port/out/verification-document-repository';
import type {
  ApplyDecisionRequest,
  ApplyDecisionResult,
  CreateVerificationRequest,
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
