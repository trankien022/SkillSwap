import { MODULE_STATUS_ID, MODULE_STATUS_TABLE } from '../../../../../../shared/messaging/constants';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { insertOutboxStatement } from '../../../../../../shared/messaging/outbox-statements';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import type {
  ModuleStatusTransition,
  ModuleStatusWriteInput,
  ModuleStatusWriter,
} from '../../../application/port/out/module-status-writer';
import { STATUS_CHANGED_EVENT, StatusConflictError } from '../../../domain/module-status';

export class SqlModuleStatusWriter implements ModuleStatusWriter {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  async apply(input: ModuleStatusWriteInput): Promise<ModuleStatusTransition> {
    const source = this.registry.get(this.moduleName);
    const schema = this.registry.getSchema(this.moduleName);
    const table = qualified(schema, MODULE_STATUS_TABLE);
    return source.transaction(async (manager) => {
      const updated = returnedRows<{ updated_at: Date | string }>(
        await manager.query(
          `UPDATE ${table} SET "state" = $1, "updated_at" = now() WHERE "id" = $2 AND "state" = $3 RETURNING "updated_at"`,
          [input.newState, MODULE_STATUS_ID, input.previousState],
        ),
      );
      const row = updated[0];
      if (row === undefined) {
        throw new StatusConflictError(input.previousState, input.newState);
      }
      const changedAt =
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : new Date(row.updated_at).toISOString();
      const transition: ModuleStatusTransition = {
        module: this.moduleName,
        previousState: input.previousState,
        newState: input.newState,
        changedAt,
        changedBy: input.changedBy,
      };
      await manager.query(insertOutboxStatement(schema), [STATUS_CHANGED_EVENT, transition]);
      return transition;
    });
  }
}
