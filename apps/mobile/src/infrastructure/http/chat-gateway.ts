import { chatMessagesPageSchema, chatMessageSchema, listChatMessagesQuerySchema, postChatMessageSchema } from '@skillswap/contracts';
import type { ChatGatewayPort } from '@/application/port/chat-gateway';
import type { GatewayClient } from './gateway-client';

export class ChatGateway implements ChatGatewayPort {
  constructor(private readonly gateway: GatewayClient) {}
  async list(bookingId: string, query = {}) {
    const parsed = listChatMessagesQuerySchema.parse(query);
    const params = new URLSearchParams();
    if (parsed.limit) params.set('limit', String(parsed.limit));
    if (parsed.cursor) params.set('cursor', parsed.cursor);
    return chatMessagesPageSchema.parse(await this.gateway.authenticatedRequest<unknown>(
      `/classes/bookings/${encodeURIComponent(bookingId)}/messages?${params}`, { method: 'GET' },
    ));
  }
  async send(bookingId: string, body: string) {
    return chatMessageSchema.parse(await this.gateway.authenticatedRequest<unknown>(
      `/classes/bookings/${encodeURIComponent(bookingId)}/messages`,
      { method: 'POST', body: postChatMessageSchema.parse({ body }) },
    ));
  }
}
