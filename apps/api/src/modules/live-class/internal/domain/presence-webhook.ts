/**
 * FR-011 / FR-020 (AC-035, W1 C3b): turning a Jitsi webhook into presence.
 *
 * ## Why this is not just "trust the payload"
 *
 * The webhook is an inbound, unauthenticated-by-content message from a service that
 * sits behind an opaque proxy. Two things could go wrong if the payload were taken at
 * face value:
 *
 * 1. **A stranger enters an empty room** whose name they guessed or were shown, and the
 *    class stays "occupied" forever — or, worse, their departure becomes the last leave
 *    that completes a class and releases money.
 * 2. **A payload names a room the application never created**, and presence rows accrue
 *    against a class that does not exist.
 *
 * So an event is accepted only when it names a room of the form
 * `skillswap-<classId>` **and** an occupant who is actually a party to that class. The
 * room name is derived by the same function that issues access (`roomName`), so there is
 * one definition rather than two that can drift.
 *
 * Whoever is not a party is ignored, not rejected: Jitsi emits join/leave for
 * everyone in a room (including moderators' bots and any stray authenticated user),
 * and a webhook that returns an error is a webhook that gets retried forever.
 *
 * Pure domain — no framework, no persistence (ADR-009).
 */

import { roomName } from './room-access';

export const PRESENCE_EVENT_TYPES = ['participant-joined', 'participant-left'] as const;
export type PresenceEventType = (typeof PRESENCE_EVENT_TYPES)[number];

/** The prefix every room this application issues begins with (ADR-020). */
const ROOM_PREFIX = roomName('');

/** The class a room belongs to, or null when the name is not one this app issued. */
export function classIdFromRoom(room: string | null | undefined): string | null {
  if (typeof room !== 'string' || !room.startsWith(ROOM_PREFIX)) {
    return null;
  }
  const classId = room.slice(ROOM_PREFIX.length);
  return classId === '' ? null : classId;
}

export interface PresenceParties {
  readonly classId: string;
  readonly teacherId: string;
  /** Learners holding a live booking for this class. */
  readonly learnerIds: readonly string[];
}

export interface PresenceEvent {
  readonly type: PresenceEventType;
  readonly room: string;
  /** Jitsi's stable occupant identity: the `context.user.id` claim of the issued token. */
  readonly occupantId: string;
  readonly occurredAt: Date;
}

export type PresenceIntent =
  | {
      readonly accepted: true;
      readonly classId: string;
      readonly accountId: string;
      readonly joinedAt: Date;
    }
  | {
      readonly accepted: false;
      readonly reason: 'unknown_room' | 'not_a_party' | 'unknown_party';
    };

/**
 * Maps a webhook to a presence write, or explains why it affects nothing.
 *
 * `parties` is null when no class matches the room — which is exactly what a guessed
 * room name produces, and it must be a no-op rather than an error.
 */
export function interpretPresenceEvent(
  event: PresenceEvent,
  parties: PresenceParties | null,
): PresenceIntent {
  const classId = classIdFromRoom(event.room);
  if (classId === null || parties === null || parties.classId !== classId) {
    return { accepted: false, reason: 'unknown_room' };
  }
  if (event.occupantId === '') {
    return { accepted: false, reason: 'unknown_party' };
  }
  const isTeacher = event.occupantId === parties.teacherId;
  const isLearner = parties.learnerIds.includes(event.occupantId);
  if (!isTeacher && !isLearner) {
    return { accepted: false, reason: 'not_a_party' };
  }
  return {
    accepted: true,
    classId,
    accountId: event.occupantId,
    joinedAt: event.occurredAt,
  };
}
