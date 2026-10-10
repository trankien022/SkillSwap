'use server';

import { DEFAULT_API_BASE } from '../../../lib/status';

export async function createTopUpIntent(amountVnd: number) {
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
  
  return res.json();
}
