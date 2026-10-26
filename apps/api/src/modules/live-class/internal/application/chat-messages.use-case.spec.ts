import { ChatAccessDeniedError } from '../domain/chat';
import type { Clock } from './port/out/clock';
import type {
  ChatCursorParts,
  ChatRepository,
  ListMessagesCriteria,
  ListMessagesResult,
  NewChatMessage,
} from './port/out/chat-repository';
import { GetChatMessagesUseCase } from './get-chat-messages.use-case';
import { PostChatMessageUseCase } from './post-chat-message.use-case';
import { BookingNotFoundError } from './request-room-access.use-case';
import {
  InMemoryBookingRepository,
  InMemoryClassRepository,
  classView,
  makeBooking,
} from './testing/live-class-fakes';

const CLASS_ID = 'cls-1';
const LEARNER = 'learner-1';
const TEACHER = 'teacher-1';
const STRANGER = 'stranger-1';
const STARTS_AT = new Date('2026-10-11T00:00:00.000Z');

class RecordingChatRepository implements ChatRepository {
  readonly appended: NewChatMessage[] = [];
  readonly listCalls: ListMessagesCriteria[] = [];
  nextPage: ListMessagesResult = { items: [], nextCursor: null, total: 0 };

  async append(message: NewChatMessage) {
    this.appended.push(message);
    return {
      id: 'msg-1',
      classId: message.classId,
      bookingId: message.bookingId,
      senderId: message.senderId,
      senderRole: message.senderRole,
      body: message.body,
      createdAt: '2026-10-11T00:00:00.000Z',
    };
  }

  async list(criteria: ListMessagesCriteria): Promise<ListMessagesResult> {
    this.listCalls.push(criteria);
    return this.nextPage;
  }
}

function setup(options: { state?: 'pending' | 'confirmed' | 'completed' | 'cancelled'; now?: Date } = {}) {
  const bookings = new InMemoryBookingRepository([
    makeBooking({ id: 'b1', classId: CLASS_ID, learnerId: LEARNER, state: options.state ?? 'confirmed' }),
  ]);
  const classes = new InMemoryClassRepository(
    classView({ id: CLASS_ID, teacherId: TEACHER, startsAt: STARTS_AT, durationMinutes: 60 }),
  );
  const chat = new RecordingChatRepository();
  const clock: Clock = { now: () => options.now ?? STARTS_AT };
  const post = new PostChatMessageUseCase(bookings, classes, chat, clock, 15);
  const get = new GetChatMessagesUseCase(bookings, classes, chat, clock, 15);
  return { bookings, classes, chat, post, get };
}

function denial(run: () => Promise<unknown>): Promise<string | null> {
  return run().then(
    () => null,
    (error: unknown) => {
      if (error instanceof ChatAccessDeniedError) return error.reason;
      throw error;
    },
  );
}

describe('PostChatMessageUseCase (FR-012)', () => {
  it('stores a message from the learner with the role the booking gives them', async () => {
    const { chat, post } = setup();

    const result = await post.execute({
      bookingId: 'b1',
      senderId: LEARNER,
      input: { body: 'Bài 3, trang 45' },
    });

    expect(result.senderRole).toBe('learner');
    expect(chat.appended).toEqual([
      {
        bookingId: 'b1',
        classId: CLASS_ID,
        senderId: LEARNER,
        senderRole: 'learner',
        body: 'Bài 3, trang 45',
      },
    ]);
  });

  it('labels the teacher as the teacher, not as the learner', async () => {
    const { chat, post } = setup();
    const result = await post.execute({ bookingId: 'b1', senderId: TEACHER, input: { body: 'ok' } });
    expect(result.senderRole).toBe('teacher');
    expect(chat.appended[0]?.senderRole).toBe('teacher');
  });

  it('writes nothing when a stranger sends', async () => {
    const { chat, post } = setup();
    expect(await denial(() => post.execute({ bookingId: 'b1', senderId: STRANGER, input: { body: 'hi' } }))).toBe(
      'not_a_party',
    );
    expect(chat.appended).toEqual([]);
  });

  it('writes nothing outside the window', async () => {
    const { chat, post } = setup({ now: new Date(STARTS_AT.getTime() + 61 * 60 * 1000) });
    expect(await denial(() => post.execute({ bookingId: 'b1', senderId: LEARNER, input: { body: 'hi' } }))).toBe(
      'window_closed',
    );
    expect(chat.appended).toEqual([]);
  });

  it('writes nothing for a pending booking', async () => {
    const { chat, post } = setup({ state: 'pending' });
    expect(await denial(() => post.execute({ bookingId: 'b1', senderId: LEARNER, input: { body: 'hi' } }))).toBe(
      'booking_not_confirmed',
    );
    expect(chat.appended).toEqual([]);
  });

  it('answers not-found for a booking that does not exist', async () => {
    const { chat, post } = setup();
    await expect(post.execute({ bookingId: 'nope', senderId: LEARNER, input: { body: 'hi' } })).rejects.toBeInstanceOf(
      BookingNotFoundError,
    );
    expect(chat.appended).toEqual([]);
  });
});

describe('GetChatMessagesUseCase (FR-012)', () => {
  it('reads the class conversation, scoped to the booking class rather than the booking', async () => {
    const { chat, get } = setup();
    const cursor: ChatCursorParts = { createdAt: '2026-10-11T00:00:00.000000Z', id: 'msg-0' };
    await get.execute({ bookingId: 'b1', requesterId: LEARNER, limit: 20, cursor });

    expect(chat.listCalls).toEqual([{ classId: CLASS_ID, limit: 20, cursor }]);
  });

  it('keeps history readable long after the window closed', async () => {
    const { chat, get } = setup({ now: new Date(STARTS_AT.getTime() + 90 * 24 * 60 * 60 * 1000) });
    await expect(get.execute({ bookingId: 'b1', requesterId: LEARNER, limit: 20, cursor: null })).resolves.toBeDefined();
    expect(chat.listCalls).toHaveLength(1);
  });

  it('refuses a stranger without reading anything', async () => {
    const { chat, get } = setup();
    expect(
      await denial(() => get.execute({ bookingId: 'b1', requesterId: STRANGER, limit: 20, cursor: null })),
    ).toBe('not_a_party');
    expect(chat.listCalls).toEqual([]);
  });

  it('refuses a pending booking, which has no conversation', async () => {
    const { chat, get } = setup({ state: 'pending' });
    expect(
      await denial(() => get.execute({ bookingId: 'b1', requesterId: LEARNER, limit: 20, cursor: null })),
    ).toBe('booking_not_confirmed');
    expect(chat.listCalls).toEqual([]);
  });
});
