import {
  interpretPresenceDeparture,
  interpretPresenceEvent,
  interpretRoomDestroyed,
  type PresenceEvent,
} from '../domain/presence-webhook';
import type {
  RecordPresenceCommand,
  RecordPresencePort,
  RecordPresenceResult,
} from './port/in/record-presence';
import type { BookingRepository } from './port/out/booking-repository';
import type { ClassRepository } from './port/out/class-repository';
import type { PresenceRepository } from './port/out/presence-repository';

/**
 * FR-011 / FR-020 (AC-035): applies a Jitsi participant webhook to `class_presence`.
 *
 * The decision about *whether* an event may affect a class lives in the domain
 * (`interpretPresenceEvent` / `interpretPresenceDeparture`); this class only supplies the
 * parties and performs the write. Every rejection is reported as an outcome rather than
 * thrown, because a webhook must be acknowledged: an error response makes Jitsi retry an
 * event that will never become valid.
 *
 * The refusals are the defence against a stranger whose guessed room name would otherwise be
 * able to keep a class looking occupied.
 *
 * Joins and departures are resolved differently on purpose (ADR-021 Amendment D.2). A join is
 * checked against the parties because creating presence is the act that can hold a room open.
 * A departure is not, because the write is keyed on `(classId, accountId)` and can only close
 * the departee's own session — requiring party membership there silently dropped real
 * departures, leaving rooms permanently "occupied" once a booking changed state.
 */
export class RecordPresenceUseCase implements RecordPresencePort {
  constructor(
    private readonly classes: ClassRepository,
    private readonly bookings: BookingRepository,
    private readonly presence: PresenceRepository,
  ) {}

  async execute(command: RecordPresenceCommand): Promise<RecordPresenceResult> {
    const classView = await this.classes.findById(command.classId);

    // ROOM_DESTROYED first: it carries no occupant, so it must not reach any path that reads
    // one (ADR-021 Amendment D.3). Recovery only — closing rows is reversible, completing a
    // class is not, and JaaS emits this on a temporary disconnect too.
    if (command.type === 'room-destroyed') {
      const intent = interpretRoomDestroyed(command.room, classView === null ? null : classView.id);
      if (!intent.accepted) {
        return { accepted: false, reason: intent.reason };
      }
      await this.presence.closeOpenSessions(intent.classId, command.occurredAt);
      return { accepted: true };
    }

    const event: PresenceEvent = {
      type: command.type,
      room: command.room,
      occupantId: command.accountId,
      occurredAt: command.occurredAt,
    };

    const intent =
      command.type === 'participant-left'
        ? interpretPresenceDeparture(event, classView === null ? null : classView.id)
        : interpretPresenceEvent(
            event,
            classView === null
              ? null
              : {
                  classId: classView.id,
                  teacherId: classView.teacherId,
                  learnerIds: await this.confirmedLearnerIds(command.classId),
                },
          );

    if (!intent.accepted) {
      return { accepted: false, reason: intent.reason };
    }

    const record = {
      classId: intent.classId,
      accountId: intent.accountId,
      joinedAt: intent.joinedAt,
    };
    if (command.type === 'participant-joined') {
      await this.presence.recordJoin(record);
    } else {
      await this.presence.recordLeave(record);
    }
    return { accepted: true };
  }

  private async confirmedLearnerIds(classId: string): Promise<string[]> {
    return (await this.bookings.findActiveByClass(classId))
      .filter((booking) => booking.state === 'confirmed')
      .map((booking) => booking.learnerId);
  }
}
