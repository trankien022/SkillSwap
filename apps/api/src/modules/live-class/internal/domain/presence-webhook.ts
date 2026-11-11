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

export const PRESENCE_EVENT_TYPES = ['participant-joined', 'participant-left', 'room-destroyed'] as const;
export type PresenceEventType = (typeof PRESENCE_EVENT_TYPES)[number];

/** The prefix every room this application issues begins with (ADR-020). */
const ROOM_PREFIX = roomName('');

/**
 * The class a room belongs to, or null when the name is not one this app issued.
 *
 * JaaS reports the fully-qualified room (`<appId>/skillswap-<classId>`), so a leading tenant
 * segment is tolerated and stripped. The prefix check still runs on what remains, which keeps
 * "not a room we issued" a no-op rather than an error (ADR-039 decision 5).
 */
export function classIdFromRoom(room: string | null | undefined): string | null {
  if (typeof room !== 'string') {
    return null;
  }
  // JaaS reports `<tenant>/<room>`; the class id is always the last segment. Taking the last
  // segment (rather than trimming a known prefix) keeps this independent of the tenant name,
  // which is configuration.
  const segments = room.split('/').filter((segment) => segment.length > 0);
  const local = segments[segments.length - 1] ?? '';
  if (!local.startsWith(ROOM_PREFIX)) {
    return null;
  }
  const classId = local.slice(ROOM_PREFIX.length);
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
 *
 * This is the **join** rule. A join must be a party, because creating presence is what lets
 * an outsider hold a room open — or be its last departure and complete the class. Departures
 * are the mirror image and are handled by `interpretPresenceDeparture`: refusing a departure
 * does not protect anything the write does not already protect, and it records a fiction.
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

/**
 * Maps a **departure** to a presence write (ADR-021 Amendment D.2).
 *
 * A leave only has to prove two things: the room is one we issued and the class it names
 * exists, and the occupant has an identity. Party membership is deliberately **not** required.
 *
 * The failure that forced this: presence resolved parties from `confirmed` bookings, so a
 * learner whose booking was cancelled mid-class stopped being a party. Their
 * `PARTICIPANT_LEFT` was refused, their session row kept `left_at IS NULL`, and the room
 * looked permanently occupied — `room_idle` could never fire again, so the class could only
 * end at its scheduled time.
 *
 * Dropping the check is safe rather than merely convenient: the write is keyed on
 * `(classId, accountId)`, so a departure can only ever close the departing account's own open
 * session. A stranger closes nothing, which is exactly what the party check achieved for
 * leaves while also suppressing real departures.
 */
export function interpretPresenceDeparture(
  event: PresenceEvent,
  knownClassId: string | null,
): PresenceIntent {
  const classId = classIdFromRoom(event.room);
  if (classId === null || knownClassId === null || knownClassId !== classId) {
    return { accepted: false, reason: 'unknown_room' };
  }
  if (event.occupantId === '') {
    return { accepted: false, reason: 'unknown_party' };
  }
  return {
    accepted: true,
    classId,
    accountId: event.occupantId,
    joinedAt: event.occurredAt,
  };
}

/** A room-level intent names no occupant: `ROOM_DESTROYED` describes the room, not a person. */
export type PresenceRoomIntent =
  | { readonly accepted: true; readonly classId: string }
  | {
      readonly accepted: false;
      readonly reason: 'unknown_room' | 'not_a_party' | 'unknown_party';
    };

/**
 * Maps a `ROOM_DESTROYED` delivery to a room-level presence write (ADR-021 Amendment D.3).
 *
 * The event has **no `data.id`** — it is about the room, not a participant — so it must be
 * routed before anything reads an occupant identity. That is why it was previously discarded:
 * the controller's identity gate refused it before the event type was ever consulted.
 *
 * The only check kept is that the room is one we issued and the class exists.
 */
export function interpretRoomDestroyed(
  room: string | null | undefined,
  knownClassId: string | null,
): PresenceRoomIntent {
  const classId = classIdFromRoom(room);
  if (classId === null || knownClassId === null || knownClassId !== classId) {
    return { accepted: false, reason: 'unknown_room' };
  }
  return { accepted: true, classId };
}
