import type { TopUpIntentStatusView } from '@skillswap/contracts';

export const GET_TOP_UP_INTENT = Symbol('GetTopUpIntent');

/**
 * FR-008 / ADR-033: read one top-up intent, owner-scoped.
 *
 * The client polls this after handing the user to the SePay hosted checkout,
 * because the IPN settles the intent server-to-server and pushes nothing.
 */
export interface GetTopUpIntentPort {
  execute(ownerId: string, intentId: string): Promise<TopUpIntentStatusView>;
  /**
   * FR-008: read the intent the payer was returned for.
   *
   * The SePay redirect carries only the invoice number (the intent id does not
   * exist when the checkout form is submitted), so the return page needs this
   * second handle. Owner-scoped exactly like `execute`: someone else's invoice
   * number is "not found".
   */
  executeByProviderRef(ownerId: string, providerRef: string): Promise<TopUpIntentStatusView>;
}
