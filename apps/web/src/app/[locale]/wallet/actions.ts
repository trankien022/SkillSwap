'use server';

import { DEFAULT_API_BASE } from '../../../lib/status';

interface TopUpIntent {
  paymentUrl: string;
}

export async function createTopUpIntent(amountVnd: number): Promise<TopUpIntent> {
  const url = `${DEFAULT_API_BASE}/api/wallet/top-ups`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amountVnd }),
    // Do not cache this request
    cache: 'no-store',
  });
  
  if (!res.ok) {
    throw new Error(`Top-up API failed with status ${res.status}`);
  }
  
  // NFR-013: unwrap the uniform envelope; the payload is under `data`.
  const body = (await res.json()) as { success: boolean; data: TopUpIntent };
  return body.data;
}
