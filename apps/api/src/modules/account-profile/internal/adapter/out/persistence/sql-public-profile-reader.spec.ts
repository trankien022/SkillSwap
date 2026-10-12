import type { DataSource } from 'typeorm';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { SqlPublicProfileReader } from './sql-public-profile-reader';

describe('SqlPublicProfileReader', () => {
  const moduleName = 'account-profile';
  const schemaName = 'account_profile';

  function createReader(queryMock: jest.Mock = jest.fn()): {
    reader: SqlPublicProfileReader;
    queryMock: jest.Mock;
    getMock: jest.Mock;
    getSchemaMock: jest.Mock;
  } {
    const dataSourceMock = {
      query: queryMock,
    } as unknown as DataSource;

    const getMock = jest.fn().mockReturnValue(dataSourceMock);
    const getSchemaMock = jest.fn().mockReturnValue(schemaName);

    const registryMock = {
      get: getMock,
      getSchema: getSchemaMock,
    } as unknown as ModuleDataSourceRegistry;

    const reader = new SqlPublicProfileReader(registryMock, moduleName);

    return { reader, queryMock, getMock, getSchemaMock };
  }

  it('returns empty array without querying database when IDs array is empty', async () => {
    const { reader, queryMock, getMock } = createReader();

    const result = await reader.readMany([]);

    expect(result).toEqual([]);
    expect(queryMock).not.toHaveBeenCalled();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('deduplicates input IDs and executes a single parameterized query with ANY($1::uuid[])', async () => {
    const id1 = '00000000-0000-0000-0000-000000000001';
    const id2 = '00000000-0000-0000-0000-000000000002';
    const queryMock = jest.fn().mockResolvedValue([
      { id: id1, display_name: 'Teacher One' },
      { id: id2, display_name: 'Teacher Two' },
    ]);
    const { reader, queryMock: spyQuery } = createReader(queryMock);

    const result = await reader.readMany([id1, id2, id1, id2]);

    expect(result).toEqual([
      { id: id1, displayName: 'Teacher One' },
      { id: id2, displayName: 'Teacher Two' },
    ]);
    expect(spyQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = spyQuery.mock.calls[0];
    expect(sql).toContain('"account_profile"."accounts"');
    expect(sql).toContain('WHERE "id" = ANY($1::uuid[])');
    expect(params).toEqual([[id1, id2]]);
  });

  it('targets own schema using qualified convention and does not perform cross-schema queries', async () => {
    const id = '00000000-0000-0000-0000-000000000001';
    const queryMock = jest.fn().mockResolvedValue([
      { id, display_name: 'Teacher One' },
    ]);
    const { reader, getSchemaMock, queryMock: spyQuery } = createReader(queryMock);

    await reader.readMany([id]);

    expect(getSchemaMock).toHaveBeenCalledWith(moduleName);
    const [sql] = spyQuery.mock.calls[0];
    expect(sql).toMatch(
      /SELECT "id", "display_name"\s+FROM "account_profile"\."accounts"\s+WHERE "id" = ANY\(\$1::uuid\[\]\)/,
    );
  });

  it('enforces output privacy by exposing ONLY id and displayName (no email or private fields)', async () => {
    const id = '00000000-0000-0000-0000-000000000001';
    const queryMock = jest.fn().mockResolvedValue([
      {
        id,
        display_name: 'Teacher Private',
        email: 'secret@university.edu.vn',
        role: 'teacher',
        status: 'active',
        created_at: new Date(),
        verification_status: 'approved',
      },
    ]);
    const { reader } = createReader(queryMock);

    const result = await reader.readMany([id]);

    expect(result).toEqual([{ id, displayName: 'Teacher Private' }]);
    expect(result[0]).not.toHaveProperty('email');
    expect(result[0]).not.toHaveProperty('role');
    expect(result[0]).not.toHaveProperty('status');
    expect(result[0]).not.toHaveProperty('created_at');
    expect(result[0]).not.toHaveProperty('verification_status');
    expect(Object.keys(result[0]).sort()).toEqual(['displayName', 'id']);
  });
});
