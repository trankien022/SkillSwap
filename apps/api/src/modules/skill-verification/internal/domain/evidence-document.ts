/**
 * FR-003 / ADR-023 (storage half): the upload rules for certificate evidence.
 *
 * **Why this is a second copy of `student-verification`'s `document-upload.ts`.** The rules are the
 * same three checks and the same allow-list, and duplicating them is exactly the kind of thing that
 * drifts. It is duplicated anyway because the module boundary says it must be: `domain/` may not
 * import `shared/` (`.dependency-cruiser.cjs`, `domain-application-stay-inside-module`) and may not
 * reach into another module (ADR-005/ADR-011). The expensive, error-prone half — the Cloudinary
 * signature — *is* shared (`shared/storage/cloudinary-sign.ts`), because that one lives in an
 * adapter and adapters may use `shared/`. What is copied here is four `if` statements with no
 * arithmetic in them, and the list they read is injected from the same config keys, so the two
 * cannot accept different file types.
 *
 * The policy values are injected: a test fixes them, production reads them from `.env`.
 */

export const DEFAULT_ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const;

export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export class UnsupportedEvidenceTypeError extends Error {
  constructor(contentType: string, allowed: readonly string[]) {
    super(`Unsupported document type: ${contentType} (allowed: ${allowed.join(', ')})`);
    this.name = 'UnsupportedEvidenceTypeError';
  }
}

export class EvidenceTooLargeError extends Error {
  constructor(sizeBytes: number, maxBytes: number) {
    super(`Document is too large: ${sizeBytes} bytes (max ${maxBytes})`);
    this.name = 'EvidenceTooLargeError';
  }
}

export class InvalidEvidenceFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEvidenceFileError';
  }
}

export interface EvidenceUploadPolicy {
  readonly allowedContentTypes: readonly string[];
  readonly maxBytes: number;
}

/** Validates a file name plus its declared type/size against the policy (NFR-008). */
export function assertEvidenceUploadable(
  input: { fileName: string; contentType: string; sizeBytes: number },
  policy: EvidenceUploadPolicy,
): void {
  if (input.fileName.trim().length === 0) {
    throw new InvalidEvidenceFileError('fileName must not be empty');
  }
  if (!policy.allowedContentTypes.includes(input.contentType)) {
    throw new UnsupportedEvidenceTypeError(input.contentType, policy.allowedContentTypes);
  }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new InvalidEvidenceFileError('sizeBytes must be a positive integer');
  }
  if (input.sizeBytes > policy.maxBytes) {
    throw new EvidenceTooLargeError(input.sizeBytes, policy.maxBytes);
  }
}

/** A safe, non-guessable object key: `<accountId>/<documentId>.<ext>`. */
export function buildEvidenceObjectKey(input: {
  accountId: string;
  documentId: string;
  fileName: string;
}): string {
  return `${input.accountId}/${input.documentId}${extensionOf(input.fileName)}`;
}

/**
 * FR-003: may this account legitimately reference this object key?
 *
 * Certificate evidence has no metadata row to prove ownership the way a student verification does,
 * so the check is made against the key's own shape. Keys are minted by `buildEvidenceObjectKey` as
 * `<accountId>/<uuid>.<ext>`, and an account id is a UUID — so a key whose **first segment is a
 * UUID** is one of ours, and it must carry the caller's own id.
 *
 * Anything else (`docs/cert.pdf`, an external URL, a hand-written label) is *not* a key this bucket
 * could resolve. Those are allowed through unchanged, which keeps this an additive rule: the
 * contract has always described `documentRef` as a free string, and rejecting the free-string form
 * now would break every client already sending one. Such a reference grants nothing — the download
 * route signs it, the store answers that the asset does not exist, and the reviewer sees a broken
 * link rather than another account's file.
 *
 * The rule that matters is therefore narrow and exact: **a reference in our minted shape must
 * belong to the submitter.** That is what stops a learner from naming somebody else's real object.
 */
export function isClaimableEvidenceKey(objectKey: string, accountId: string): boolean {
  const firstSegment = objectKey.split('/')[0] ?? '';
  if (!UUID_SHAPE.test(firstSegment)) {
    // Not one of ours — passes through, and cannot open anything.
    return true;
  }
  return firstSegment === accountId;
}

/** FR-003: the reference names an object minted for a different account. */
export class ForeignEvidenceDocumentError extends Error {
  constructor(documentRef: string) {
    super(`Document ${documentRef} was not issued to this account`);
    this.name = 'ForeignEvidenceDocumentError';
  }
}

/** `8-4-4-4-12` hex, the shape of every account and document id this system mints. */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0 || dot === fileName.length - 1) {
    return '';
  }
  const ext = fileName.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? `.${ext}` : '';
}
