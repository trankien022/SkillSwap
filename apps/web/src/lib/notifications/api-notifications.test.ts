import { describe, expect, it } from 'vitest';
import { mapBackendNotificationToUI, fetchNotifications } from './api-notifications';
import type { NotificationItem as BackendNotificationItem } from '@skillswap/contracts';

describe('api-notifications', () => {
  const sampleWalletNotif: BackendNotificationItem = {
    id: 'notif-w-1',
    type: 'wallet_transaction',
    title: 'Nạp tín chỉ thành công',
    body: 'Bạn vừa nạp 200 tín chỉ qua cổng nạp.',
    targetType: 'wallet',
    targetId: 'topup-ref-1234',
    read: false,
    createdAt: new Date().toISOString(),
  };

  const sampleVerifyNotif: BackendNotificationItem = {
    id: 'notif-v-1',
    type: 'verification_outcome',
    title: 'Hồ sơ sinh viên đã được phê duyệt',
    body: 'Thẻ sinh viên của bạn đã được kiểm duyệt hợp lệ.',
    targetType: 'verification',
    targetId: 'verif-doc-5678',
    read: true,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  };

  it('maps wallet notifications into finance category with correct badge and icon', () => {
    const uiItem = mapBackendNotificationToUI(sampleWalletNotif);
    expect(uiItem.id).toBe('notif-w-1');
    expect(uiItem.category).toBe('finance');
    expect(uiItem.unread).toBe(true);
    expect(uiItem.badge).toBe('Ví & Tín chỉ');
    expect(uiItem.icon).toBe('account_balance_wallet');
  });

  it('maps verification notifications into verify category with correct badge and icon', () => {
    const uiItem = mapBackendNotificationToUI(sampleVerifyNotif);
    expect(uiItem.id).toBe('notif-v-1');
    expect(uiItem.category).toBe('verify');
    expect(uiItem.unread).toBe(false);
    expect(uiItem.badge).toBe('Xác minh hồ sơ');
    expect(uiItem.icon).toBe('verified_user');
  });

  it('handles network failure gracefully without throwing', async () => {
    const result = await fetchNotifications();
    expect(result).toBeNull();
  });
});
