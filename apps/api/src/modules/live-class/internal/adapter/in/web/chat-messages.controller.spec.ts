import { ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ChatAccessDeniedError } from '../../../domain/chat';
import { BookingNotFoundError } from '../../../application/request-room-access.use-case';
import type { GetChatMessagesPort, PostChatMessagePort } from '../../../application/port/in/chat-messages';
import { ChatMessagesController } from './chat-messages.controller';

const CALLER = '7c1e0000-0000-4000-8000-0000000000cc';
const CLASS_ID = '7c1e0000-0000-4000-8000-0000000000aa';
const BOOKING_ID = '7c1e0000-0000-4000-8000-0000000000bb';

function request(userId: string | undefined = CALLER) {
  return { headers: {}, user: userId === undefined ? undefined : { id: userId } } as never;
}

const MESSAGE = {
  id: '7c1e0000-0000-4000-8000-000000000011',
  classId: CLASS_ID,
  bookingId: BOOKING_ID,
  senderId: CALLER,
  senderRole: 'learner' as const,
  body: 'xin chào',
  createdAt: '2026-10-26T10:00:00.000Z',
};

function setup() {
  const postExecute = jest.fn().mockResolvedValue({ message: MESSAGE, senderRole: 'learner' });
  const getExecute = jest.fn().mockResolvedValue({ items: [MESSAGE], nextCursor: null, total: 1 });
  const controller = new ChatMessagesController(
    { execute: postExecute } as unknown as PostChatMessagePort,
    { execute: getExecute } as unknown as GetChatMessagesPort,
  );
  return { controller, postExecute, getExecute };
}

describe('ChatMessagesController (FR-012)', () => {
  describe('401', () => {
    it('refuses an anonymous caller on both routes, before calling a use case', async () => {
      const { controller, postExecute, getExecute } = setup();
      await expect(controller.post(BOOKING_ID, { body: 'hi' }, request('anonymous'))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(
        controller.list(BOOKING_ID, {} as never, request('anonymous')),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(postExecute).not.toHaveBeenCalled();
      expect(getExecute).not.toHaveBeenCalled();
    });
  });

  describe('403 vs 404 vs 409', () => {
    it('maps not_a_party to 403', async () => {
      const { controller, postExecute } = setup();
      postExecute.mockRejectedValueOnce(new ChatAccessDeniedError('not_a_party', 'nope'));
      await expect(controller.post(BOOKING_ID, { body: 'hi' }, request())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it.each(['booking_not_confirmed', 'window_not_open', 'window_closed'] as const)(
      'maps %s to 409',
      async (reason) => {
        const { controller, postExecute } = setup();
        postExecute.mockRejectedValueOnce(new ChatAccessDeniedError(reason, reason));
        const error = await controller.post(BOOKING_ID, { body: 'hi' }, request()).catch((e) => e);
        expect(error).toBeInstanceOf(ConflictException);
        expect((error as ConflictException).getResponse()).toMatchObject({ code: 'CHAT_WINDOW_CLOSED' });
      },
    );

    it('maps a missing booking to 404, not 403', async () => {
      const { controller, getExecute } = setup();
      getExecute.mockRejectedValueOnce(new BookingNotFoundError('nope'));
      await expect(controller.list(BOOKING_ID, {} as never, request())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('cursor', () => {
    it('round-trips the next cursor through the transport encoding', async () => {
      const { controller, getExecute } = setup();
      getExecute.mockResolvedValueOnce({
        items: [MESSAGE],
        nextCursor: { createdAt: '2026-10-26T10:00:00.123456Z', id: MESSAGE.id },
        total: 3,
      });

      const page = await controller.list(BOOKING_ID, { limit: 1 } as never, request());
      expect(page.page).toEqual({ limit: 1, total: 3, nextCursor: expect.any(String) });
      // The application layer hands out parts, never base64 (ADR-009).
      expect(getExecute.mock.calls[0][0].cursor).toBeNull();

      // Microsecond precision must survive the round trip: truncating it makes the next page
      // repeat the row it resumed after (this was a real defect, caught by the E2E paging case).
      const decoded = Buffer.from(page.page.nextCursor as string, 'base64url').toString('utf8');
      expect(decoded).toBe(`2026-10-26T10:00:00.123456Z|${MESSAGE.id}`);
    });

    it('treats a garbage cursor as "first page" rather than failing the request', async () => {
      const { controller, getExecute } = setup();
      const page = await controller.list(BOOKING_ID, { cursor: 'not-a-cursor' } as never, request());
      expect(page.items).toHaveLength(1);
      expect(getExecute.mock.calls[0][0].cursor).toBeNull();
    });

    it('treats a cursor with the wrong number of parts as absent', async () => {
      const { controller, getExecute } = setup();
      const single = Buffer.from('only-one-part', 'utf8').toString('base64url');
      await controller.list(BOOKING_ID, { cursor: single } as never, request());
      expect(getExecute.mock.calls[0][0].cursor).toBeNull();
    });

    it('decodes a well-formed cursor into timestamp and id parts', async () => {
      const { controller, getExecute } = setup();
      const valid = Buffer.from('2026-10-26T10:00:00.000123Z|abc', 'utf8').toString('base64url');
      await controller.list(BOOKING_ID, { cursor: valid } as never, request());
      expect(getExecute.mock.calls[0][0].cursor).toEqual({
        createdAt: '2026-10-26T10:00:00.000123Z',
        id: 'abc',
      });
    });

    it('rejects a cursor whose timestamp is not a UTC instant', async () => {
      const { controller, getExecute } = setup();
      const bad = Buffer.from('yesterday|abc', 'utf8').toString('base64url');
      await controller.list(BOOKING_ID, { cursor: bad } as never, request());
      expect(getExecute.mock.calls[0][0].cursor).toBeNull();
    });

    it('defaults the limit to the page default when the caller omits it', async () => {
      const { controller, getExecute } = setup();
      const page = await controller.list(BOOKING_ID, {} as never, request());
      expect(getExecute.mock.calls[0][0].limit).toBe(20);
      expect(page.page.limit).toBe(20);
    });
  });

  it('passes the authenticated caller as the sender and forwards only the body', async () => {
    // A body field named senderId must not travel: senderId comes from the JWT, and the role is
    // resolved from the booking, so nothing the client says about "who" is passed through.
    const { controller, postExecute } = setup();
    await controller.post(BOOKING_ID, { body: 'hi', senderId: 'spoofed' }, request());
    expect(postExecute.mock.calls[0][0]).toEqual({
      bookingId: BOOKING_ID,
      senderId: CALLER,
      input: { body: 'hi' },
    });
  });
});
