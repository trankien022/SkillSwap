import type { DocumentDownloadTargetView } from '@skillswap/contracts';

export const READ_SKILL_EVIDENCE_DOCUMENT = Symbol('ReadSkillEvidenceDocument');

/**
 * FR-003 / ADR-023 Amendment A: who may open a stored certificate.
 *
 * The same two roles B8 grants for identity documents, because the act is the same: a reviewer
 * looking at somebody else's proof. The owner is additionally allowed by ownership, which the use
 * case checks; this list is the *privileged* half only.
 */
export const DOCUMENT_READER_ROLES = ['admin', 'verifier'] as const;
export type DocumentReaderRole = (typeof DOCUMENT_READER_ROLES)[number];

export interface ReadSkillEvidenceDocumentCommand {
  readonly evidenceId: string;
  /** The person reading. For a reviewer this is not the learner the evidence belongs to. */
  readonly viewerId: string;
  readonly viewerRole: string | undefined;
}

export interface ReadSkillEvidenceDocumentPort {
  execute(command: ReadSkillEvidenceDocumentCommand): Promise<DocumentDownloadTargetView>;
}
