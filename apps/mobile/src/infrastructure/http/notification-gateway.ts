import { deviceSubscriptionSchema, markNotificationsReadResponseSchema, notificationsPageSchema, upsertDeviceSchema, type ListNotificationsQuery, type MarkNotificationsReadResponse, type UpsertDeviceInput } from '@skillswap/contracts';
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
  /** B6: marks one notification read; the server answers with the remaining unread count. */
  async markRead(id: string): Promise<MarkNotificationsReadResponse> {
    return markNotificationsReadResponseSchema.parse(await this.gateway.authenticatedRequest<unknown>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }));
  }
  /** B6: marks the whole inbox read; the server answers with the remaining unread count. */
  async markAllRead(): Promise<MarkNotificationsReadResponse> {
    return markNotificationsReadResponseSchema.parse(await this.gateway.authenticatedRequest<unknown>('/notifications/read-all', { method: 'POST' }));
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
