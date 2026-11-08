import type { DocumentDownloadTargetView } from '@skillswap/contracts';
import { VerificationNotFoundError } from './decide-student-verification.use-case';
import { DocumentReadDeniedError } from '../domain/document-read-denied';
import { DOWNLOAD_URL_TTL_SECONDS, type DocumentStore } from './port/out/document-store';
import type { VerificationRepository } from './port/out/verification-repository';
import type { Clock } from './port/out/clock';
import {
  DOCUMENT_READER_ROLES,
  type DocumentReaderRole,
  type ReadVerificationDocumentCommand,
  type ReadVerificationDocumentPort,
} from './port/in/read-verification-document';

/**
 * FR-002 / ADR-023 Amendment A: an Administrator or Verifier opens the document a student
 * verification is based on.
 *
 * The security-relevant choices, and why each is where it is:
 *
 *  - **The object key comes from the row, never from the caller.** A caller supplies a verification
 *    id; the key is read from that verification. Accepting a key or a document id would turn this
 *    route into an arbitrary-object reader for anyone holding either role.
 *  - **The role is checked here, not only at the route.** `@Roles` guards the HTTP entry point, but
 *    a use case that trusts its caller is one refactor away from being reachable from a consumer or
 *    a CLI without the guard. The check is the invariant; the decorator is the transport.
 *  - **The TTL is a constant, not a parameter.** No caller can widen the window, so the 300 s in the
 *    ADR is the 300 s in production rather than a default somebody overrode in a config file.
 *  - **The audit is written after the URL exists but before it is returned.** If the audit write
 *    fails, the read fails — an unlogged read is the thing Amendment A forbids — and a URL is
 *    never handed out without a record of who took it.
 */
export class ReadVerificationDocumentUseCase implements ReadVerificationDocumentPort {
  constructor(
    private readonly verifications: VerificationRepository,
    private readonly store: DocumentStore,
    private readonly clock: Clock,
  ) {}

  async execute(command: ReadVerificationDocumentCommand): Promise<DocumentDownloadTargetView> {
    this.assertReader(command.actorId, command.actorRole);

    const verification = await this.verifications.findById(command.verificationId);
    if (verification === null) {
      throw new VerificationNotFoundError(command.verificationId);
    }

    const target = await this.store.createDownloadTarget({
      objectKey: verification.documentRef,
      expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
    });

    await this.verifications.recordDocumentRead({
      verificationId: verification.id,
      accountId: verification.accountId,
      documentRef: verification.documentRef,
      actorId: command.actorId,
      actorRole: command.actorRole,
      readAt: this.clock.now(),
    });

    return { downloadUrl: target.downloadUrl, expiresAt: target.expiresAt.toISOString() };
  }

  private assertReader(actorId: string, role: string | undefined): asserts role is DocumentReaderRole {
    if (role === undefined || !(DOCUMENT_READER_ROLES as readonly string[]).includes(role)) {
      throw new DocumentReadDeniedError(actorId);
    }
  }
}
