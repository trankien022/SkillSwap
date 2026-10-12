import { callApi, unwrapEnvelope } from '../api-client';
import type { NotificationsPage, NotificationItem as BackendNotificationItem } from '@skillswap/contracts';

export interface UINotificationItem {
  id: string;
  category: 'booking' | 'finance' | 'verify';
  unread: boolean;
  dateGroup: 'today' | 'yesterday' | 'earlier';
  title: string;
  badge: string;
  badgeColor: string;
  timeText: string;
  tag?: string;
  content: string;
  highlightText?: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  barColor: string;
  metaLeft?: string;
  metaIcon?: string;
}

/**
 * Maps a backend NotificationItem (Route 28) into the rich UI NotificationItem format.
 */
export function mapBackendNotificationToUI(item: BackendNotificationItem): UINotificationItem {
  let category: 'booking' | 'finance' | 'verify' = 'booking';
  let badge = 'Hệ thống';
  let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
  let icon = 'notifications';
  let iconBg = 'bg-slate-100';
  let iconColor = 'text-slate-700';
  let barColor = 'bg-slate-400';

  if (item.targetType === 'wallet' || item.type === 'wallet_transaction' || item.type === 'withdrawal_outcome') {
    category = 'finance';
    badge = 'Ví & Tín chỉ';
    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    icon = 'account_balance_wallet';
    iconBg = 'bg-emerald-50';
    iconColor = 'text-emerald-600';
    barColor = 'bg-emerald-600';
  } else if (item.targetType === 'verification' || item.type === 'verification_outcome') {
    category = 'verify';
    badge = 'Xác minh hồ sơ';
    badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
    icon = 'verified_user';
    iconBg = 'bg-blue-50';
    iconColor = 'text-blue-600';
    barColor = 'bg-blue-600';
  } else {
    category = 'booking';
    badge = 'Lớp học';
    badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    icon = 'event_available';
    iconBg = 'bg-indigo-50';
    iconColor = 'text-indigo-600';
    barColor = 'bg-indigo-600';
  }

  const createdDate = new Date(item.createdAt);
  const diffHours = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60);
  let timeText = 'Gần đây';
  let dateGroup: 'today' | 'yesterday' | 'earlier' = 'today';
  if (diffHours < 1) {
    timeText = `${Math.max(1, Math.round(diffHours * 60))} phút trước`;
  } else if (diffHours < 24) {
    timeText = `${Math.round(diffHours)} giờ trước`;
    dateGroup = 'today';
  } else if (diffHours < 48) {
    timeText = 'Hôm qua';
    dateGroup = 'yesterday';
  } else {
    timeText = createdDate.toLocaleDateString('vi-VN');
    dateGroup = 'earlier';
  }

  return {
    id: item.id,
    category,
    unread: !item.read,
    dateGroup,
    title: item.title,
    badge,
    badgeColor,
    timeText,
    content: item.body,
    icon,
    iconBg,
    iconColor,
    barColor,
    metaLeft: `Mã sự kiện: #${item.targetId.slice(0, 8)}`,
  };
}

/**
 * Fetches notification inbox for authenticated user via GET /api/notifications.
 */
export async function fetchNotifications(): Promise<{ items: UINotificationItem[]; unreadCount: number } | null> {
  try {
    const res = await callApi('/notifications');
    if (res.ok) {
      const page = await unwrapEnvelope<NotificationsPage>(res);
      if (page && Array.isArray(page.items)) {
        return {
          items: page.items.map(mapBackendNotificationToUI),
          unreadCount: page.unreadCount,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to fetch /api/notifications:', err);
  }
  return null;
}
