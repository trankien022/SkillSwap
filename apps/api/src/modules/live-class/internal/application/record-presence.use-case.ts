import { interpretPresenceEvent, type PresenceEvent } from '../domain/presence-webhook';
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
 * (`interpretPresenceEvent`); this class only supplies the parties and performs the
 * write. Every rejection is reported as an outcome rather than thrown, because a
 * webhook must be acknowledged: an error response makes Jitsi retry an event that will
 * never become valid.
 *
 * The refusals are the defence against a stranger whose guessed room name would
 * otherwise be able to keep a class looking occupied — or, on leaving, be the last
 * departure that completes it and releases money.
 */
export class RecordPresenceUseCase implements RecordPresencePort {
  constructor(
    private readonly classes: ClassRepository,
    private readonly bookings: BookingRepository,
    private readonly presence: PresenceRepository,
  ) {}

  async execute(command: RecordPresenceCommand): Promise<RecordPresenceResult> {
    const classView = await this.classes.findById(command.classId);
    const learnerIds =
      classView === null
        ? []
        : (await this.bookings.findActiveByClass(command.classId))
            .filter((booking) => booking.state === 'confirmed')
            .map((booking) => booking.learnerId);

    const event: PresenceEvent = {
      type: command.type,
      room: command.room,
      occupantId: command.accountId,
      occurredAt: command.occurredAt,
    };
    const intent = interpretPresenceEvent(
      event,
      classView === null
        ? null
        : { classId: classView.id, teacherId: classView.teacherId, learnerIds },
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
}
