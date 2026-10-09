import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { insertOutboxStatement } from '../../../../../../shared/messaging/outbox-statements';
import { qualified } from '../../../../../../shared/sql/ident';
import type {
  AppendEntryRequest,
  CreditTeacherRequest,
  CreditTeacherResult,
  LedgerEntryWriter,
} from '../../../application/port/out/ledger-entry-writer';

const LEDGER_TABLE = 'ledger_entries';
const CREDITED_EVENT = 'wallet.credited';

export class SqlLedgerEntryWriter implements LedgerEntryWriter {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  async creditTeacher(request: CreditTeacherRequest): Promise<CreditTeacherResult> {
    const source = this.registry.get(this.moduleName);
    const schema = this.registry.getSchema(this.moduleName);
    const table = qualified(schema, LEDGER_TABLE);
    return source.transaction(async (manager) => {
      const inserted = (await manager.query(
        `INSERT INTO ${table} ("booking_id", "teacher_id", "amount_credits", "direction", "entry_type", "reference_id") VALUES ($1, $2, $3, 'credit', 'teacher_credit', $1) ON CONFLICT ("booking_id") DO NOTHING RETURNING "id"`,
        [request.bookingId, request.teacherId, request.amountCredits],
      )) as Array<{ id: string | number }>;
      if (inserted.length === 0) {
        return { recorded: false, amountCredits: request.amountCredits };
      }
      await manager.query(insertOutboxStatement(schema), [
        CREDITED_EVENT,
        {
          bookingId: request.bookingId,
          teacherId: request.teacherId,
          amountCredits: request.amountCredits,
          creditedAt: new Date().toISOString(),
        },
      ]);
      return { recorded: true, amountCredits: request.amountCredits };
    });
  }

  async append(request: AppendEntryRequest): Promise<void> {
    const source = this.registry.get(this.moduleName);
    const table = qualified(this.registry.getSchema(this.moduleName), LEDGER_TABLE);
    await source.query(
      `INSERT INTO ${table}
         ("booking_id", "teacher_id", "amount_credits", "direction", "entry_type", "owner_id", "reference_id", "trace_id")
       VALUES (NULL, $1, $2, $3, $4, $1, $5, $6)`,
      [
        request.ownerId,
        request.amountCredits,
        request.direction,
        request.type,
        request.referenceId,
        request.traceId,
      ],
    );
  }
}
