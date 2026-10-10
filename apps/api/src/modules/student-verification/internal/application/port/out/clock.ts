export const CLOCK = Symbol('CLOCK');

/** Injectable time source so validity and decision timestamps are deterministic. */
export interface Clock {
  now(): Date;
}
