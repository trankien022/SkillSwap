import { assertCanSend } from '../domain/chat';
import type { BookingRepository } from './port/out/booking-repository';
import type { ChatRepository } from './port/out/chat-repository';
import type { ClassRepository } from './port/out/class-repository';
import type { Clock } from './port/out/clock';
import type {
  PostChatMessageCommand,
  PostChatMessagePort,
  PostChatMessageResult,
} from './port/in/chat-messages';
import { BookingNotFoundError } from './request-room-access.use-case';

/**
 * FR-012: append one message to a booking's chat.
 *
 * Authorisation happens **before** anything is written, so a refused send leaves no row
 * (ADR-036 C4). The booking and class are read here to resolve the sender's role and the window;
 * neither is trusted from the request.
 *
 * A missing booking is a 404, not a 403: telling a caller "not a party" about a booking that does
 * not exist is a lie, and answering 404 for one that *does* exist but is someone else's would leak
 * its existence -- which is why the party check still runs after the lookup succeeds.
 *
 * There is no push event and no outbox write: ADR-036 recorded that messaging must not become a
 * notification firehose, and no `chat.message.posted` handler is registered.
 */
export class PostChatMessageUseCase implements PostChatMessagePort {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly classes: ClassRepository,
    private readonly chat: ChatRepository,
    private readonly clock: Clock,
    private readonly openMinutes: number,
  ) {}

  async execute(command: PostChatMessageCommand): Promise<PostChatMessageResult> {
    const booking = await this.bookings.findById(command.bookingId);
    if (booking === null) {
      throw new BookingNotFoundError(command.bookingId);
    }
    const classView = await this.classes.findById(booking.classId);
    if (classView === null) {
      throw new BookingNotFoundError(command.bookingId);
    }

    // Throws ChatAccessDeniedError before any write.
    const senderRole = assertCanSend({
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
      requesterId: command.senderId,
      now: this.clock.now(),
      openMinutes: this.openMinutes,
    });

    const message = await this.chat.append({
      bookingId: booking.id,
      classId: booking.classId,
      senderId: command.senderId,
      senderRole,
      body: command.input.body,
    });

    return { message, senderRole };
  }
}
