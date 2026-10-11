import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type { PublicProfile, PublicProfileReader } from '../../../../api/public-profile-reader';

interface ProfileRow {
  id: string;
  display_name: string;
}

export class SqlPublicProfileReader implements PublicProfileReader {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get table(): string {
    return qualified(this.registry.getSchema(this.moduleName), 'accounts');
  }

  async readMany(ids: readonly string[]): Promise<readonly PublicProfile[]> {
    if (ids.length === 0) {
      return [];
    }

    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) {
      return [];
    }

    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT "id", "display_name"
       FROM ${this.table}
       WHERE "id" = ANY($1::uuid[])`,
      [uniqueIds],
    )) as ProfileRow[];

    return rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
    }));
  }
}
