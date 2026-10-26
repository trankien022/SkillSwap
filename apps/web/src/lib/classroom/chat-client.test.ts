import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatError, loadMessages, sendMessage } from './chat-client';

const BOOKING_ID = '7c1e0000-0000-4000-8000-0000000000bb';
const CLASS_ID = '7c1e0000-0000-4000-8000-0000000000aa';

const MESSAGE = {
  id: '7c1e0000-0000-4000-8000-000000000011',
  classId: CLASS_ID,
  bookingId: BOOKING_ID,
  senderId: '7c1e0000-0000-4000-8000-0000000000cc',
  senderRole: 'teacher',
  body: 'Bài 3, trang 45',
  createdAt: '2026-10-26T10:00:00.000Z',
};

function envelope(data: unknown) {
  return { success: true, code: 'OK', message: 'OK', data, errors: [] };
}

/**
 * The server's failure envelope (NFR-013 / `domain-error.filter.ts`). `errors` is required by
 * `parseEnvelope`, which is why the first version of these fixtures — missing it — made every
 * refusal look like its bare HTTP status.
 */
function failure(code: string, message: string) {
  return { success: false, code, message, data: null, errors: [{ code, message }] };
}

function respond(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    clone: () => ({ json: async () => body }),
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadMessages (FR-012 / NFR-014)', () => {
  it('asks for a page of one booking and parses the envelope', async () => {
    fetchMock.mockResolvedValue(
      respond(200, envelope({ items: [MESSAGE], page: { limit: 20, nextCursor: null, total: 1 } })),
    );

    const page = await loadMessages(BOOKING_ID, { limit: 20 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.body).toBe('Bài 3, trang 45');
    const url = (fetchMock.mock.calls[0]?.[0] as string) ?? '';
    expect(url).toContain(`/api/classes/bookings/${BOOKING_ID}/messages`);
    expect(url).toContain('limit=20');
  });

  it('forwards the cursor so the next page continues the thread', async () => {
    fetchMock.mockResolvedValue(
      respond(200, envelope({ items: [], page: { limit: 20, nextCursor: null, total: 0 } })),
    );

    await loadMessages(BOOKING_ID, { cursor: 'abc|def' });

    const url = (fetchMock.mock.calls[0]?.[0] as string) ?? '';
    expect(url).toContain('cursor=abc%7Cdef');
  });

  it('clamps a limit outside the contract bounds instead of sending a 400', async () => {
    fetchMock.mockResolvedValue(
      respond(200, envelope({ items: [], page: { limit: 100, nextCursor: null, total: 0 } })),
    );

    await loadMessages(BOOKING_ID, { limit: 5000 });

    const url = (fetchMock.mock.calls[0]?.[0] as string) ?? '';
    expect(url).toContain('limit=100');
  });

  it('reports a refusal as ChatError with the server code, not the human message', async () => {
    fetchMock.mockResolvedValue(
      respond(403, failure('CHAT_NOT_A_PARTY', 'Requester is not a party to this booking')),
    );

    const error = (await loadMessages(BOOKING_ID).catch((e) => e)) as ChatError;
    expect(error).toBeInstanceOf(ChatError);
    expect(error.code).toBe('CHAT_NOT_A_PARTY');
    expect(error.status).toBe(403);
    // The copy the learner reads belongs to the UI; the client must not smuggle
    // the API's sentence into the error surface.
    expect(error.message).not.toContain('Requester is not a party');
  });

  it('degrades an unrecognised failure to UNAVAILABLE rather than claiming success', async () => {
    fetchMock.mockResolvedValue(respond(500, failure('INTERNAL_ERROR', 'boom')));

    const error = (await loadMessages(BOOKING_ID).catch((e) => e)) as ChatError;
    expect(error.code).toBe('UNAVAILABLE');
  });

  it('maps a missing booking to its own code, because it is a different screen', async () => {
    fetchMock.mockResolvedValue(respond(404, failure('BookingNotFoundError', 'Booking not found: x')));

    const error = (await loadMessages(BOOKING_ID).catch((e) => e)) as ChatError;
    expect(error.code).toBe('BookingNotFoundError');
  });

  it('refuses a payload that does not satisfy the contract', async () => {
    // A mis-shaped page must not be rendered as an empty conversation.
    fetchMock.mockResolvedValue(respond(200, envelope({ items: [MESSAGE] })));

    const error = (await loadMessages(BOOKING_ID).catch((e) => e)) as ChatError;
    expect(error).toBeInstanceOf(ChatError);
    expect(error.code).toBe('UNAVAILABLE');
  });
});

describe('sendMessage (FR-012)', () => {
  it('posts only the body and returns the stored row', async () => {
    fetchMock.mockResolvedValue(respond(201, envelope(MESSAGE)));

    const stored = await sendMessage(BOOKING_ID, 'Bài 3, trang 45');

    expect(stored.id).toBe(MESSAGE.id);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    // Nothing about the sender travels: the API takes it from the token and the role
    // from the booking.
    expect(JSON.parse(String(init.body))).toEqual({ body: 'Bài 3, trang 45' });
  });

  it('surfaces a closed window so the composer can explain it', async () => {
    // The API answers 403 for every chat refusal (domain-error.filter.ts) and distinguishes
    // them by `code` -- which is exactly why the client must branch on `code`, not status.
    fetchMock.mockResolvedValue(respond(403, failure('CHAT_WINDOW_CLOSED', 'Chat has closed')));

    const error = (await sendMessage(BOOKING_ID, 'hello').catch((e) => e)) as ChatError;
    expect(error.code).toBe('CHAT_WINDOW_CLOSED');
    expect(error.status).toBe(403);
  });

  it('surfaces an invalid body without repeating the body', async () => {
    fetchMock.mockResolvedValue(
      respond(400, failure('VALIDATION_FAILED', 'body: Message must not be empty')),
    );

    const error = (await sendMessage(BOOKING_ID, 'secret-draft').catch((e) => e)) as ChatError;
    expect(error.code).toBe('CHAT_MESSAGE_INVALID');
    expect(JSON.stringify(error)).not.toContain('secret-draft');
  });

  it('rejects an empty body client-side, before spending a round trip', async () => {
    // The server would answer 400, but the composer should not even ask.
    const error = (await sendMessage(BOOKING_ID, '   ').catch((e) => e)) as ChatError;
    expect(error).toBeInstanceOf(ChatError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
