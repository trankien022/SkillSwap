import type { StartClassCommand, StartClassPort, StartClassResult } from './port/in/start-class';
import type { ClassRepository } from './port/out/class-repository';
import { ClassNotFoundError } from './book-class.use-case';
import { NotClassOwnerError } from './cancel-class.use-case';

/** FR-020 (ADR-021): the Teacher starts a class (published|full -> in_progress). */
export class StartClassUseCase implements StartClassPort {
  constructor(private readonly classes: ClassRepository) {}

  async execute(command: StartClassCommand): Promise<StartClassResult> {
    const classView = await this.classes.findById(command.classId);
    if (classView === null) {
      throw new ClassNotFoundError(command.classId);
    }
    if (classView.teacherId !== command.teacherId) {
      throw new NotClassOwnerError();
    }
    const { started } = await this.classes.startAndEmit(command.classId);
    return { started };
  }
}
