import { randomUUID } from 'node:crypto';
import type { StudentVerificationView } from '@skillswap/contracts';
import { DuplicateActiveVerificationError, Verification } from '../domain/verification';
import type { VerificationRepository } from './port/out/verification-repository';
import type { VerificationDocumentRepository } from './port/out/verification-document-repository';
import type { Clock } from './port/out/clock';
import type {
  SubmitStudentVerificationCommand,
  SubmitStudentVerificationPort,
} from './port/in/submit-student-verification';
import { toVerificationView } from './verification-view';

export class DocumentNotFoundError extends Error {
  constructor(documentId: string) {
    super(`Verification document ${documentId} was not found for this account`);
    this.name = 'DocumentNotFoundError';
  }
}

/**
 * FR-002 / AC-001: a Learner submits a student verification referencing an
 * uploaded document. Blocked while an effective (pending|approved) verification
 * already exists (SR-BR-011); the database's partial unique index is the
 * race-safe backstop. The document must belong to the caller and be attachable
 * (ADR-023).
 */
export class SubmitStudentVerificationUseCase implements SubmitStudentVerificationPort {
  constructor(
    private readonly verifications: VerificationRepository,
    private readonly documents: VerificationDocumentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: SubmitStudentVerificationCommand): Promise<StudentVerificationView> {
    const existing = await this.verifications.findEffective(command.accountId);
    if (existing !== null) {
      throw new DuplicateActiveVerificationError(command.accountId);
    }

    const document = await this.documents.findById(command.documentId);
    if (document === null || document.accountId !== command.accountId) {
      throw new DocumentNotFoundError(command.documentId);
    }

    const verification = Verification.submit({
      id: randomUUID(),
      accountId: command.accountId,
      schoolName: command.schoolName,
      major: command.major ?? null,
      documentRef: document.objectKey,
      submittedAt: this.clock.now(),
    });

    const stored = await this.verifications.create({
      id: verification.id,
      accountId: verification.accountId,
      schoolName: verification.schoolName,
      major: verification.major,
      documentRef: verification.documentRef,
      submittedAt: verification.submittedAt,
    });

    await this.documents.attach(document.id, command.accountId);

    return toVerificationView(stored);
  }
}
