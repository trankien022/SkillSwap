import { createClassSchema } from '@skillswap/contracts';

export type StartsAtError = 'empty' | 'invalid' | 'past';

export const startsAtMessageKey: Record<StartsAtError, string> = {
  empty: 'Teaching.startsAtEmpty',
  invalid: 'Teaching.startsAtInvalid',
  past: 'Teaching.startsAtPast',
};

export type ParsedStartsAt =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: StartsAtError };

/**
 * Client-side check of the class start time typed into the publish form (MM13).
 *
 * Format is judged by the contract's own `startsAt` rule, so anything accepted here is accepted by
 * `TeachingGateway.create`. On success `value` is the trimmed input, unchanged: the payload sent to
 * the server is not reformatted.
 */
export function parseStartsAt(input: string, now: number = Date.now()): ParsedStartsAt {
  const value = input.trim();
  if (!value) return { ok: false, error: 'empty' };

  const timestamp = Date.parse(value);
  if (!createClassSchema.shape.startsAt.safeParse(value).success || !Number.isFinite(timestamp)) {
    return { ok: false, error: 'invalid' };
  }
  if (timestamp <= now) return { ok: false, error: 'past' };

  return { ok: true, value };
}
