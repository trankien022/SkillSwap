/**
 * FR-011 / ADR-040: when may a teacher open their class room?
 *
 * This is the web mirror of `authorizeTeacherRoomAccess` in
 * `apps/api/src/modules/live-class/internal/domain/room-access.ts`. It exists so the studio
 * can gate the Join button honestly instead of letting the teacher click and collect a 403.
 *
 * The server remains the authority — this only decides what to *show*. The two must agree on
 * the window (opens 15 minutes before the start, closes at the scheduled end) and on the
 * class states; a drift shows up as a button that is enabled and then refused, which is why
 * the states and the lead time are stated once here and pinned by tests.
 */

export const TEACHER_OPEN_MINUTES = 15;

/** Class states from which the teacher may open the room (ADR-040 decision 3). */
const TEACHER_JOINABLE_STATES = new Set(['published', 'full', 'in_progress']);

export type TeacherJoinState =
  /** Inside the window and in a joinable state: the room can be entered now. */
  | 'open'
  /** Joinable class, but the window has not opened yet. */
  | 'too_early'
  /** Joinable class, window already closed. */
  | 'closed'
  /** draft / completed / cancelled — never joinable, whatever the clock says. */
  | 'not_joinable';

export interface TeacherJoinability {
  state: TeacherJoinState;
  opensAt: Date;
  closesAt: Date;
}

export function teacherJoinability(
  item: { startsAt: string; durationMinutes: number; state: string },
  now: Date = new Date(),
): TeacherJoinability {
  const startsAtMs = new Date(item.startsAt).getTime();
  const opensAt = new Date(startsAtMs - TEACHER_OPEN_MINUTES * 60 * 1000);
  const closesAt = new Date(startsAtMs + item.durationMinutes * 60 * 1000);

  if (!TEACHER_JOINABLE_STATES.has(item.state)) {
    return { state: 'not_joinable', opensAt, closesAt };
  }

  const at = now.getTime();
  if (at < opensAt.getTime()) return { state: 'too_early', opensAt, closesAt };
  if (at > closesAt.getTime()) return { state: 'closed', opensAt, closesAt };
  return { state: 'open', opensAt, closesAt };
}

/**
 * A short, locale-free countdown for the button hint. Kept deliberately coarse: the studio
 * polls nothing, so a seconds-precision label would be stale on arrival.
 */
export function minutesUntil(target: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 60000));
}
