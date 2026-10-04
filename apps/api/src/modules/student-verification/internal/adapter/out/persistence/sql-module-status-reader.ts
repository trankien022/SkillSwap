import { ModuleNotInitialisedError } from '../../../../../../shared/errors';
import { MODULE_STATUS_ID, MODULE_STATUS_TABLE } from '../../../../../../shared/messaging/constants';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type {
  ModuleStatusReader,
  ModuleStatusView,
} from '../../../application/port/out/module-status-reader';

export class SqlModuleStatusReader implements ModuleStatusReader {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  async find(): Promise<ModuleStatusView> {
    const source = this.registry.get(this.moduleName);
    const table = qualified(this.registry.getSchema(this.moduleName), MODULE_STATUS_TABLE);
    const rows = (await source.query(
      `SELECT "state", "updated_at" FROM ${table} WHERE "id" = $1`,
      [MODULE_STATUS_ID],
    )) as Array<{ state: string; updated_at: Date | string | null }>;
    const row = rows[0];
    if (row === undefined) {
      throw new ModuleNotInitialisedError(this.moduleName);
    }
    const updatedAt = row.updated_at;
    return {
      module: this.moduleName,
      state: row.state,
      updatedAt:
        updatedAt === null || updatedAt === undefined
          ? null
          : updatedAt instanceof Date
            ? updatedAt.toISOString()
            : new Date(updatedAt).toISOString(),
    };
  }
}
