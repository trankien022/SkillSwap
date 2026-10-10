import type { RoomAccessResponse } from '@skillswap/contracts';

export const REQUEST_ROOM_ACCESS = Symbol('REQUEST_ROOM_ACCESS');

export interface RequestRoomAccessCommand {
  bookingId: string;
  requesterId: string;
  displayName?: string;
}

export interface RequestRoomAccessPort {
  execute(command: RequestRoomAccessCommand): Promise<RoomAccessResponse>;
}
