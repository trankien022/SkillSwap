export const SEND_CLASS_REMINDERS = Symbol('SEND_CLASS_REMINDERS');

export interface SendClassRemindersResult {
  /** Classes whose reminder was claimed and emitted by this run. */
  reminded: number;
  /** Classes that lost the claim to another sweep — not an error, just not ours. */
  skipped: number;
}

export interface SendClassRemindersPort {
  /** Emits `class.starting.soon` for every class in its reminder window that has not been sent. */
  execute(): Promise<SendClassRemindersResult>;
}
