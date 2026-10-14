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
 * **Not exercised against SePay in any test.** The reconciliation sweeper that
 * uses it is disabled by default, and the Sandbox order endpoint was not part of
 * Phase 0 verification (plan §5a), so the field names below are the documented
 * ones rather than observed ones. The parser tolerates the same shape drift the
 * IPN showed (string vs number amounts, several status spellings) so a
 * divergence degrades to "still pending" instead of a wrong credit.
 */
export class SepayRestOrderClient implements SepayOrderClient {
  constructor(private readonly config: ApiConfig) {}

  async findByInvoiceNumber(providerRef: string): Promise<SepayOrderStatus | null> {
    const base = this.config.sepayRestBaseUrl.replace(/\/$/, '');
    const url = `${base}/v1/orders?order_invoice_number=${encodeURIComponent(providerRef)}`;
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
    if (!response.ok) {
      throw new Error(`SePay order lookup failed (HTTP ${response.status}) for ${providerRef}`);
    }

    const body = (await response.json()) as { data?: SepayOrderRow[] } | SepayOrderRow[];
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
