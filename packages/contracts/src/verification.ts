import { z } from 'zod';
import { actorIdSchema } from './audit-actor';

/**
 * FR-002 / ADR-023 + FR-019 / ADR-025: the student-verification wire shapes.
 *
 * Extracted from `index.ts` so the FR-015 admin contracts can compose them without importing the
 * barrel — a leaf importing the barrel that re-exports it is a cycle, and `no-circular` is an
 * architecture rule here, not a style preference.
 */

/** At most one effective (pending|approved) verification per account; no expiry in the MVP. */
export const verificationStatusSchema = z.enum(['pending', 'approved', 'rejected', 'revoked']);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export const submitStudentVerificationSchema = z.object({
  schoolName: z.string().min(1).max(200),
  major: z.string().min(1).max(120).optional(),
  documentId: z.string().min(1).max(100),
});
export type SubmitStudentVerificationInput = z.infer<typeof submitStudentVerificationSchema>;

export const verificationDecisionSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().min(1).max(500).optional(),
    approvedMajor: z.string().min(1).max(120).optional(),
  })
  .refine((value) => value.decision !== 'reject' || (value.reason?.trim().length ?? 0) > 0, {
    message: 'A rejection requires a reason',
    path: ['reason'],
  });
export type VerificationDecisionInput = z.infer<typeof verificationDecisionSchema>;

// Alias for student-verification request shape (same as VerificationDecisionDto in docs/api)
export const studentVerificationDecisionSchema = verificationDecisionSchema;
export type StudentVerificationDecisionInput = z.infer<typeof studentVerificationDecisionSchema>;

/** FR-019 / ADR-025: revoke a verification (admin only, reason required). */
export const verificationRevocationSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type VerificationRevocationInput = z.infer<typeof verificationRevocationSchema>;

export const studentVerificationSchema = z.object({
  id: z.string().min(1),
  status: verificationStatusSchema,
  schoolName: z.string().min(1),
  major: z.string().min(1).nullable(),
  reviewerId: z.string().min(1).nullable(),
  reason: z.string().min(1).nullable(),
  decidedAt: z.string().datetime({ offset: true }).nullable(),
  submittedAt: z.string().datetime({ offset: true }),
});
export type StudentVerificationView = z.infer<typeof studentVerificationSchema>;

export const studentVerificationEventSchema = z.object({
  verificationId: z.string().min(1),
  accountId: z.string().min(1),
  status: verificationStatusSchema,
  schoolName: z.string().min(1),
  reason: z.string().min(1).nullable(),
  occurredAt: z.string().datetime({ offset: true }),
  /** ADR-035: the Administrator who made the decision. */
  actorId: actorIdSchema,
});
export type StudentVerificationEvent = z.infer<typeof studentVerificationEventSchema>;
