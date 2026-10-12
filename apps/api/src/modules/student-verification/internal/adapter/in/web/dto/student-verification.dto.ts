import { createZodDto } from 'nestjs-zod';
import {
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

/** FR-002: submit a student verification. Body for POST /student-verifications. */
export class SubmitStudentVerificationDto extends createZodDto(submitStudentVerificationSchema) {}

/** FR-002: approve or reject a verification. Body for POST /student-verifications/:id/decision. */
export class VerificationDecisionDto extends createZodDto(verificationDecisionSchema) {}

/** FR-019 / ADR-025: revoke a verification. Body for POST /student-verifications/:id/revocation. */
export class VerificationRevocationDto extends createZodDto(verificationRevocationSchema) {}

/** FR-002: the verification view returned by the student-verification endpoints. */
export class StudentVerificationDto extends createZodDto(studentVerificationSchema) {}
