import type {
  ChatMessageView,
  ChatSenderRole,
  PostChatMessage,
} from '@skillswap/contracts';
import type { ChatCursorParts } from '../out/chat-repository';

export const POST_CHAT_MESSAGE = Symbol('POST_CHAT_MESSAGE');

export interface PostChatMessageCommand {
  bookingId: string;
  /** The authenticated caller. Never taken from the URL (FR-012). */
  senderId: string;
  /** The contract's normalised output — already trimmed and length-bounded. */
  input: PostChatMessage;
}

/**
 * The stored message plus the role the sender actually held.
 *
 * The role is resolved by the domain from the booking, not accepted from the client: a learner
 * could otherwise label their message "teacher", and the badge a client renders would be a claim
 * rather than a fact.
 */
export interface PostChatMessageResult {
  message: ChatMessageView;
  senderRole: ChatSenderRole;
}

export interface PostChatMessagePort {
  execute(command: PostChatMessageCommand): Promise<PostChatMessageResult>;
}

export const GET_CHAT_MESSAGES = Symbol('GET_CHAT_MESSAGES');

export interface GetChatMessagesCommand {
  bookingId: string;
  requesterId: string;
  limit: number;
  /** Cursor parts, already decoded by the adapter (ADR-009). */
  cursor: ChatCursorParts | null;
}

export interface GetChatMessagesResult {
  items: ChatMessageView[];
  nextCursor: ChatCursorParts | null;
  total: number;
}

export interface GetChatMessagesPort {
  execute(command: GetChatMessagesCommand): Promise<GetChatMessagesResult>;
}
