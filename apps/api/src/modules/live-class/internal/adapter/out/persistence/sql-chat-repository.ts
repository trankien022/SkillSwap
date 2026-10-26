import { randomUUID } from 'node:crypto';
import { chatMessageSchema, type ChatMessageView } from '@skillswap/contracts';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import type {
  ChatCursorParts,
  ChatRepository,
  ListMessagesCriteria,
  ListMessagesResult,
  NewChatMessage,
} from '../../../application/port/out/chat-repository';

interface ChatMessageRow {
  id: string;
  class_id: string;
  booking_id: string;
  sender_id: string;
  sender_role: string;
  body: string;
  created_at: Date | string;
}

interface CountRow {
  count: number | string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toView(row: ChatMessageRow): ChatMessageView {
  return chatMessageSchema.parse({
    id: row.id,
    classId: row.class_id,
    bookingId: row.booking_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    body: row.body,
    createdAt: toIso(row.created_at),
  });
}

/**
 * FR-012 / ADR-036: the append-only chat log, confined to the `live_class` schema (ADR-014).
 *
 * Ordered **oldest first**, matching `chatMessagesPageSchema`: a conversation reads top to bottom,
 * and a polling client appends the tail. Keyset pagination uses `>` on the `(created_at, id)` pair,
 * so `nextCursor` walks forward in time and the client never re-reads a page.
 */
export class SqlChatRepository implements ChatRepository {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get schema(): string {
    return this.registry.getSchema(this.moduleName);
  }

  async append(message: NewChatMessage): Promise<ChatMessageView> {
    const source = this.registry.get(this.moduleName);
    const messages = qualified(this.schema, 'chat_messages');

    const rows = returnedRows<ChatMessageRow>(
      await source.query(
        `INSERT INTO ${messages}
           ("id", "class_id", "booking_id", "sender_id", "sender_role", "body")
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING "id", "class_id", "booking_id", "sender_id", "sender_role", "body", "created_at"`,
        [
          randomUUID(),
          message.classId,
          message.bookingId,
          message.senderId,
          message.senderRole,
          message.body,
        ],
      ),
    );

    const row = rows[0];
    if (row === undefined) {
      // An INSERT that returns no row is a bug in this adapter, not a caller error. Failing loudly
      // beats returning a fabricated message that the client would render and the next read
      // would never contain.
      throw new Error('Chat message insert returned no row');
    }
    return toView(row);
  }

  async list(criteria: ListMessagesCriteria): Promise<ListMessagesResult> {
    const source = this.registry.get(this.moduleName);
    const messages = qualified(this.schema, 'chat_messages');

    const conditions: string[] = ['c."class_id" = $1'];
    const params: unknown[] = [criteria.classId];

    if (criteria.cursor !== null) {
      params.push(criteria.cursor.createdAt.toISOString(), criteria.cursor.id);
      conditions.push(
        `(c."created_at", c."id") > ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
      );
    }

    params.push(criteria.limit + 1);
    const limitIdx = params.length;

    const rows = (await source.query(
      `SELECT c."id", c."class_id", c."booking_id", c."sender_id", c."sender_role",
              c."body", c."created_at"
         FROM ${messages} c
        WHERE ${conditions.join(' AND ')}
        ORDER BY c."created_at" ASC, c."id" ASC
        LIMIT $${limitIdx}`,
      params,
    )) as ChatMessageRow[];

    // The total ignores the cursor, or the count would shrink as the client pages and NFR-014's
    // `total` would stop meaning "rows matching the filters".
    const countRows = (await source.query(
      `SELECT COUNT(*)::int AS "count" FROM ${messages} c WHERE c."class_id" = $1`,
      [criteria.classId],
    )) as CountRow[];

    const hasMore = rows.length > criteria.limit;
    const pageRows = hasMore ? rows.slice(0, criteria.limit) : rows;
    const items = pageRows.map(toView);

    const last = pageRows[pageRows.length - 1];
    const nextCursor: ChatCursorParts | null =
      hasMore && last !== undefined
        ? { createdAt: new Date(toIso(last.created_at)), id: last.id }
        : null;

    return { items, nextCursor, total: Number(countRows[0]?.count ?? 0) };
  }
}
