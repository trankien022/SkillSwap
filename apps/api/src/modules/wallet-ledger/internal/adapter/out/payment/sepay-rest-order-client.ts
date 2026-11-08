import type { ApiConfig } from '../../../../../../shared/config/api-config';
import type {
  SepayOrderClient,
  SepayOrderStatus,
} from '../../../application/port/out/sepay-order-client';

/** Normalises the provider's order status vocabulary onto this module's. */
function toStatus(raw: unknown): SepayOrderStatus['status'] {
  const value = String(raw ?? '').toUpperCase();
  if (value === 'CAPTURED' || value === 'APPROVED' || value === 'PAID') return 'settled';
  if (value === 'CANCELLED' || value === 'FAILED' || value === 'EXPIRED') return 'failed';
  if (value === 'REVERSED' || value === 'REFUNDED') return 'reversed';
  return 'pending';
}

/** Amounts arrive as strings with a fractional part (`"10000.00"`) and as numbers. */
function toVnd(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const parsed = typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function toDate(raw: unknown): Date | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  // SePay sends local time (`2026-10-14 09:30:00`), which `Date` parses as
  // local; that is acceptable for a settlement timestamp that only surfaces
  // in the UI, and it is not used for any ordering decision.
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

interface SepayOrderRow {
  order_invoice_number?: unknown;
  order_id?: unknown;
  order_status?: unknown;
  order_amount?: unknown;
  transaction_date?: unknown;
}

/**
 * FR-008 / ADR-033 reconciliation: reads one order back from the SePay REST API.
 *
 * **The path is observed, the fields are not.** A live probe of the sandbox on
 * 2026-11-08 showed `/v1/orders` answering the host's HTML 404 page while
 * `/v1/order` (singular) answers JSON. This adapter used the plural form, so
 * every sweep would have thrown `HTTP 404` the moment anybody set
 * `SEPAY_RECON_ENABLED=true` — which is why the flag sitting off by default hid
 * it. The singular path below is the one the host serves.
 *
 * **The field names remain documented, not observed.** The Order API rejects
 * every form of the credential this repo holds: `spsk_test_…` is the Payment
 * Gateway HMAC secret used to sign the checkout form, and the Order API answers
 * `401` for a bearer token, a raw `Authorization`, `X-Secret-Key`, `X-Api-Key`,
 * and every merchant-id combination tried. A separate API key is required and is
 * not in `.env`. Nothing has ever read a real order body, so the parser still
 * tolerates the shape drift the IPN showed (string vs number amounts, several
 * status spellings) so a divergence degrades to "still pending" instead of a
 * wrong credit.
 */
export class SepayRestOrderClient implements SepayOrderClient {
  constructor(private readonly config: ApiConfig) {}

  async findByInvoiceNumber(providerRef: string): Promise<SepayOrderStatus | null> {
    const base = this.config.sepayRestBaseUrl.replace(/\/$/, '');
    const url = `${base}/v1/order?order_invoice_number=${encodeURIComponent(providerRef)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(this.config.sepaySecretKey
          ? { Authorization: `Bearer ${this.config.sepaySecretKey}` }
          : {}),
      },
    });

    if (response.status === 404) return null;

    // An operator reading this log line needs to tell "the provider is down" from
    // "this is the wrong kind of key". The sandbox answers 401 in exactly the
    // second case, and with the Payment Gateway secret it always will.
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `SePay order lookup was rejected (HTTP ${response.status}) for ${providerRef}: ` +
          'the configured credential is not accepted by the Order API — ' +
          'SEPAY_SECRET_KEY is the Payment Gateway signing secret, ' +
          'and reconciliation needs a separate Order API key',
      );
    }

    if (!response.ok) {
      throw new Error(`SePay order lookup failed (HTTP ${response.status}) for ${providerRef}`);
    }

    // A wrong path answers 200 text/html. Treating that as "no rows" would make a
    // stuck intent look reconciled forever, so refuse to parse it as JSON at all.
    const contentType = response.headers?.get('content-type') ?? '';
    let body: { data?: SepayOrderRow[] } | SepayOrderRow[];
    try {
      body = (await response.json()) as { data?: SepayOrderRow[] } | SepayOrderRow[];
    } catch {
      throw new Error(
        `SePay order lookup returned a non-JSON body for ${providerRef} ` +
          `(content-type: ${contentType || 'absent'}) — the endpoint path is probably wrong`,
      );
    }

    const rows = Array.isArray(body) ? body : (body.data ?? []);
    const row = rows.find((candidate) => candidate.order_invoice_number === providerRef);
    if (row === undefined) return null;

    return {
      providerRef,
      providerOrderId: row.order_id === undefined ? null : String(row.order_id),
      status: toStatus(row.order_status),
      paidAmountVnd: toVnd(row.order_amount),
      paidAt: toDate(row.transaction_date),
    };
  }
}
