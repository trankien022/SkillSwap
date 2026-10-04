import type { GetModuleStatusPort } from '../port/in/get-module-status';
import type { ModuleStatusReader, ModuleStatusView } from '../port/out/module-status-reader';

/** Query handler (ADR-012: the read path never imports the domain). */
export class GetModuleStatusQueryHandler implements GetModuleStatusPort {
  constructor(private readonly reader: ModuleStatusReader) {}

  execute(): Promise<ModuleStatusView> {
    return this.reader.find();
  }
}
