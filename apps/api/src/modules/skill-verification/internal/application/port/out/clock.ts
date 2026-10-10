export const CLOCK = Symbol('CLOCK');

/** Injectable time source so evidence submission timestamps are deterministic. */
export interface Clock {
  now(): Date;
}
