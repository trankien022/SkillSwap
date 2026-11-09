import { callApi, unwrapEnvelope } from '../api-client';
import type {
  MarkNotificationsReadResponse,
  NotificationsPage,
  NotificationItem as BackendNotificationItem,
} from '@skillswap/contracts';

export interface UINotificationItem {
  id: string;
  createdAt: string;
  category: 'booking' | 'finance' | 'verify';
  unread: boolean;
  title: string;
  content: string;
}

/**
 * Maps a backend NotificationItem (Route 28) into the UI NotificationItem format.
 * Category labels and timestamps are localized at render time by the page component.
 */
export function mapBackendNotificationToUI(item: BackendNotificationItem): UINotificationItem {
  let category: 'booking' | 'finance' | 'verify' = 'booking';

  if (
    item.targetType === 'wallet' ||
    item.type === 'wallet_transaction' ||
    item.type === 'withdrawal_outcome'
  ) {
    category = 'finance';
  } else if (item.targetType === 'verification' || item.type === 'verification_outcome') {
    category = 'verify';
  } else {
    category = 'booking';
  }

  return {
    id: item.id,
    createdAt: item.createdAt,
    category,
    unread: !item.read,
    title: item.title,
    content: item.body,
  };
}

/**
 * Fetches notification inbox for authenticated user via GET /api/notifications.
 *
 * `locale` is the language the current screen is rendered in, sent as
 * `Accept-Language`. The inbox copy is resolved server-side at read time, and the
 * server cannot otherwise know which language the reader is looking at: it falls
 * back to a registered push device, and the web client registers none. Without
 * this header `/en/notifications` rendered Vietnamese rows.
 *
 * Returns `null` for "could not read" so the caller can render an error state,
 * while logging the HTTP status or network error.
 */
export async function fetchNotifications(locale?: string): Promise<{
  items: UINotificationItem[];
  unreadCount: number;
} | null> {
  try {
    const res = await callApi(
      '/notifications',
      locale === undefined ? {} : { headers: { 'accept-language': locale } },
    );
    if (!res.ok) {
      console.warn(`GET /api/notifications failed: HTTP ${res.status}`);
      return null;
    }
    const page = await unwrapEnvelope<NotificationsPage>(res);
    if (page && Array.isArray(page.items)) {
      return {
        items: page.items.map(mapBackendNotificationToUI),
        unreadCount: page.unreadCount,
      };
    }
  } catch (err) {
    console.warn('Failed to fetch /api/notifications:', err);
  }
  return null;
}

/**
 * Marks a single notification read on the server (`POST /notifications/:id/read`)
 * and returns the server's updated `unreadCount`, or `null` on failure.
 */
export async function markNotificationRead(id: string): Promise<number | null> {
  try {
    const res = await callApi(`/notifications/${encodeURIComponent(id)}/read`, {
      method: 'POST',
    });
    if (!res.ok) {
      console.warn(`POST /api/notifications/${id}/read failed: HTTP ${res.status}`);
      return null;
    }
    const data = await unwrapEnvelope<MarkNotificationsReadResponse>(res);
    return typeof data?.unreadCount === 'number' ? data.unreadCount : null;
  } catch (err) {
    console.warn(`Failed to mark notification ${id} read:`, err);
    return null;
  }
}

/**
 * Marks all unread notifications read on the server (`POST /notifications/read-all`)
 * and returns the server's updated `unreadCount`, or `null` on failure.
 */
export async function markAllNotificationsRead(): Promise<number | null> {
  try {
    const res = await callApi('/notifications/read-all', {
      method: 'POST',
    });
    if (!res.ok) {
      console.warn(`POST /api/notifications/read-all failed: HTTP ${res.status}`);
      return null;
    }
    const data = await unwrapEnvelope<MarkNotificationsReadResponse>(res);
    return typeof data?.unreadCount === 'number' ? data.unreadCount : null;
  } catch (err) {
    console.warn('Failed to mark all notifications read:', err);
    return null;
  }
}
