import type { DataSource, EntityManager } from 'typeorm';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { SqlNotificationManagement } from './sql-notification-management';

describe('SqlNotificationManagement', () => {
  const manager = { query: jest.fn() } as unknown as EntityManager;
  const source = { query: jest.fn(), transaction: jest.fn(async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager)) } as unknown as DataSource;
  const registry = { get: jest.fn().mockReturnValue(source), getSchema: jest.fn().mockReturnValue('account_profile') } as unknown as ModuleDataSourceRegistry;
  const repository = new SqlNotificationManagement(registry, 'account-profile');
  beforeEach(() => { jest.clearAllMocks(); });

  it('returns owner-scoped notifications with an exact unread count', async () => {
    (source.query as jest.Mock)
      .mockResolvedValueOnce([{ id: 'n1', type: 'booking_confirmed', title: 'Booking confirmed', body: 'Ready', target_type: 'booking', target_id: 'b1', read: false, created_at: new Date('2026-10-20T10:00:00.000Z') }])
      .mockResolvedValueOnce([{ count: '3' }]);
    const page = await repository.list('account-1', { limit: 20 });
    expect(page.items).toHaveLength(1);
    expect(page.unreadCount).toBe(3);
    expect((source.query as jest.Mock).mock.calls[0][0]).toContain('"account_id" = $1');
    expect((source.query as jest.Mock).mock.calls[0][1][0]).toBe('account-1');
  });

  it('upserts an existing installation onto the current account and deactivates only owned devices', async () => {
    (manager.query as jest.Mock)
      .mockResolvedValueOnce([{ id: 'device-1' }])
      .mockResolvedValueOnce([{ id: 'device-1', installation_id: 'install-1', platform: 'ios', is_active: true, created_at: new Date('2026-10-20T10:00:00.000Z') }]);
    const result = await repository.upsertDevice('account-2', { token: 'ExponentPushToken[x]', platform: 'ios', installationId: 'install-1' });
    expect(result).toMatchObject({ id: 'device-1', installationId: 'install-1', isActive: true });
    expect((manager.query as jest.Mock).mock.calls[1][1][1]).toBe('account-2');
    await repository.deleteDevice('account-2', 'device-1');
    expect((source.query as jest.Mock).mock.calls[0][1]).toEqual(['device-1', 'account-2']);
  });
});
