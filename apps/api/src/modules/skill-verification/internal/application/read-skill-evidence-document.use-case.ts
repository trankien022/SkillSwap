import type { DocumentDownloadTargetView } from '@skillswap/contracts';
import { AccessDeniedError } from '../domain/access';
import { EvidenceNotFoundError } from '../domain/evidence';
import {
  EVIDENCE_DOWNLOAD_URL_TTL_SECONDS,
  type EvidenceDocumentStore,
} from './port/out/evidence-document-store';
import type {
  EvidenceAuditRepository,
  ProfileSkillRepository,
  SkillEvidenceRepository,
} from './port/out/skill-evidence-repository';
import type { Clock } from './port/out/clock';
import {
  DOCUMENT_READER_ROLES,
  type DocumentReaderRole,
  type ReadSkillEvidenceDocumentCommand,
  type ReadSkillEvidenceDocumentPort,
} from './port/in/read-skill-evidence-document';

/**
 * FR-003: a reviewer opens the certificate an evidence version is based on.
 *
 * **The access rule is ADR-023 Amendment A's, applied unchanged.** `admin` and `verifier` may read;
 * the owner may read their own. That is deliberately the same rule B8 uses for identity documents,
 * not a second one invented for certificates — two rules over the same kind of resource is how a
 * system ends up showing one role the description but not the file.
 *
 * An earlier draft also required the Verifier to have *claimed* the row. That was stricter than the
 * ADR and wrong for the actual workflow: claims are permanent (ADR's MVP has no release), so a
 * Verifier who opened a queue item to decide whether to take it would have been refused the file
 * they need in order to decide. The role is the permission; the claim is a work-assignment.
 *
 * The object key comes from the stored row, never from the caller, so holding either role cannot be
 * turned into a reader for arbitrary objects in the bucket.
 */
export class ReadSkillEvidenceDocumentUseCase implements ReadSkillEvidenceDocumentPort {
  constructor(
    private readonly evidence: SkillEvidenceRepository,
    private readonly profileSkills: ProfileSkillRepository,
    private readonly audit: EvidenceAuditRepository,
    private readonly store: EvidenceDocumentStore,
    private readonly clock: Clock,
  ) {}

  async execute(command: ReadSkillEvidenceDocumentCommand): Promise<DocumentDownloadTargetView> {
    const target = await this.evidence.findById(command.evidenceId);
    if (target === null) {
      throw new EvidenceNotFoundError(command.evidenceId);
    }
    const profileSkill = await this.profileSkills.findById(target.profileSkillId);
    if (profileSkill === null) {
      throw new EvidenceNotFoundError(command.evidenceId);
    }

    // The owner case is checked first because ownership outranks the absence of a role: a learner
    // looking at their own certificate is not exercising a reviewer privilege.
    this.assertMayRead(
      command.viewerId,
      command.viewerRole,
      profileSkill.accountId === command.viewerId,
    );

    if (target.documentRef === null) {
      // A `verifier_assessment` may rely on its description instead of a file. That is a
      // legitimate state, not a missing record, so it is reported as "no document" rather than 404.
      throw new EvidenceDocumentMissingError(command.evidenceId);
    }

    const download = await this.store.createDownloadTarget({
      objectKey: target.documentRef,
      expiresInSeconds: EVIDENCE_DOWNLOAD_URL_TTL_SECONDS,
    });

    // Written after the URL exists but before it is returned: if the audit fails, the read fails.
    await this.audit.recordDocumentRead({
      evidenceId: target.id,
      accountId: profileSkill.accountId,
      documentRef: target.documentRef,
      actorId: command.viewerId,
      actorRole: command.viewerRole ?? 'unknown',
      readAt: this.clock.now(),
    });

    return {
      downloadUrl: download.downloadUrl,
      expiresAt: download.expiresAt.toISOString(),
    };
  }

  /**
   * Checked here rather than only at the route: `@Roles` guards the HTTP entry point, but a use
   * case that trusts its caller is one refactor away from being reachable from a consumer or a CLI
   * without the guard. The check is the invariant; the decorator is the transport.
   */
  private assertMayRead(
    viewerId: string,
    role: string | undefined,
    isOwner: boolean,
  ): asserts role is DocumentReaderRole | undefined {
    if (isOwner) return;
    if (role !== undefined && (DOCUMENT_READER_ROLES as readonly string[]).includes(role)) return;
    throw new AccessDeniedError(viewerId);
  }
}

/** FR-003: the evidence version exists but has no file (a description-only assessment). */
export class EvidenceDocumentMissingError extends Error {
  constructor(evidenceId: string) {
    super(`Skill evidence ${evidenceId} has no attached document`);
    this.name = 'EvidenceDocumentMissingError';
  }
}
