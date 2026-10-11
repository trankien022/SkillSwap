import {
  buildDemoDraft,
  demoVerifiedSkills,
  priceIsValid,
  capacityIsValid,
  isAllowedDuration,
  titleOver,
} from './mock-data';
import {
  ALLOWED_DURATIONS,
  type ClassDraft,
  type PublishResult,
  type VerifiedSkill,
} from './types';

/**
 * Mock gateway for the "publish a class" form (FR-022).
 *
 * Pure in-memory. The pilot has no auth: `publishDraft` returns a
 * synthetic classId/classroomCode. When the real
 * `HttpTeacherPublishGateway` lands, only the page instantiation
 * changes.
 */
export class MockTeacherPublishGateway {
  private draft: ClassDraft;

  constructor(initial: ClassDraft = buildDemoDraft()) {
    this.draft = { ...initial };
  }

  async getVerifiedSkills(): Promise<VerifiedSkill[]> {
    return [...demoVerifiedSkills];
  }

  async getDraft(): Promise<ClassDraft> {
    return { ...this.draft };
  }

  /** Replace the draft. Validates required fields; throws if the
   * price/capacity/duration/title invariants are broken. The
   * caller (the form) is expected to clamp first via
   * `clampPrice` / `clampCapacity`. */
  async saveDraft(next: ClassDraft): Promise<ClassDraft> {
    this.assertValid(next);
    this.draft = { ...next };
    return { ...this.draft };
  }

  /** Publish the draft to the marketplace. Returns a synthetic
   * class id + classroom code. The draft is considered locked
   * from this point on (BR-016: any first booking freezes
   * schedule & content edits). */
  async publishDraft(next: ClassDraft): Promise<PublishResult> {
    this.assertValid(next);
    this.draft = { ...next };
    return {
      classId: `cls-demo-${Date.now().toString(36).slice(-6)}`,
      publishedAt: new Date().toISOString(),
      classroomCode: `SSW-${Date.now().toString(36).slice(-4).toUpperCase()}-${Math.floor(
        Math.random() * 9000 + 1000,
      )}`,
    };
  }

  /** True when the form has the minimum it needs to publish. */
  async canPublish(draft: ClassDraft): Promise<boolean> {
    return this.validate(draft) === null;
  }

  /* --- Private validators --- */

  private assertValid(draft: ClassDraft): void {
    const err = this.validate(draft);
    if (err) throw new Error(`Invalid draft: ${err}`);
  }

  private validate(draft: ClassDraft): string | null {
    if (!demoVerifiedSkills.some((s) => s.id === draft.skillId)) {
      return 'skill is not in the verified set';
    }
    if (!draft.title.trim()) return 'title is required';
    if (titleOver(draft.title)) return 'title exceeds 100 chars';
    if (!draft.description.trim()) return 'description is required';
    if (!isAllowedDuration(draft.durationMinutes))
      return `duration must be one of ${ALLOWED_DURATIONS.join(', ')}`;
    if (!draft.startsOn) return 'startsOn is required';
    if (!/^\d{2}:\d{2}$/.test(draft.startsAt)) return 'startsAt is required';
    if (!priceIsValid(draft.priceCredits)) return 'price out of range';
    if (!capacityIsValid(draft.capacity)) return 'capacity out of range';
    return null;
  }
}
