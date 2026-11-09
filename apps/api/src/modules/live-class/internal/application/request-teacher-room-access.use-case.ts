import { randomUUID } from 'node:crypto';
import type { RoomAccessResponse } from '@skillswap/contracts';
import { authorizeTeacherRoomAccess } from '../domain/room-access';
import type {
  RequestTeacherRoomAccessCommand,
  RequestTeacherRoomAccessPort,
} from './port/in/request-teacher-room-access';
import type { ClassRepository } from './port/out/class-repository';
import type { Clock } from './port/out/clock';
import type { RoomIncidentRecorder } from './port/out/room-incident-recorder';
import {
  RoomProviderUnavailableError,
  type RoomTokenIssuer,
} from './port/out/room-token-issuer';

export class TeacherClassNotFoundError extends Error {
  constructor(classId: string) {
    super(`Class not found: ${classId}`);
    this.name = 'TeacherClassNotFoundError';
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
 * FR-011 / ADR-040: authorizes a **teacher** to open their class room and returns a
 * short-lived Jitsi token with the `moderator` role.
 *
 * Structurally parallel to `RequestRoomAccessUseCase`, and deliberately so — but it reads
 * the class directly instead of going through a booking, because the teacher has no booking
 * for the class they teach. Provider failures are recorded as an incident and surfaced as
 * `RoomUnavailableError` (NFR-006/NFR-009), exactly as on the learner path.
 */
export class RequestTeacherRoomAccessUseCase implements RequestTeacherRoomAccessPort {
  constructor(
    private readonly classes: ClassRepository,
    private readonly tokens: RoomTokenIssuer,
    private readonly incidents: RoomIncidentRecorder,
    private readonly clock: Clock,
    private readonly jitsiDomain: string,
    private readonly openMinutes: number,
  ) {}

  async execute(command: RequestTeacherRoomAccessCommand): Promise<RoomAccessResponse> {
    const classView = await this.classes.findById(command.classId);
    if (classView === null) {
      throw new TeacherClassNotFoundError(command.classId);
    }

    // Throws RoomAccessDeniedError (403) for a non-owner / non-joinable state / closed window.
    const grant = authorizeTeacherRoomAccess({
      classView: {
        id: classView.id,
        state: classView.state,
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
        room: grant.room,
        token: issued.token,
        expiresAt: issued.expiresAt,
        url: `https://${this.jitsiDomain}/${grant.room}`,
      };
    } catch (error) {
      if (error instanceof RoomProviderUnavailableError) {
        const traceId = randomUUID();
        await this.incidents.record({
          // There is no booking on the teacher path; the class is the incident's subject.
          bookingId: classView.id,
          classId: classView.id,
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
