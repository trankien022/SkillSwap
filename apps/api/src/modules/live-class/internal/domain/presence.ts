/**
 * FR-020 / AC-035 (W1 C3a/C3b, decided 2026-10-25): completing a class because the room emptied.
 *
 * ## The rule
 *
 * Once `startsAt` has passed, if **every** participant has left the Jitsi room for
 * `GRACE_MINUTES` continuously, the room is idle and the class may complete with basis
 * `room_idle`. Before `startsAt` the rule is **inert**: a class that has not started has
 * nobody in it, and completing it would release the Teacher's income for a session that never
 * happened.
 *
 * The grace is measured from the later of the departure and `startsAt` (ADR-021
 * Amendment D.1). Measuring from the raw departure was a money defect: the room opens 15
 * minutes early, so a teacher who opened it to test their camera and left before the start
 * had already "been gone" longer than the grace by the time the class began — and the first
 * sweep completed it.
 *
 * ## The three ways this could go wrong, and why it does not
 *
 * 1. **Completing an unstarted class.** Guarded by the `startsAt` floor, checked first.
 * 2. **Completing with somebody still present.** A participant with `leftAt === null` is in the
 *    room; any such participant blocks the rule. A Teacher leaving does not end a class a
 *    learner is still attending.
 * 3. **Completing on missing data.** No presence rows means "unknown", not "empty". This is the
 *    degradation E9 requires: if the Jitsi webhook feed is down, nothing is recorded, and the
 *    class must fall back to `scheduled_end`. Treating silence as absence would make an
 *    infrastructure outage silently end live classes and release money.
 *
 * A participant who re-joined after leaving has a newer row with `leftAt === null`, so
 * re-joining correctly un-idles the room. That is why presence is a set of sessions rather than
 * a per-account boolean.
 *
 * Pure domain — no framework, no clock, no persistence (ADR-009).
 */

/**
 * The default grace, and the value W1 C3b decided. Deployments override it with
 * `ROOM_IDLE_GRACE_MINUTES`; this stays the fallback for callers that do not pass one.
 */
export const ROOM_IDLE_GRACE_MINUTES = 5;

/** One participation session: joined at, and left at (null while still present). */
export interface PresenceSession {
  readonly accountId: string;
  readonly joinedAt: Date;
  readonly leftAt: Date | null;
}

export interface RoomIdleInput {
  readonly startsAt: Date;
  readonly now: Date;
  /** Every session recorded for the class. Empty means unknown, never "empty room". */
  readonly sessions: readonly PresenceSession[];
  readonly graceMinutes?: number;
}

export type RoomIdleEvaluation =
  /** The class has not started: the rule does not apply at all. */
  | { readonly idle: false; readonly reason: 'not_started' }
  /** Nobody was ever recorded: presence is unknown, so early completion is not allowed. */
  | { readonly idle: false; readonly reason: 'presence_unknown' }
  /** At least one participant is still in the room. */
  | { readonly idle: false; readonly reason: 'occupied' }
  /** Everyone left, but not long enough ago yet. */
  | { readonly idle: false; readonly reason: 'within_grace' }
  /** Everyone left at least the grace period ago. */
  | { readonly idle: true; readonly reason: 'idle' };

/**
 * Evaluates the idle rule.
 *
 * Returns the reason as well as the verdict: a sweeper that only asks "is it idle?" cannot
 * explain why a class did not complete, and the absence of that answer is what makes an
 * early-completion bug invisible in production.
 */
export function evaluateRoomIdle(input: RoomIdleInput): RoomIdleEvaluation {
  const graceMinutes = input.graceMinutes ?? ROOM_IDLE_GRACE_MINUTES;
  // Zero is legal (close as soon as the room empties) and is why this is not `||`. A
  // negative or non-finite value is refused rather than clamped: `now - latestLeft < NaN` is
  // false, so a typo would read as "idle long ago" and complete a live class. Config rejects
  // these at boot, so reaching here means a caller passed one directly.
  if (!Number.isFinite(graceMinutes) || graceMinutes < 0) {
    throw new Error(`Invalid room-idle grace: ${String(graceMinutes)} minutes`);
  }
  const graceMs = graceMinutes * 60 * 1000;

  // 1. Never before the class starts (C3a).
  if (input.now.getTime() < input.startsAt.getTime()) {
    return { idle: false, reason: 'not_started' };
  }

  // 2. No rows means unknown. This is the degradation path, not an edge case: a webhook
  //    outage produces exactly this, and must never complete a class early (E9).
  if (input.sessions.length === 0) {
    return { idle: false, reason: 'presence_unknown' };
  }

  // 3. Any participant still present blocks the rule.
  const departures: Date[] = [];
  for (const session of input.sessions) {
    if (session.leftAt === null) {
      return { idle: false, reason: 'occupied' };
    }
    departures.push(session.leftAt);
  }

  // 4. Everyone has left; is it long enough ago?
  //
  // ADR-021 Amendment D.1: the clock starts when the class does. The room opens
  // `JITSI_OPEN_MINUTES` early, so a session may have joined and left entirely before
  // `startsAt` — a teacher testing their camera. Measuring from that departure would let the
  // first sweep after the start see "everyone gone for 10 minutes" and complete a class that
  // never ran, releasing the teacher's income for it. Clamping each departure up to
  // `startsAt` keeps the honest case intact: somebody who leaves at +12 still starts the
  // clock at +12.
  //
  // `departures` is non-empty: gate 2 rejected an empty session list, and every entry above
  // contributed one, so the spread below is never `Math.max()` on nothing (`-Infinity`).
  const startsAtMs = input.startsAt.getTime();
  const latestLeft = Math.max(...departures.map((leftAt) => Math.max(leftAt.getTime(), startsAtMs)));
  if (input.now.getTime() - latestLeft < graceMs) {
    return { idle: false, reason: 'within_grace' };
  }

  return { idle: true, reason: 'idle' };
}

/** The verdict alone, for callers that only branch on it. */
export function isRoomIdle(input: RoomIdleInput): boolean {
  return evaluateRoomIdle(input).idle;
}
