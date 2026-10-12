'use server';

import { unwrapEnvelope } from '@skillswap/contracts';
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
  
  // NFR-013: the shared contracts layer validates the envelope and returns `data`,
  // throwing an ApiResponseError (with the stable `code`) on failure.
  return unwrapEnvelope<TopUpIntent>(res);
}
