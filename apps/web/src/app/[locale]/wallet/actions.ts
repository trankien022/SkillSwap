'use server';

import { createHmac } from 'node:crypto';
import { DEFAULT_API_BASE } from '../../../lib/status';

export async function simulatePaymentCallback(
  providerRef: string,
  amountVnd: number,
): Promise<{ success: boolean; message: string }> {
  const url = `${DEFAULT_API_BASE}/api/wallet/top-ups/callback`;
  const body = { providerRef, amountVnd, status: 'settled' };
  const rawBody = JSON.stringify(body);
  const secret = process.env.PAYMENT_WEBHOOK_SECRET || 'dev-webhook-secret';
  const signature = createHmac('sha256', secret).update(rawBody).digest('hex');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature': signature,
    },
    body: rawBody,
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text();
    return { success: false, message: `Lỗi kích hoạt webhook (${res.status}): ${errorText}` };
  }

  return { success: true, message: 'Đã hoàn tất thanh toán thành công' };
}
