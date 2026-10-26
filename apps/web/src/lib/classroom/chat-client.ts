/**
 * FR-012 (ADR-036): the in-class chat client.
 *
 * Two calls, both scoped to a booking the caller is a party to:
 *
 * - `loadMessages` reads a page, oldest first, following `nextCursor` forward.
 * - `sendMessage` posts one body.
 *
 * Refusals are surfaced as `ChatError` carrying the **stable server code**
 * (`CHAT_NOT_A_PARTY`, `CHAT_WINDOW_CLOSED`, …) rather than the human message,
 * because the copy a learner sees belongs to the UI, not to the API
 * (`contracts/envelope.ts` is explicit about branching on `code`).
 *
 * A rejected body is never echoed into the error: the API refuses to quote it
 * (NFR-004/NFR-008), and this client does not add it back by putting the draft
 * in a thrown message.
 */

import {
  MAX_PAGE_LIMIT,
  chatMessagesPageSchema,
  chatMessageSchema,
  type ChatMessageView,
  type ChatMessagesPage,
} from '@skillswap/contracts';
import { ApiResponseError, callApi, unwrapEnvelope } from '../api-client';

/** The server codes a chat call can fail with, plus the envelope's own. */
export type ChatErrorCode =
  | 'CHAT_NOT_A_PARTY'
  | 'CHAT_WINDOW_CLOSED'
  | 'CHAT_MESSAGE_INVALID'
  | 'BookingNotFoundError'
  | 'HTTP_404'
  | 'HTTP_401'
  | 'HTTP_403'
  | 'HTTP_409'
  | 'UNAVAILABLE';

export class ChatError extends Error {
  constructor(
    readonly code: ChatErrorCode,
    readonly status: number | null,
  ) {
    super(code);
    this.name = 'ChatError';
  }
}

function classify(code: string, status: number | null): ChatErrorCode {
  switch (code) {
    case 'CHAT_NOT_A_PARTY':
    case 'CHAT_WINDOW_CLOSED':
    case 'CHAT_MESSAGE_INVALID':
      return code;
    // A 400 from the chat routes can only be the body: the only other 400 source is a cursor,
    // and a cursor is treated as "first page" rather than rejected. Naming it here saves every
    // caller from special-casing the generic validation code.
    case 'VALIDATION_FAILED':
      return status === 400 ? 'CHAT_MESSAGE_INVALID' : 'UNAVAILABLE';
    case 'BookingNotFoundError':
      return 'BookingNotFoundError';
    default:
      break;
  }
  switch (status) {
    case 401:
      return 'HTTP_401';
    case 403:
      return 'HTTP_403';
    case 404:
      return 'HTTP_404';
    case 409:
      return 'HTTP_409';
    default:
      return 'UNAVAILABLE';
  }
}

async function fail(res: Response, error: unknown): Promise<never> {
  if (error instanceof ApiResponseError) {
    throw new ChatError(classify(error.code, res.status), res.status);
  }
  throw new ChatError(classify('', res.status), res.status);
}

/** One page of a booking's conversation, oldest first. */
export async function loadMessages(
  bookingId: string,
  options: { limit?: number; cursor?: string | null } = {},
): Promise<ChatMessagesPage> {
  const params = new URLSearchParams();
  params.set('limit', String(Math.min(Math.max(options.limit ?? MAX_PAGE_LIMIT, 1), MAX_PAGE_LIMIT)));
  if (options.cursor) {
    params.set('cursor', options.cursor);
  }

  const res = await callApi(
    `/classes/bookings/${encodeURIComponent(bookingId)}/messages?${params.toString()}`,
    { method: 'GET' },
  );

  try {
    const data = await unwrapEnvelope<ChatMessagesPage>(res);
    return chatMessagesPageSchema.parse(data);
  } catch (error) {
    return fail(res, error);
  }
}

/**
 * Posts one message and returns the stored row (with the server's timestamp).
 *
 * A body that is empty after trimming is refused here, not on the wire: the server would answer
 * 400, and spending a round trip to learn something the contract already states is a wasted
 * request that shows the learner a spinner first.
 */
export async function sendMessage(bookingId: string, body: string): Promise<ChatMessageView> {
  if (body.trim().length === 0) {
    throw new ChatError('CHAT_MESSAGE_INVALID', null);
  }

  const res = await callApi(`/classes/bookings/${encodeURIComponent(bookingId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });

  try {
    const data = await unwrapEnvelope<ChatMessageView>(res);
    return chatMessageSchema.parse(data);
  } catch (error) {
    return fail(res, error);
  }
}
