import type { Clock } from '../../../application/port/out/clock';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
