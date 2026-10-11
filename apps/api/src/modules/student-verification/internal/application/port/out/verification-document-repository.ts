export const VERIFICATION_DOCUMENT_REPOSITORY = Symbol('VerificationDocumentRepository');

export type DocumentStatus = 'pending' | 'attached';

export interface VerificationDocument {
  readonly id: string;
  readonly accountId: string;
  readonly objectKey: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly status: DocumentStatus;
  readonly createdAt: Date;
}

export interface CreateDocumentRequest {
  readonly id: string;
  readonly accountId: string;
  readonly objectKey: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}

/**
 * FR-002 / ADR-023: the Postgres metadata side of document storage. The bytes
 * live in S3; this row records owner, object key, type/size and attachment.
 */
export interface VerificationDocumentRepository {
  create(request: CreateDocumentRequest): Promise<VerificationDocument>;
  findById(documentId: string): Promise<VerificationDocument | null>;
  /** Marks a pending document as attached to a submission (owner-scoped). */
  attach(documentId: string, accountId: string): Promise<boolean>;
}
