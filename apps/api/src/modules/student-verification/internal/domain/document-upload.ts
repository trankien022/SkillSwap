/**
 * FR-002 / ADR-023: document-upload rules. Pure, framework-free: the allowlist
 * and size bound are injected from config so tests fix them and production reads
 * them from the environment.
 */

export const DEFAULT_ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const;

export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export class UnsupportedDocumentTypeError extends Error {
  constructor(contentType: string, allowed: readonly string[]) {
    super(`Unsupported document type: ${contentType} (allowed: ${allowed.join(', ')})`);
    this.name = 'UnsupportedDocumentTypeError';
  }
}

export class DocumentTooLargeError extends Error {
  constructor(sizeBytes: number, maxBytes: number) {
    super(`Document is too large: ${sizeBytes} bytes (max ${maxBytes})`);
    this.name = 'DocumentTooLargeError';
  }
}

export class InvalidDocumentFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDocumentFileError';
  }
}

export interface UploadPolicy {
  readonly allowedContentTypes: readonly string[];
  readonly maxBytes: number;
}

/** Validates a file name plus its declared type/size against the policy (NFR-008). */
export function assertUploadable(
  input: { fileName: string; contentType: string; sizeBytes: number },
  policy: UploadPolicy,
): void {
  if (input.fileName.trim().length === 0) {
    throw new InvalidDocumentFileError('fileName must not be empty');
  }
  if (!policy.allowedContentTypes.includes(input.contentType)) {
    throw new UnsupportedDocumentTypeError(input.contentType, policy.allowedContentTypes);
  }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new InvalidDocumentFileError('sizeBytes must be a positive integer');
  }
  if (input.sizeBytes > policy.maxBytes) {
    throw new DocumentTooLargeError(input.sizeBytes, policy.maxBytes);
  }
}

/** A safe, non-guessable object key: `<accountId>/<documentId>.<ext>`. */
export function buildObjectKey(input: {
  accountId: string;
  documentId: string;
  fileName: string;
}): string {
  const extension = extensionOf(input.fileName);
  return `${input.accountId}/${input.documentId}${extension}`;
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0 || dot === fileName.length - 1) {
    return '';
  }
  const ext = fileName.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? `.${ext}` : '';
}
