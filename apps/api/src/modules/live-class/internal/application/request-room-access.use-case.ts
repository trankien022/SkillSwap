import { randomUUID } from 'node:crypto';
import type { RoomAccessResponse } from '@skillswap/contracts';
import { authorizeRoomAccess, roomName } from '../domain/room-access';
import type {
  RequestRoomAccessCommand,
  RequestRoomAccessPort,
} from './port/in/request-room-access';
import type { BookingRepository } from './port/out/booking-repository';
import type { ClassRepository } from './port/out/class-repository';
import type { Clock } from './port/out/clock';
import type { RoomIncidentRecorder } from './port/out/room-incident-recorder';
import {
  RoomProviderUnavailableError,
  type RoomTokenIssuer,
} from './port/out/room-token-issuer';

export class BookingNotFoundError extends Error {
  constructor(bookingId: string) {
    super(`Booking not found: ${bookingId}`);
    this.name = 'BookingNotFoundError';
  }
}

export class RoomUnavailableError extends Error {
  constructor(
    readonly traceId: string,
    message: string,
  ) {
    super(message);
    this.name = 'RoomUnavailableError';
  }
}

/**
 * FR-011 / API-008 (ADR-020): authorizes a party to join the class room and
 * returns a short-lived Jitsi token. Provider failures are recorded as an
 * incident and surfaced as `RoomUnavailableError` (NFR-006/NFR-009).
 */
export class RequestRoomAccessUseCase implements RequestRoomAccessPort {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly classes: ClassRepository,
    private readonly tokens: RoomTokenIssuer,
    private readonly incidents: RoomIncidentRecorder,
    private readonly clock: Clock,
    private readonly jitsiDomain: string,
    private readonly openMinutes: number,
  ) {}

  async execute(command: RequestRoomAccessCommand): Promise<RoomAccessResponse> {
    const booking = await this.bookings.findById(command.bookingId);
    if (booking === null) {
      throw new BookingNotFoundError(command.bookingId);
    }
    const classView = await this.classes.findById(booking.classId);
    if (classView === null) {
      throw new BookingNotFoundError(command.bookingId);
    }

    // Throws RoomAccessDeniedError (403) for a non-party / closed window.
    const grant = authorizeRoomAccess({
      booking: {
        id: booking.id,
        classId: booking.classId,
        learnerId: booking.learnerId,
        state: booking.state,
      },
      classView: {
        teacherId: classView.teacherId,
        startsAt: classView.startsAt,
        durationMinutes: classView.durationMinutes,
      },
      requesterId: command.requesterId,
      now: this.clock.now(),
      openMinutes: this.openMinutes,
    });

    try {
      const issued = this.tokens.issue({
        room: grant.room,
        userId: command.requesterId,
        displayName: command.displayName ?? command.requesterId,
        role: grant.role,
      });
      return {
        room: roomName(booking.classId),
        token: issued.token,
        expiresAt: issued.expiresAt,
        url: `https://${this.jitsiDomain}/${grant.room}`,
      };
    } catch (error) {
      if (error instanceof RoomProviderUnavailableError) {
        const traceId = randomUUID();
        await this.incidents.record({
          bookingId: booking.id,
          classId: booking.classId,
          requesterId: command.requesterId,
          reason: error.message,
          traceId,
        });
        throw new RoomUnavailableError(traceId, 'Room provider unavailable');
      }
      throw error;
    }
  }
}
