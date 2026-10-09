export const HANDLE_TOP_UP_CALLBACK = Symbol('HandleTopUpCallback');

export interface HandleTopUpCallbackInput {
  readonly providerRef: string;
  readonly amountVnd: number;
  readonly status: 'settled' | 'failed' | 'reversed';
}

export interface HandleTopUpCallbackResult {
  /** Whether this callback changed persisted state (false = replay/ignored). */
  readonly applied: boolean;
  readonly status: string;
}

export interface HandleTopUpCallbackPort {
  execute(input: HandleTopUpCallbackInput): Promise<HandleTopUpCallbackResult>;
}
