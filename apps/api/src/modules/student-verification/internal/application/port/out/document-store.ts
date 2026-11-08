export const DOCUMENT_STORE = Symbol('DocumentStore');

/**
 * ADR-023 Amendment A: the download URL is a bearer credential, so its lifetime is a cap the
 * adapter enforces rather than a preference a caller may exceed. Five minutes is long enough to
 * read a multi-page PDF and short enough that a URL pasted into a chat is dead before it is
 * useful. A caller that needs longer mints another URL; minting is stateless.
 */
export const DOWNLOAD_URL_TTL_SECONDS = 300;

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

export interface CreateDownloadTargetInput {
  readonly objectKey: string;
  /** Must not exceed `DOWNLOAD_URL_TTL_SECONDS`; the adapter refuses a longer request. */
  readonly expiresInSeconds: number;
}

export interface DownloadTarget {
  /** Pre-signed GET URL the reviewer opens. Never persisted, never logged, never listed. */
  readonly downloadUrl: string;
  /** When the pre-signed URL stops working. */
  readonly expiresAt: Date;
}

export class DownloadTtlTooLongError extends Error {
  constructor(requested: number, max: number) {
    super(`Download URL lifetime ${requested}s exceeds the ${max}s cap`);
    this.name = 'DownloadTtlTooLongError';
  }
}

/**
 * FR-002 / ADR-023: the object-storage port. The S3 adapter issues pre-signed
 * URLs; the Postgres side keeps metadata. Contents never pass through the app
 * (so they are never logged — NFR-004).
 */
export interface DocumentStore {
  createUploadTarget(input: CreateUploadTargetInput): Promise<UploadTarget>;
  /**
   * ADR-023 Amendment A: mints a short-lived pre-signed GET so an Administrator or Verifier can
   * open the document they are deciding on. The URL is a bearer credential and is returned to the
   * caller only — it must never be written to a column, a log line or a list response.
   */
  createDownloadTarget(input: CreateDownloadTargetInput): Promise<DownloadTarget>;
  /** A best-effort delete for abandoned uploads (metadata is soft-deleted first). */
  delete(objectKey: string): Promise<void>;
}
