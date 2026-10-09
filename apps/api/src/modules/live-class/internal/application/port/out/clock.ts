export const CLOCK = Symbol('CLOCK');

/** Injectable time source so eligibility checks are deterministic in tests. */
export interface Clock {
  now(): Date;
}
