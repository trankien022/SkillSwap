export const HANDLE_TOP_UP_CALLBACK = Symbol('HandleTopUpCallback');

/**
 * FR-008 / ADR-030: a *normalised* callback, already validated against the
 * provider schema by the inbox. Keeping the provider's raw shape out of the
 * application layer means the use case does not own IPN parsing.
 */
export interface HandleTopUpCallbackInput {
  /** SePay `order_invoice_number` — our `provider_ref`. */
  readonly providerRef: string;
  readonly amountVnd: number;
  readonly status: 'settled' | 'failed' | 'reversed';
  /** FR-008 / ADR-030: settlement facts, when the provider reports them. */
  readonly providerOrderId?: string | null;
  readonly paidAmountVnd?: number | null;
  readonly paidAt?: Date | null;
}

export interface HandleTopUpCallbackResult {
  /** Whether this callback changed persisted state (false = replay/ignored). */
  readonly applied: boolean;
  readonly status: string;
}

export interface HandleTopUpCallbackPort {
  execute(input: HandleTopUpCallbackInput): Promise<HandleTopUpCallbackResult>;
}
