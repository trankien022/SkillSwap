import { createZodDto } from 'nestjs-zod';
import {
  adminVerificationPageSchema,
  adminVerificationQuerySchema,
  documentDownloadTargetSchema,
  documentUploadRequestSchema,
  documentUploadTargetSchema,
  studentVerificationSchema,
  submitStudentVerificationSchema,
  verificationDecisionSchema,
  verificationRevocationSchema,
} from '@skillswap/contracts';

/** FR-002: request a pre-signed upload target. Body for POST /student-verifications/documents. */
export class DocumentUploadRequestDto extends createZodDto(documentUploadRequestSchema) {}

/** FR-002: the pre-signed upload target returned to the client. */
export class DocumentUploadTargetDto extends createZodDto(documentUploadTargetSchema) {}

/**
 * ADR-023 Amendment A: the pre-signed GET returned to a reviewer.
 *
 * The only DTO that carries a URL. It is minted per call and never stored, so this class is the
 * whole lifetime of a document credential.
 */
export class DocumentDownloadTargetDto extends createZodDto(documentDownloadTargetSchema) {}

/** FR-002: submit a student verification. Body for POST /student-verifications. */
export class SubmitStudentVerificationDto extends createZodDto(submitStudentVerificationSchema) {}

/** FR-002: approve or reject a verification. Body for POST /student-verifications/:id/decision. */
export class VerificationDecisionDto extends createZodDto(verificationDecisionSchema) {}

/** FR-019 / ADR-025: revoke a verification. Body for POST /student-verifications/:id/revocation. */
export class VerificationRevocationDto extends createZodDto(verificationRevocationSchema) {}

/** FR-002: the verification view returned by the student-verification endpoints. */
export class StudentVerificationDto extends createZodDto(studentVerificationSchema) {}

/** FR-015: query params for the admin verification queue (GET /student-verifications). */
export class AdminVerificationQueryDto extends createZodDto(adminVerificationQuerySchema) {}

/** FR-015: a page of the admin verification queue. */
export class AdminVerificationPageDto extends createZodDto(adminVerificationPageSchema) {}
