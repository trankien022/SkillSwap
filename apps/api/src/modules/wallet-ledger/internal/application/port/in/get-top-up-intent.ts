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
}
