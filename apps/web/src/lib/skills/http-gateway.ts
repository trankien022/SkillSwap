import {
  skillCataloguePageSchema,
  skillEvidenceHistorySchema,
  skillEvidenceViewSchema,
  profileSkillListSchema,
  submitSkillEvidenceSchema,
  type ProfileSkillView,
  type SkillCatalogueItemView,
  type SkillEvidenceHistoryView,
  type SkillEvidenceView,
  type SubmitSkillEvidenceInput,
} from '@skillswap/contracts';
import { callApi, getTokens, unwrapEnvelope } from '../api-client';

/**
 * Live skills + evidence gateway (S10) — the Web counterpart of
 * `apps/mobile/src/infrastructure/http/skill-evidence-gateway.ts`.
 *
 * This screen did not exist on Web at all, which is why the parity matrix
 * listed S10 as **missing**: a learner could be verified on mobile and then
 * find no way to see or submit skills in the browser.
 *
 * Every endpoint here already exists. Nothing is invented:
 * - `GET /skills`                 — the managed `category → skill` catalogue
 * - `GET /profile-skills/me`      — the caller's own skills and approved levels
 * - `POST /skill-evidence`        — submit evidence for one skill at one level
 * - `GET /skill-evidence/:id/history` — the decision history of that evidence
 *
 * The evidence endpoints are owner-scoped and `POST` is a command, so the
 * gateway never loads another account's data and never replays the submission.
 * There is no file-upload endpoint for evidence, so the form uses the
 * contract's own optional `description` field rather than inventing an upload.
 *
 * All four routes are auth-gated, so `callApi` attaches the bearer token;
 * callers show an explicit sign-in state when there is no session.
 */

/** Raised when the caller has no session; the screen shows a sign-in prompt. */
export class SkillsAuthError extends Error {
  constructor() {
    super('Authentication required to load skills');
    this.name = 'SkillsAuthError';
  }
}

export class HttpSkillsGateway {
  /** True when a session token is present. */
  isAuthenticated(): boolean {
    return getTokens() !== null;
  }

  /** The managed catalogue, needed to pick a skill to submit evidence for. */
  async getCatalogue(): Promise<SkillCatalogueItemView[]> {
    const res = await callApi('/skills?limit=100');
    if (res.status === 401) throw new SkillsAuthError();
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Could not load the skill catalogue'));

    const page = skillCataloguePageSchema.parse(await unwrapEnvelope<unknown>(res));
    return page.items;
  }

  /** The caller's own profile skills, including levels still pending review. */
  async getMyProfileSkills(): Promise<ProfileSkillView[]> {
    const res = await callApi('/profile-skills/me');
    if (res.status === 401) throw new SkillsAuthError();
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Could not load your skills'));

    return profileSkillListSchema.parse(await unwrapEnvelope<unknown>(res)).items;
  }

  /**
   * Submits evidence for one skill at a requested level. Validates the payload
   * with the shared contract before sending, so an invalid request fails locally
   * rather than as a 400 whose message the learner cannot act on.
   *
   * The contract's `description` is `z.string().min(1)` — length only — so a
   * whitespace-only value such as `"   "` passes it. That is not evidence, so it
   * is trimmed and rejected here rather than being sent as a version the review
   * board cannot assess.
   */
  async submitEvidence(input: SubmitSkillEvidenceInput): Promise<SkillEvidenceView> {
    const payload = submitSkillEvidenceSchema.parse(input);
    if (payload.description !== undefined && payload.description.trim().length === 0) {
      throw new Error('Evidence description cannot be blank');
    }

    const res = await callApi('/skill-evidence', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.status === 401) throw new SkillsAuthError();
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Could not submit your evidence'));

    return skillEvidenceViewSchema.parse(await unwrapEnvelope<unknown>(res));
  }

  /** The full decision history for one evidence id. */
  async getEvidenceHistory(evidenceId: string): Promise<SkillEvidenceHistoryView> {
    if (!evidenceId.trim()) throw new Error('Evidence id is required');

    const res = await callApi(`/skill-evidence/${encodeURIComponent(evidenceId.trim())}/history`);
    if (res.status === 401) throw new SkillsAuthError();
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Could not load the decision history'));

    return skillEvidenceHistorySchema.parse(await unwrapEnvelope<unknown>(res));
  }
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}
