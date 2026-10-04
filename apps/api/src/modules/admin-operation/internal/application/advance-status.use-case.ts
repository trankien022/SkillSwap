import { assertModuleStatusState, assertTransition } from '../domain/module-status';
import type {
  AdvanceStatusCommand,
  AdvanceStatusPort,
  AdvanceStatusResult,
} from './port/in/advance-status';
import type { ModuleStatusReader } from './port/out/module-status-reader';
import type { ModuleStatusWriter } from './port/out/module-status-writer';

/** Validates and applies a status transition for the Admin operation module (ADR-010). */
export class AdvanceStatusUseCase implements AdvanceStatusPort {
  constructor(
    private readonly reader: ModuleStatusReader,
    private readonly writer: ModuleStatusWriter,
  ) {}

  async execute(command: AdvanceStatusCommand): Promise<AdvanceStatusResult> {
    const current = await this.reader.find();
    assertModuleStatusState(current.state);
    assertModuleStatusState(command.toState);
    assertTransition(current.state, command.toState);
    return this.writer.apply({
      previousState: current.state,
      newState: command.toState,
      changedBy: command.changedBy,
    });
  }
}
