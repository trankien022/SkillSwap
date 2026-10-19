import {
  createClassSchema,
  profileSkillListSchema,
  type CreateClassInput,
  type ProfileSkillView,
} from '@skillswap/contracts';
import { callApi, getTokens, unwrapEnvelope } from '../api-client';
import { priceIsValid, capacityIsValid, isAllowedDuration, titleOver } from './money';
import type { ClassDraft, PublishResult, VerifiedSkill } from './types';

/**
 * Live gateway for the "publish a class" workspace (FR-005 / FR-022 / API-004),
 * mirroring what the mobile client does for its own teaching screens.
 *
 * There is exactly one publish path: this class posts to the real
 * `POST /classes`. The previous implementation called the API *and* a mock
 * gateway, swallowed any API failure, and reported the mock's synthetic result
 * as success — so a rejected publish looked like a published class, complete
 * with a fabricated room code.
 *
 * What the backend actually returns for a created class is `classSchema`
 * (`id`, `teacherId`, `state`, `startsAt`, `durationMinutes`, `priceCredits`,
 * `capacity`). It has **no room code**: the Jitsi room is minted later, at
 * `POST /classes/bookings/:bookingId/room-access`. The publish screen therefore
 * shows the class id only, rather than inventing a code the system never issued.
 *
 * Verified skills come from `GET /profile-skills/me`. That view carries
 * `skillId`, `skillName`, `category` and `approvedLevel`; it does not carry a
 * verifier name or an approval date, so the picker shows only what the server
 * knows.
 */

/** Raised when the caller has no session; the page shows a sign-in prompt. */
export class TeacherPublishAuthError extends Error {
  constructor() {
    super('Authentication required to publish a class');
    this.name = 'TeacherPublishAuthError';
  }
}

export class HttpTeacherPublishGateway {
  /** True when a session token is present. */
  isAuthenticated(): boolean {
    return getTokens() !== null;
  }

  /**
   * The teacher's own approved skills. Only a skill with an `approvedLevel` may
   * be used to open a class (BR-008 / BR-010), so pending skills are filtered
   * out here rather than shown and then rejected at publish time.
   */
  async getVerifiedSkills(): Promise<VerifiedSkill[]> {
    // Bounded collection (`page: null`): it returns every approved skill, so a
    // `limit` here would be accepted-and-ignored. Ask for the resource, not a page.
    const res = await callApi('/profile-skills/me');
    if (res.status === 401) throw new TeacherPublishAuthError();
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, 'Could not load your verified skills'));
    }

    const page = profileSkillListSchema.parse(await unwrapEnvelope<unknown>(res));
    return page.items
      .filter((item: ProfileSkillView) => item.approvedLevel !== null)
      .map(toVerifiedSkill);
  }

  /** A blank draft; the form owns the authoritative copy. */
  getDraft(): Promise<ClassDraft> {
    return Promise.resolve(emptyDraft());
  }

  /** Publishes to the real marketplace. Throws with the API's own message. */
  async publishDraft(draft: ClassDraft, skillName: string): Promise<PublishResult> {
    const payload = toCreateClassInput(draft, skillName);
    const res = await callApi('/classes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.status === 401) throw new TeacherPublishAuthError();
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, 'Could not publish the class'));
    }

    const created = await unwrapEnvelope<{ id: string; startsAt?: string }>(res);
    return {
      classId: created.id,
      publishedAt: created.startsAt ?? payload.startsAt,
    };
  }

  /** True when the draft satisfies the same rules the API enforces. */
  async canPublish(draft: ClassDraft): Promise<boolean> {
    return this.assertValid(draft) === null;
  }

  private assertValid(draft: ClassDraft): string | null {
    if (!draft.skillId.trim()) return 'skill is required';
    if (!draft.title.trim()) return 'title is required';
    if (titleOver(draft.title)) return 'title exceeds 100 chars';
    if (!draft.description.trim()) return 'description is required';
    if (!isAllowedDuration(draft.durationMinutes)) return 'duration is not a standard value';
    if (!draft.startsOn) return 'start date is required';
    if (!/^\d{2}:\d{2}$/.test(draft.startsAt)) return 'start time is required';
    if (!priceIsValid(draft.priceCredits)) return 'price is out of range';
    if (!capacityIsValid(draft.capacity)) return 'capacity is out of range';
    return null;
  }
}

/* --- Mapping --- */

/**
 * `ProfileSkillView` -> the picker's view model. The verifier name and approval
 * date are deliberately absent: the endpoint does not return them, and inventing
 * them would put a fabricated person's name in front of the teacher.
 */
export function toVerifiedSkill(item: ProfileSkillView): VerifiedSkill {
  return {
    id: item.skillId,
    category: toSkillCategory(item.category),
    label: item.skillName,
    approvedLevel: item.approvedLevel,
  };
}

/** Maps a free-text catalogue category onto the icon set, defaulting to code. */
function toSkillCategory(category: string): VerifiedSkill['category'] {
  const normalized = category.trim().toLowerCase();
  if (normalized.includes('language')) return 'language';
  if (normalized.includes('program') || normalized.includes('code')) return 'code';
  if (normalized.includes('design')) return 'design';
  if (normalized.includes('math')) return 'math';
  if (normalized.includes('business')) return 'business';
  if (normalized.includes('science')) return 'science';
  return 'code';
}

/**
 * Combines the title and the description into the single `description` field the
 * API accepts, and concatenates the schedule into an ISO instant. The API has no
 * separate title field, so the title leads the description rather than being
 * dropped.
 */
export function toCreateClassInput(draft: ClassDraft, skillName: string): CreateClassInput {
  const startsAt = toStartsAtIso(draft);
  const description = draft.title.trim()
    ? `${draft.title.trim()}\n\n${draft.description.trim()}`
    : draft.description.trim();

  return {
    skillIds: [draft.skillId],
    // `skillName` is not sent; it is only used to keep the description
    // self-describing if the teacher left it thin.
    description: description || skillName,
    startsAt,
    durationMinutes: draft.durationMinutes,
    priceCredits: draft.priceCredits,
    capacity: draft.capacity,
  };
}

/**
 * Renders the local date/time the teacher picked as an instant.
 *
 * The date and time are validated by shape *before* handing them to `Date`,
 * because `new Date` is lenient in ways that matter here: on V8,
 * `new Date('T:00')` does not throw — it silently resolves to 2000-01-01. A
 * blank schedule must not be published as a class dated the year 2000, so the
 * shape is enforced first and anything else throws.
 *
 * The resulting instant is in the browser's timezone, which is what the teacher
 * saw in the picker; `toISOString()` normalises it to UTC for the API.
 */
function toStartsAtIso(draft: ClassDraft): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.startsOn)) {
    throw new Error('The start date is not valid');
  }
  if (!/^\d{2}:\d{2}$/.test(draft.startsAt)) {
    throw new Error('The start time is not valid');
  }

  const [year, month, day] = draft.startsOn.split('-').map(Number);
  const [hour, minute] = draft.startsAt.split(':').map(Number);
  const combined = new Date(year, month - 1, day, hour, minute, 0, 0);

  // Reject calendar-rollover inputs such as 2026-02-31 or 24:30.
  const isSameInstant =
    combined.getFullYear() === year &&
    combined.getMonth() === month - 1 &&
    combined.getDate() === day &&
    combined.getHours() === hour &&
    combined.getMinutes() === minute;

  if (Number.isNaN(combined.getTime()) || !isSameInstant) {
    throw new Error('The start date and time are not valid');
  }

  return combined.toISOString();
}

function emptyDraft(): ClassDraft {
  return {
    skillId: '',
    title: '',
    description: '',
    durationMinutes: 60,
    startsOn: '',
    startsAt: '',
    capacity: 1,
    priceCredits: 100,
  };
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}

export { createClassSchema };
