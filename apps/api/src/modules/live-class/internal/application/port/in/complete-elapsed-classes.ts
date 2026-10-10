export const COMPLETE_ELAPSED_CLASSES = Symbol('COMPLETE_ELAPSED_CLASSES');

export interface CompleteElapsedClassesResult {
  completed: number;
  cancelled: number;
}

export interface CompleteElapsedClassesPort {
  /** Sweeps classes past their scheduled end into Completed or Cancelled (ADR-021). */
  execute(): Promise<CompleteElapsedClassesResult>;
}
