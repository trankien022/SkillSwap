import { SetMetadata, type CustomDecorator } from '@nestjs/common';
import { SUCCESS_CODE } from '@skillswap/contracts';

/**
 * NFR-013: operation-level metadata consumed by `ResponseEnvelopeInterceptor`.
 *
 * `@ResponseCode('WALLET_HISTORY_OK')` sets the stable success `code`;
 * `@ResponseMessage('Wallet history loaded')` sets the human `message`.
 * `@RawResponse()` opts a handler out of the envelope entirely (health probes).
 */

export const RESPONSE_CODE_KEY = 'skillswap:response-code';
export const RESPONSE_MESSAGE_KEY = 'skillswap:response-message';
export const RAW_RESPONSE_KEY = 'skillswap:raw-response';

/** Sets the stable, machine-readable success code (defaults to `OK`). */
export function ResponseCode(code: string): CustomDecorator<string> {
  return SetMetadata(RESPONSE_CODE_KEY, code);
}

/** Sets the human-readable success message (defaults to `OK`). */
export function ResponseMessage(message: string): CustomDecorator<string> {
  return SetMetadata(RESPONSE_MESSAGE_KEY, message);
}

/** Marks a handler whose body is returned verbatim (no envelope). */
export function RawResponse(): CustomDecorator<string> {
  return SetMetadata(RAW_RESPONSE_KEY, true);
}

export const DEFAULT_RESPONSE_CODE = SUCCESS_CODE;
export const DEFAULT_RESPONSE_MESSAGE = SUCCESS_CODE;
