import { assertCanRead } from '../domain/chat';
import type { BookingRepository } from './port/out/booking-repository';
import type { ChatRepository } from './port/out/chat-repository';
import type { ClassRepository } from './port/out/class-repository';
import type { Clock } from './port/out/clock';
import type {
  GetChatMessagesCommand,
  GetChatMessagesPort,
  GetChatMessagesResult,
} from './port/in/chat-messages';
import { BookingNotFoundError } from './request-room-access.use-case';

/**
 * FR-012: read a booking's chat, owner-scoped and keyset-paginated (NFR-014).
 *
 * `assertCanRead`, not `assertCanSend`: history stays readable after the window closes
 * (ADR-036 decision 3), so this path deliberately does not consult the clock for the window.
 * It still partitions by class id rather than booking id, because that is the conversation the
 * table stores -- both parties of a class see one thread.
 */
export class GetChatMessagesUseCase implements GetChatMessagesPort {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly classes: ClassRepository,
    private readonly chat: ChatRepository,
    private readonly clock: Clock,
    private readonly openMinutes: number,
  ) {}

  async execute(command: GetChatMessagesCommand): Promise<GetChatMessagesResult> {
    const booking = await this.bookings.findById(command.bookingId);
    if (booking === null) {
      throw new BookingNotFoundError(command.bookingId);
    }
    const classView = await this.classes.findById(booking.classId);
    if (classView === null) {
      throw new BookingNotFoundError(command.bookingId);
    }

    assertCanRead({
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

    return this.chat.list({
      classId: booking.classId,
      limit: command.limit,
      cursor: command.cursor,
    });
  }
}
