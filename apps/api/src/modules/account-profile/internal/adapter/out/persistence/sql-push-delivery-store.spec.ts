import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { SqlPushDeliveryStore } from './sql-push-delivery-store';

describe('SqlPushDeliveryStore account association', () => {
  it('fails queued deliveries for inactive or rebound devices before claiming', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const registry = { ready: Promise.resolve(), get: () => ({ query }), getSchema: () => 'account_profile' } as unknown as ModuleDataSourceRegistry;
    await expect(new SqlPushDeliveryStore(registry, 'account-profile').claimDueDeliveries(10, 60)).resolves.toEqual([]);
    expect(query.mock.calls[0][0]).toContain('d."account_id" <> n."account_id"');
    expect(query.mock.calls[0][0]).toContain('d."is_active" = false');
    expect(query.mock.calls[2][0]).toContain('n."account_id" = d."account_id"');
  });

  it('retains the current receiving device locale and account-scoped payload', async () => {
    const query = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([{
      delivery_id: 'job', notification_id: 'notification', device_id: 'device', token: 'test-token',
      type: 'booking_cancelled', locale: 'en', title: 'Title', body: 'Body', target_type: 'booking', target_id: 'booking', attempts: 1,
    }]);
    const registry = { ready: Promise.resolve(), get: () => ({ query }), getSchema: () => 'account_profile' } as unknown as ModuleDataSourceRegistry;
    const rows = await new SqlPushDeliveryStore(registry, 'account-profile').claimDueDeliveries(10, 60);
    expect(rows).toEqual([expect.objectContaining({ deliveryId: 'job', locale: 'en', targetId: 'booking' })]);
    expect(query.mock.calls[2][1]).toEqual([10, 60]);
  });
});
