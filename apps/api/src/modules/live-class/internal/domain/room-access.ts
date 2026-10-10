/**
 * FR-011 room access (ADR-020).
 *
 * Decides whether a requester may enter the Jitsi room of a booking: they must
 * be one of the two parties, the booking must be in a joinable state, and the
 * request must fall inside the access window around the class. Pure domain —
 * no framework, no persistence (ADR-009).
 */

import type { BookingState } from './booking';

export const DEFAULT_OPEN_MINUTES = 15;

export const ROOM_ACCESS_DENIALS = [
  'not_a_party',
  'booking_not_confirmed',
  'window_not_open',
  'window_closed',
] as const;
export type RoomAccessDenial = (typeof ROOM_ACCESS_DENIALS)[number];

/** Booking states in which a room may be joined (FR-020 adds `in_progress`). */
export const JOINABLE_BOOKING_STATES: readonly BookingState[] = ['confirmed'];

export class RoomAccessDeniedError extends Error {
  constructor(readonly reason: RoomAccessDenial, message: string) {
    super(message);
    this.name = 'RoomAccessDeniedError';
  }
}

export interface RoomAccessBooking {
  id: string;
  classId: string;
  learnerId: string;
  state: BookingState;
}

export interface RoomAccessClass {
  teacherId: string;
  startsAt: Date;
  durationMinutes: number;
}

export interface RoomAccessRequest {
  booking: RoomAccessBooking;
  classView: RoomAccessClass;
  requesterId: string;
  now: Date;
  openMinutes?: number;
}

export interface RoomAccessGrant {
  room: string;
  role: 'moderator' | 'participant';
}

/** Deterministic, non-PII room name derived from the class id (ADR-020). */
export function roomName(classId: string): string {
  return `skillswap-${classId}`;
}

function windowBounds(
  classView: RoomAccessClass,
  openMinutes: number,
): { opensAt: number; closesAt: number } {
  const startsAt = classView.startsAt.getTime();
  return {
    opensAt: startsAt - openMinutes * 60 * 1000,
    closesAt: startsAt + classView.durationMinutes * 60 * 1000,
  };
}

function deny(reason: RoomAccessDenial, message: string): never {
  throw new RoomAccessDeniedError(reason, message);
}

/**
 * Authorizes a room-access request (AC-006). Returns the room name and the
 * requester's Jitsi role, or throws `RoomAccessDeniedError`.
 */
export function authorizeRoomAccess(request: RoomAccessRequest): RoomAccessGrant {
  const { booking, classView, requesterId, now } = request;
  const isLearner = requesterId === booking.learnerId;
  const isTeacher = requesterId === classView.teacherId;
  if (!isLearner && !isTeacher) {
    deny('not_a_party', 'Requester is not a party to this booking');
  }
  if (!JOINABLE_BOOKING_STATES.includes(booking.state)) {
    deny('booking_not_confirmed', `Booking is ${booking.state}, not joinable`);
  }

  const { opensAt, closesAt } = windowBounds(classView, request.openMinutes ?? DEFAULT_OPEN_MINUTES);
  const at = now.getTime();
  if (at < opensAt) {
    deny('window_not_open', 'Room access opens shortly before the class starts');
  }
  if (at > closesAt) {
    deny('window_closed', 'Room access has closed for this class');
  }

  return { room: roomName(booking.classId), role: isTeacher ? 'moderator' : 'participant' };
}
