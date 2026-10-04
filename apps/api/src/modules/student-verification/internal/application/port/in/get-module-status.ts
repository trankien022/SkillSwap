import type { ModuleStatusView } from '../out/module-status-reader';

export const GET_MODULE_STATUS = Symbol('GET_MODULE_STATUS');

export interface GetModuleStatusPort {
  execute(): Promise<ModuleStatusView>;
}
