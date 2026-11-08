import type { DocumentDownloadTargetView } from '@skillswap/contracts';

export const READ_VERIFICATION_DOCUMENT = Symbol('ReadVerificationDocument');

/** ADR-023 Amendment A: who may open a stored verification document. */
export const DOCUMENT_READER_ROLES = ['admin', 'verifier'] as const;
export type DocumentReaderRole = (typeof DOCUMENT_READER_ROLES)[number];

export interface ReadVerificationDocumentCommand {
  readonly verificationId: string;
  /** ADR-035: the person reading. Not the learner the verification belongs to. */
  readonly actorId: string;
  readonly actorRole: string | undefined;
}

/**
 * FR-002 / ADR-023 Amendment A: mints a short-lived pre-signed GET for the document attached to a
 * verification. Admin and verifier only; the owner is served by `GET /me` with the reference but
 * never a URL, because a URL is a credential and the owner already holds the bytes they uploaded.
 */
export interface ReadVerificationDocumentPort {
  execute(command: ReadVerificationDocumentCommand): Promise<DocumentDownloadTargetView>;
}
