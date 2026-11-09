import { afterEach, describe, expect, it, vi } from 'vitest';
import { envelopeOk } from '@skillswap/contracts';
import {
  mapBackendNotificationToUI,
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from './api-notifications';
import type { NotificationItem as BackendNotificationItem } from '@skillswap/contracts';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api-notifications (W7)', () => {
  const sampleWalletNotif: BackendNotificationItem = {
    id: 'notif-w-1',
    type: 'wallet_transaction',
    title: 'Credit top-up settled',
    body: '200 credits were added to your wallet.',
    targetType: 'wallet',
    targetId: 'topup-ref-1234',
    read: false,
    createdAt: new Date().toISOString(),
  };

  const sampleVerifyNotif: BackendNotificationItem = {
    id: 'notif-v-1',
    type: 'verification_outcome',
    title: 'Student verification approved',
    body: 'Your student card has been verified.',
    targetType: 'verification',
    targetId: 'verif-doc-5678',
    read: true,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  };

  it('maps wallet notifications into finance category without hardcoded Vietnamese strings', () => {
    const uiItem = mapBackendNotificationToUI(sampleWalletNotif);
    expect(uiItem).toEqual({
      id: 'notif-w-1',
      createdAt: sampleWalletNotif.createdAt,
      category: 'finance',
      unread: true,
      title: 'Credit top-up settled',
      content: '200 credits were added to your wallet.',
    });
  });

  it('maps verification notifications into verify category', () => {
    const uiItem = mapBackendNotificationToUI(sampleVerifyNotif);
    expect(uiItem.id).toBe('notif-v-1');
    expect(uiItem.category).toBe('verify');
    expect(uiItem.unread).toBe(false);
  });

  it('persists single-item read state via POST /notifications/:id/read and returns unreadCount', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(envelopeOk({ success: true, unreadCount: 3 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    const remaining = await markNotificationRead('notif-w-1');
    expect(remaining).toBe(3);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/notifications/notif-w-1/read'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('persists mark-all-read via POST /notifications/read-all and returns unreadCount', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(envelopeOk({ success: true, unreadCount: 0 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    const remaining = await markAllNotificationsRead();
    expect(remaining).toBe(0);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/notifications/read-all'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('handles network failure gracefully without throwing', async () => {
    const result = await fetchNotifications();
    expect(result).toBeNull();
  });

  /**
   * Defect #3: the inbox copy is rendered server-side, and the server resolves the
   * language from the request. If the client does not state one, the server falls back
   * to a registered push device — and the web app registers none — so `/en` showed
   * Vietnamese rows.
   */
  it('sends the screen language as Accept-Language', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(envelopeOk({ items: [], nextCursor: null, unreadCount: 0 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchNotifications('en');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/notifications'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'accept-language': 'en' }),
      }),
    );
  });

  it('omits the header when no locale is given, so the server keeps its own default', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(envelopeOk({ items: [], nextCursor: null, unreadCount: 0 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchNotifications();

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).not.toHaveProperty('accept-language');
  });
});
