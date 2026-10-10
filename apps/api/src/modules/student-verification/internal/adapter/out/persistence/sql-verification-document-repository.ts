import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import type {
  CreateDocumentRequest,
  DocumentStatus,
  VerificationDocument,
  VerificationDocumentRepository,
} from '../../../application/port/out/verification-document-repository';

interface DocumentRow {
  id: string;
  account_id: string;
  object_key: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  status: string;
  created_at: Date | string;
}

function toDomain(row: DocumentRow): VerificationDocument {
  return {
    id: row.id,
    accountId: row.account_id,
    objectKey: row.object_key,
    fileName: row.file_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    status: row.status as DocumentStatus,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

const SELECT_COLUMNS =
  '"id", "account_id", "object_key", "file_name", "content_type", "size_bytes", "status", "created_at"';

export class SqlVerificationDocumentRepository implements VerificationDocumentRepository {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get table(): string {
    return qualified(this.registry.getSchema(this.moduleName), 'verification_documents');
  }

  async create(request: CreateDocumentRequest): Promise<VerificationDocument> {
    const source = this.registry.get(this.moduleName);
    const rows = returnedRows<DocumentRow>(
      await source.query(
        `INSERT INTO ${this.table}
           ("id", "account_id", "object_key", "file_name", "content_type", "size_bytes", "status")
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING ${SELECT_COLUMNS}`,
        [
          request.id,
          request.accountId,
          request.objectKey,
          request.fileName,
          request.contentType,
          request.sizeBytes,
        ],
      ),
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Failed to insert verification document');
    }
    return toDomain(row);
  }

  async findById(documentId: string): Promise<VerificationDocument | null> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT ${SELECT_COLUMNS} FROM ${this.table} WHERE "id" = $1`,
      [documentId],
    )) as DocumentRow[];
    return rows[0] === undefined ? null : toDomain(rows[0]);
  }

  async attach(documentId: string, accountId: string): Promise<boolean> {
    const source = this.registry.get(this.moduleName);
    const rows = returnedRows<{ id: string }>(
      await source.query(
        `UPDATE ${this.table} SET "status" = 'attached', "updated_at" = now()
          WHERE "id" = $1 AND "account_id" = $2 AND "status" = 'pending'
          RETURNING "id"`,
        [documentId, accountId],
      ),
    );
    return rows.length > 0;
  }
}
