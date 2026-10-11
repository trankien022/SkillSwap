import { createZodDto } from 'nestjs-zod';
import {
  profileSkillSchema,
  skillEvidenceDecisionSchema,
  skillEvidenceHistorySchema,
  skillEvidenceViewSchema,
  submitSkillEvidenceSchema,
  verifierQueuePageSchema,
  verifierQueueQuerySchema,
  verifierSchema,
  verifierStatusChangeSchema,
} from '@skillswap/contracts';

/** FR-003 / API-002: submit skill evidence. Body for POST /skill-evidence. */
export class SubmitSkillEvidenceDto extends createZodDto(submitSkillEvidenceSchema) {}

/** FR-003: the owner-facing view of one evidence version. */
export class SkillEvidenceDto extends createZodDto(skillEvidenceViewSchema) {}

/** FR-018: the full decision history of a profile-skill's evidence. */
export class SkillEvidenceHistoryDto extends createZodDto(skillEvidenceHistorySchema) {}

/** FR-003: one profile skill with its effective approved level. */
export class ProfileSkillDto extends createZodDto(profileSkillSchema) {}

/** FR-004 / ADR-027: a Verifier account with a seeded expertise set. */
export class VerifierDto extends createZodDto(verifierSchema) {}

/** FR-004: an administrator changes a Verifier's lifecycle status. */
export class VerifierStatusChangeDto extends createZodDto(verifierStatusChangeSchema) {}

/** FR-004 / API-003: approve or reject a claimed evidence request. */
export class SkillEvidenceDecisionDto extends createZodDto(skillEvidenceDecisionSchema) {}

/** FR-004 / NFR-014: query params for GET /verifiers/me/queue. */
export class VerifierQueueQueryDto extends createZodDto(verifierQueueQuerySchema) {}

/** FR-004 / NFR-014: a page of the Verifier's expertise-scoped pending queue. */
export class VerifierQueuePageDto extends createZodDto(verifierQueuePageSchema) {}
