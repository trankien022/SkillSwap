import { deviceSubscriptionSchema, notificationsPageSchema, upsertDeviceSchema, type ListNotificationsQuery, type UpsertDeviceInput } from '@skillswap/contracts';
import type { GatewayClient } from './gateway-client';

export class NotificationGateway {
  constructor(private readonly gateway: GatewayClient) {}
  async list(query: Partial<ListNotificationsQuery> = {}) {
    const params = new URLSearchParams();
    if (query.unreadOnly !== undefined) params.set('unreadOnly', String(query.unreadOnly));
    if (query.limit !== undefined) params.set('limit', String(query.limit));
    if (query.cursor) params.set('cursor', query.cursor);
    const qs = params.toString();
    return notificationsPageSchema.parse(await this.gateway.authenticatedRequest<unknown>(`/notifications${qs ? `?${qs}` : ''}`, { method: 'GET' }));
  }
  async registerDevice(input: UpsertDeviceInput) {
    const body = upsertDeviceSchema.parse(input);
    return deviceSubscriptionSchema.parse(await this.gateway.authenticatedRequest<unknown>('/notification-devices', { method: 'POST', body }));
  }
  async removeDevice(id: string): Promise<void> {
    // `DELETE /notification-devices/:id` answers 204 with no body; the gateway
    // client already resolves a 204 to `undefined`, so there is nothing to parse.
    await this.gateway.authenticatedRequest<unknown>(`/notification-devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}
