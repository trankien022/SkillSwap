import type { PushMessage, PushProviderPort, PushProviderResult } from '../../../application/port/push-provider';

const SEND_URL = 'https://exp.host/--/api/v2/push/send';
const RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

interface ExpoResponseItem {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
}

function providerResult(item: ExpoResponseItem | undefined, ticket = false): PushProviderResult {
  if (item?.status === 'ok' && (!ticket || typeof item.id === 'string')) {
    return { status: 'ok', ...(typeof item.id === 'string' ? { ticketId: item.id } : {}) };
  }
  const error = item?.details?.error;
  return {
    status: 'error',
    message: typeof item?.message === 'string' ? item.message.slice(0, 500) : 'Expo push request failed',
    deviceNotRegistered: error === 'DeviceNotRegistered',
  };
}

/** Expo Push Service HTTP adapter. It never logs tokens or full provider payloads. */
export class ExpoPushProvider implements PushProviderPort {
  constructor(private readonly request: typeof fetch = fetch) {}

  async send(message: PushMessage): Promise<PushProviderResult> {
    const response = await this.request(SEND_URL, {
      method: 'POST',
      headers: { accept: 'application/json', 'accept-encoding': 'gzip, deflate', 'content-type': 'application/json' },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Expo push service returned HTTP ${response.status}`);
    const payload = await response.json() as { data?: ExpoResponseItem };
    return providerResult(payload.data, true);
  }

  async getReceipts(ticketIds: readonly string[]): Promise<Readonly<Record<string, PushProviderResult>>> {
    const response = await this.request(RECEIPTS_URL, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ticketIds }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Expo receipt service returned HTTP ${response.status}`);
    const payload = await response.json() as { data?: Record<string, ExpoResponseItem> };
    return Object.fromEntries(Object.entries(payload.data ?? {}).map(([id, item]) => [id, providerResult(item)]));
  }
}
