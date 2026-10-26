import { z } from 'zod';
import { MAX_PAGE_LIMIT, pagedSchema, paginationQuerySchema } from './pagination';

/**
 * FR-012 in-class chat (ADR-036, as amended by ADR-036 Amendment A).
 *
 * Chat is scoped to the participants of a booking and to the class's room-access window; the
 * *content* rule that ADR-036 originally carried (BR-056, contact sharing blocked) was withdrawn
 * before any code shipped, so nothing here inspects what a message says. A message containing a
 * phone number, an email address or a social handle is stored like any other — see Amendment A for
 * why that is intended behaviour rather than an oversight.
 *
 * There is no `flagged` field, because a stored-and-flagged message never exists: nothing flags.
 */

/** The two roles a booking has. A message's author is one of them, never an Administrator. */
export const chatSenderRoleSchema = z.enum(['learner', 'teacher']);
export type ChatSenderRole = z.infer<typeof chatSenderRoleSchema>;

export const CHAT_BODY_MAX_LENGTH = 1000;

/**
 * Control characters a message may contain: newline, carriage return and tab.
 *
 * Everything else in C0/C1 (`\u0000`–`\u001f`, `\u007f`–`\u009f`) is refused. This is not a
 * content policy — it is the boundary between "text a person typed" and "bytes that will be
 * rendered or logged somewhere that expects text", and the body is echoed back to every
 * participant's browser.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTER = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/;

/**
 * The body, trimmed and length-bounded.
 *
 * Normalising **before** validating is what makes the length bound honest: a body of 5,000 spaces
 * must fail as empty, not pass a raw-length check and then trim down to nothing at the store.
 *
 * The error messages deliberately never include the value. A rejected body is still something a
 * person typed and may have assumed was private; it must not surface in an API error or a log line
 * (NFR-004/NFR-008), and Zod's default `too_small` message would quote nothing but its `min` —
 * which is safe — while any custom message interpolating the input would not be.
 */
export const chatBodySchema = z
  .string({
    // Replacing Zod's default type error keeps the wording free of the received value.
    invalid_type_error: 'Message must be text',
    required_error: 'Message is required',
  })
  .transform((value) => value.trim())
  .refine((value) => !CONTROL_CHARACTER.test(value), {
    message: 'Message contains characters that are not allowed',
  })
  .refine((value) => value.length > 0, { message: 'Message must not be empty' })
  .refine((value) => value.length <= CHAT_BODY_MAX_LENGTH, {
    message: `Message must be at most ${CHAT_BODY_MAX_LENGTH} characters`,
  });

/** FR-012: post one message to a booking's chat. The body is the only thing a caller sends. */
export const postChatMessageSchema = z.object({ body: chatBodySchema });
export type PostChatMessageInput = z.input<typeof postChatMessageSchema>;
export type PostChatMessage = z.output<typeof postChatMessageSchema>;

/** FR-012: one stored message, as returned to participants. */
export const chatMessageSchema = z.object({
  id: z.string().uuid(),
  classId: z.string().uuid(),
  bookingId: z.string().uuid(),
  senderId: z.string().uuid(),
  senderRole: chatSenderRoleSchema,
  body: z.string().min(1).max(CHAT_BODY_MAX_LENGTH),
  createdAt: z.string().datetime({ offset: true }),
});
export type ChatMessageView = z.infer<typeof chatMessageSchema>;

/** FR-012 / NFR-014: keyset-paginated read of a booking's chat. */
export const listChatMessagesQuerySchema = paginationQuerySchema;
export type ListChatMessagesQuery = z.infer<typeof listChatMessagesQuerySchema>;

/**
 * FR-012 / NFR-014: a page of chat messages.
 *
 * The page is ordered oldest-first, so `nextCursor` walks forward in time and a client that keeps
 * polling can append without re-reading the thread. `total` is present because NFR-014 requires
 * it on every collection.
 */
export const chatMessagesPageSchema = pagedSchema(chatMessageSchema);
export type ChatMessagesPage = z.infer<typeof chatMessagesPageSchema>;

/** Re-exported so a controller can cap a hand-supplied limit without importing pagination. */
export const CHAT_PAGE_MAX_LIMIT = MAX_PAGE_LIMIT;
