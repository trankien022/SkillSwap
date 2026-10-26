import type { PresenceSession } from '../../../domain/presence';

export const PRESENCE_REPOSITORY = Symbol('PRESENCE_REPOSITORY');

/** One Jitsi participant-joined / participant-left observation. */
export interface PresenceRecord {
  classId: string;
  accountId: string;
  /** When the participant joined, per the webhook. */
  joinedAt: Date;
}

/**
 * FR-007 / AC-024: where the Jitsi feed records presence.
 *
 * `leftAt === null` means "still present", so a joiner leaves a row with a null
 * `left_at` and a leaver closes it. That shape makes re-joining expressible without
 * a boolean that can drift out of step with the session history.
 */
export interface PresenceRepository {
  /**
   * Records a join. Idempotent per (class, participant): Jitsi may deliver the same
   * event twice, and a duplicate join must not create a second open session.
   */
  recordJoin(record: PresenceRecord): Promise<void>;

  /**
   * Closes the participant's most recent open session. A leave with no matching open
   * session is ignored rather than invented — an unmatched leave would otherwise be
   * evidence of an absence that never happened.
   */
  recordLeave(record: PresenceRecord): Promise<void>;

  /** Every session recorded for the class, oldest first. Empty means unknown. */
  listSessions(classId: string): Promise<PresenceSession[]>;

  /**
   * FR-007 / AC-024: when the Teacher first joined this class's room, or null if they
   * never did. This is the evidence the no-show decision reads — not a caller's claim.
   */
  findTeacherFirstJoin(classId: string, teacherId: string): Promise<Date | null>;
}
