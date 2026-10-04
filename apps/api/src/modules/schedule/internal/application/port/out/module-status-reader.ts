export const STATUS_READER = Symbol('STATUS_READER');

export interface ModuleStatusView {
  module: string;
  state: string;
  updatedAt: string | null;
}

export interface ModuleStatusReader {
  find(): Promise<ModuleStatusView>;
}
