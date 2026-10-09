import type { Clock } from '../../../application/port/out/token-service';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
