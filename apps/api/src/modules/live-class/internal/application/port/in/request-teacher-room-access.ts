import type { RoomAccessResponse } from '@skillswap/contracts';

export const REQUEST_TEACHER_ROOM_ACCESS = Symbol('REQUEST_TEACHER_ROOM_ACCESS');

/**
 * FR-011 / ADR-040: the teacher opens their class room.
 *
 * `classId`, not `bookingId`: the teacher has no booking for the class they teach.
 * `requesterId` is injected by the adapter from the verified JWT — never read from the
 * body, because a `moderator` grant can end a conference.
 */
export interface RequestTeacherRoomAccessCommand {
  classId: string;
  requesterId: string;
  displayName?: string;
}

export interface RequestTeacherRoomAccessPort {
  execute(command: RequestTeacherRoomAccessCommand): Promise<RoomAccessResponse>;
}
