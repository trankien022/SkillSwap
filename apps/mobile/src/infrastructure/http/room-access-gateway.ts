import { roomAccessRequestSchema, roomAccessResponseSchema, type RoomAccessResponse } from '@skillswap/contracts';
import type { GatewayClient } from './gateway-client';

export class RoomAccessGateway {
  constructor(private readonly gateway: GatewayClient) {}
  async request(bookingId: string, displayName: string): Promise<RoomAccessResponse> {
    const body = roomAccessRequestSchema.parse({ displayName });
    const raw = await this.gateway.authenticatedRequest<unknown>(`/classes/bookings/${encodeURIComponent(bookingId)}/room-access`, { method: 'POST', body });
    return roomAccessResponseSchema.parse(raw);
  }
}
