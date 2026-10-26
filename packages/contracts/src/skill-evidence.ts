import { z } from 'zod';
import { actorIdSchema } from './audit-actor';

/**
 * FR-003 / ADR-026 + FR-004: the skill-evidence wire shapes.
 *
 * Extracted from `index.ts` so the FR-015 admin contracts can compose them without importing the
 * barrel — a leaf importing the barrel that re-exports it is a cycle, and `no-circular` is an
 * architecture rule here, not a style preference.
 */

/** FR-003 / ADR-026: skill taxonomy, evidence types and the fixed ordered level scale. */
export const skillLevelSchema = z.enum(['beginner', 'intermediate', 'advanced', 'expert']);
export type SkillLevel = z.infer<typeof skillLevelSchema>;

export const evidenceTypeSchema = z.enum(['certificate', 'verifier_assessment']);
export type EvidenceType = z.infer<typeof evidenceTypeSchema>;

export const evidenceStatusSchema = z.enum(['pending', 'claimed', 'approved', 'rejected', 'superseded']);
export type EvidenceStatus = z.infer<typeof evidenceStatusSchema>;

/** FR-003: a catalogue entry in the two-level `category → skill` tree (ADR-026 §1–2). */
export const skillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
});
export type SkillView = z.infer<typeof skillSchema>;

/** FR-003 / ADR-026 §5: the effective approved level cache; null until approved. */
export const profileSkillSchema = z.object({
  id: z.string().min(1),
  skillId: z.string().min(1),
  skillName: z.string().min(1),
  category: z.string().min(1),
  approvedLevel: skillLevelSchema.nullable(),
});
export type ProfileSkillView = z.infer<typeof profileSkillSchema>;

/**
 * FR-003 / NFR-014: query params for GET /profile-skills/me. The result is bounded by the
 * managed skill catalogue, so there is no pagination (`page: null`); the caller may still
 * search by skill name and choose the sort order.
 */
export const profileSkillQuerySchema = z.object({
  q: z.string().min(1).optional(),
  sort: z.enum(['category', 'name', '-approvedLevel']).optional(),
});
export type ProfileSkillQueryInput = z.infer<typeof profileSkillQuerySchema>;

/** FR-003: the caller's profile skills (bounded by the catalogue → no page metadata). */
export const profileSkillListSchema = z.object({
  items: z.array(profileSkillSchema),
  page: z.null(),
});
export type ProfileSkillList = z.infer<typeof profileSkillListSchema>;

/** FR-003 / API-002: submit skill evidence for a known skill at a requested level. */
export const submitSkillEvidenceSchema = z.object({
  skillId: z.string().min(1),
  requestedLevel: skillLevelSchema,
  evidenceType: evidenceTypeSchema,
  documentRef: z.string().min(1).max(500).optional(),
  description: z.string().min(1).max(1000).optional(),
});
export type SubmitSkillEvidenceInput = z.infer<typeof submitSkillEvidenceSchema>;

/** FR-003: the owner-facing view of one evidence version. */
export const skillEvidenceViewSchema = z.object({
  id: z.string().min(1),
  profileSkillId: z.string().min(1),
  skillId: z.string().min(1),
  skillName: z.string().min(1).nullable(),
  category: z.string().min(1).nullable(),
  ownerId: z.string().min(1).nullable(),
  version: z.number().int().positive(),
  evidenceType: evidenceTypeSchema,
  documentRef: z.string().min(1).nullable(),
  description: z.string().min(1).nullable(),
  requestedLevel: skillLevelSchema,
  approvedLevel: skillLevelSchema.nullable(),
  status: evidenceStatusSchema,
  claimedBy: z.string().min(1).nullable(),
  claimedAt: z.string().datetime({ offset: true }).nullable(),
  reason: z.string().min(1).nullable(),
  decidedAt: z.string().datetime({ offset: true }).nullable(),
  submittedAt: z.string().datetime({ offset: true }),
});
export type SkillEvidenceView = z.infer<typeof skillEvidenceViewSchema>;

/** FR-003 / ADR-013: emitted in the same transaction as the evidence write. */
export const skillEvidenceEventSchema = z.object({
  evidenceId: z.string().min(1),
  profileSkillId: z.string().min(1),
  accountId: z.string().min(1),
  skillId: z.string().min(1),
  version: z.number().int().positive(),
  requestedLevel: skillLevelSchema,
  status: evidenceStatusSchema,
  // Set on a decision: the effective level granted (null unless approved) and the reason on rejection.
  approvedLevel: skillLevelSchema.nullable().optional(),
  reason: z.string().min(1).nullable().optional(),
  occurredAt: z.string().datetime({ offset: true }),
  /**
   * ADR-035: who acted. The submitter on `skill.evidence.submitted`, the Verifier on `claimed`,
   * and the deciding Verifier on `approved`/`rejected` — the same field, because in each case the
   * event is an act by exactly one account.
   */
  actorId: actorIdSchema,
});
export type SkillEvidenceEvent = z.infer<typeof skillEvidenceEventSchema>;
