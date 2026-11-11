import type { ChatMessageView, ChatMessagesPage, ListChatMessagesQuery } from '@skillswap/contracts';

export interface ChatGatewayPort {
  list(bookingId: string, query?: ListChatMessagesQuery): Promise<ChatMessagesPage>;
  send(bookingId: string, body: string): Promise<ChatMessageView>;
}
