export const DOCUMENT_STORE = Symbol('DocumentStore');

export interface CreateUploadTargetInput {
  readonly objectKey: string;
  readonly contentType: string;
  readonly expiresInSeconds: number;
}

export interface UploadTarget {
  /** Endpoint the multipart body is posted to. */
  readonly uploadUrl: string;
  /** Always `POST`: the provider authenticates via signed body fields, not a URL signature. */
  readonly method: 'POST';
  /**
   * Signed credential fields. A client sends every pair verbatim, unmodified and un-encoded,
   * alongside the file part — the provider re-derives the signature from what it receives.
   */
  readonly fields: Readonly<Record<string, string>>;
  /** Provider object id (Cloudinary `public_id`) the API stores as the document reference. */
  readonly objectKey: string;
  /**
   * Advisory only. Cloudinary publishes no upload-signature TTL, so unlike an S3 pre-signed
   * URL nothing server-side enforces this; it guards a client against a stale target.
   */
  readonly expiresAt: Date;
}

/**
 * FR-002 / ADR-038: the object-storage port. The Cloudinary adapter issues a signed multipart
 * form; the Postgres side keeps metadata. Contents never pass through the app (so they are
 * never logged — NFR-004).
 */
export interface DocumentStore {
  createUploadTarget(input: CreateUploadTargetInput): Promise<UploadTarget>;
  /** A best-effort delete for abandoned uploads (metadata is soft-deleted first). */
  delete(objectKey: string): Promise<void>;
}
