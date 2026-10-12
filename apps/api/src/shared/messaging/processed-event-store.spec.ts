import { PostgresProcessedEventStore } from './processed-event-store';
import type { ModuleDataSourceRegistry } from './module-registry';

describe('PostgresProcessedEventStore', () => {
  it('deduplicates within one queue while allowing another queue to handle the same event', async () => {
    const statuses = new Map<string, string>();
    const source = {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        const id = String(params[0]);
        if (sql.startsWith('INSERT')) {
          if (statuses.has(id)) return [];
          statuses.set(id, 'PROCESSING');
          return [{ id }];
        }
        if (sql.startsWith('SELECT')) return [{ status: statuses.get(id) }];
        if (sql.includes("status = 'DONE'")) {
          statuses.set(id, 'DONE');
          return [];
        }
        return [];
      }),
    };
    const registry = {
      get: jest.fn(() => source),
      getSchema: jest.fn(() => 'account_profile'),
    } as unknown as ModuleDataSourceRegistry;
    const store = new PostgresProcessedEventStore(registry);
    const projectionHandler = jest.fn(async () => undefined);
    const notificationHandler = jest.fn(async () => undefined);

    await store.runOnce('account-profile', 'account-profile.student-verification-approved', 'event-1', projectionHandler);
    await store.runOnce('account-profile', 'account-profile.student-verification-approved', 'event-1', projectionHandler);
    await store.runOnce('account-profile', 'account-profile.notification-student-verification-approved', 'event-1', notificationHandler);

    expect(projectionHandler).toHaveBeenCalledTimes(1);
    expect(notificationHandler).toHaveBeenCalledTimes(1);
  });
});
