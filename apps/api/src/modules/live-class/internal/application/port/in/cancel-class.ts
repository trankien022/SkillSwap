export const CANCEL_CLASS = Symbol('CANCEL_CLASS');

export interface CancelClassCommand {
  classId: string;
  /** The Teacher performing the cancellation; must own the class. */
  teacherId: string;
}

export interface CancelClassResult {
  classCancelled: boolean;
  bookingsCancelled: number;
}

export interface CancelClassPort {
  execute(command: CancelClassCommand): Promise<CancelClassResult>;
}
