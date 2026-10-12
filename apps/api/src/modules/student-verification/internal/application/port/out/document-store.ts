export const DOCUMENT_STORE = Symbol('DocumentStore');

export interface CreateUploadTargetInput {
  readonly objectKey: string;
  readonly contentType: string;
  readonly expiresInSeconds: number;
}

export interface UploadTarget {
  /** Pre-signed PUT URL the client uploads the document bytes to. */
  readonly uploadUrl: string;
  /** Object key the API stores as the document reference. */
  readonly objectKey: string;
  /** When the pre-signed URL stops working. */
  readonly expiresAt: Date;
}

/**
 * FR-002 / ADR-023: the object-storage port. The S3 adapter issues pre-signed
 * URLs; the Postgres side keeps metadata. Contents never pass through the app
 * (so they are never logged — NFR-004).
 */
export interface DocumentStore {
  createUploadTarget(input: CreateUploadTargetInput): Promise<UploadTarget>;
  /** A best-effort delete for abandoned uploads (metadata is soft-deleted first). */
  delete(objectKey: string): Promise<void>;
}
