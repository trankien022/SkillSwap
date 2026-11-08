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
  /**
   * ADR-023 Amendment A: the document's reference (the object key), so a reviewer knows *which*
   * file a decision was about and a learner can see what they submitted.
   *
   * **A reference, never a URL.** It is useless without a signature, which is why it may ride in a
   * list payload while a minted download URL may not. Added as `.optional()` rather than required
   * so the existing web and mobile clients keep parsing: a schema change that rejects a payload
   * those clients already handle is a breaking change disguised as an additive one.
   */
  documentId: z.string().min(1).nullable().optional(),
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

/**
 * ADR-023 Amendment A: a reviewer opened the uploaded document.
 *
 * Deliberately carries **no URL**. A minted download URL is a bearer credential valid for 300
 * seconds; one written into an event payload would then live in the outbox, in the broker and in
 * the audit row for as long as the record is retained. `documentRef` is the object key, which is
 * only an identifier — it is useless without a signature.
 */
export const studentVerificationDocumentReadEventSchema = z.object({
  verificationId: z.string().min(1),
  /** The owner of the verification. **Not** the actor — see `actorId` (ADR-035). */
  accountId: z.string().min(1),
  /** The object key the reviewer opened. A reference, never a URL. */
  documentRef: z.string().min(1),
  /** `admin` or `verifier`; recorded because the two mean different things in an audit trail. */
  actorRole: z.string().min(1),
  occurredAt: z.string().datetime({ offset: true }),
  /** ADR-035: the person who read the document. */
  actorId: actorIdSchema,
});
export type StudentVerificationDocumentReadEvent = z.infer<
  typeof studentVerificationDocumentReadEventSchema
>;
