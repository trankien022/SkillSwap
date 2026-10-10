import type { CompleteClassCommand, CompleteClassPort, CompleteClassResult } from './port/in/complete-class';
import type { ClassRepository } from './port/out/class-repository';
import { ClassNotFoundError } from './book-class.use-case';
import { NotClassOwnerError } from './cancel-class.use-case';

/**
 * FR-020 (ADR-021): the Teacher explicitly ends a class they held
 * (-> completed, basis `teacher_ended`). Replays are no-ops.
 */
export class CompleteClassUseCase implements CompleteClassPort {
  constructor(private readonly classes: ClassRepository) {}

  async execute(command: CompleteClassCommand): Promise<CompleteClassResult> {
    const classView = await this.classes.findById(command.classId);
    if (classView === null) {
      throw new ClassNotFoundError(command.classId);
    }
    if (classView.teacherId !== command.teacherId) {
      throw new NotClassOwnerError();
    }
    const { completed } = await this.classes.completeAndEmit(command.classId, 'teacher_ended');
    return { completed, basis: completed ? 'teacher_ended' : null };
  }
}
