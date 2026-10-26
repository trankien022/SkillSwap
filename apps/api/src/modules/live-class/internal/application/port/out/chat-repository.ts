import type { ChatMessageView, ChatSenderRole } from '@skillswap/contracts';

export const CHAT_REPOSITORY = Symbol('CHAT_REPOSITORY');

export interface NewChatMessage {
  bookingId: string;
  classId: string;
  senderId: string;
  senderRole: ChatSenderRole;
  /** Already normalised by the contract's `chatBodySchema`; the repository does not re-trim. */
  body: string;
}

/**
 * A position in the conversation: `(createdAt, id)`.
 *
 * Two columns rather than a bare id because the ordering is by time, and two messages can share a
 * millisecond. Carrying the pair means the next page starts strictly after the last row the client
 * saw, rather than re-reading or skipping a tie.
 */
export interface ChatCursorParts {
  createdAt: Date;
  id: string;
}

export interface ListMessagesCriteria {
  classId: string;
  limit: number;
  cursor: ChatCursorParts | null;
}

export interface ListMessagesResult {
  items: ChatMessageView[];
  nextCursor: ChatCursorParts | null;
  /** Rows in the conversation, ignoring `limit` and `cursor` (NFR-014). */
  total: number;
}

/**
 * FR-012 persistence port. Append-only: there is no update or delete method, and adding one
 * would be a product decision (ADR-036 C4), not a refactor.
 */
export interface ChatRepository {
  append(message: NewChatMessage): Promise<ChatMessageView>;
  list(criteria: ListMessagesCriteria): Promise<ListMessagesResult>;
}
