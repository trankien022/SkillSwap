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
      .mockResolvedValueOnce([{ count: '3' }])
      .mockResolvedValueOnce([]);
    const page = await repository.list('account-1', { limit: 20 });
    expect(page.items).toHaveLength(1);
    expect(page.unreadCount).toBe(3);
    expect((source.query as jest.Mock).mock.calls[0][0]).toContain('"account_id" = $1');
    expect((source.query as jest.Mock).mock.calls[0][1][0]).toBe('account-1');
  });

  describe('read-time copy (B7)', () => {
    const stored = {
      id: 'n1', type: 'booking_confirmed',
      // The stored columns are the write-time `en` fallback; the reader must not render them
      // when a localized copy exists.
      title: 'Booking confirmed', body: 'Your class booking is confirmed.',
      target_type: 'booking', target_id: 'b1', read: false,
      created_at: new Date('2026-10-20T10:00:00.000Z'),
    };

    it('renders Vietnamese for an account whose active device is vi', async () => {
      (source.query as jest.Mock)
        .mockResolvedValueOnce([stored])
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([{ locale: 'vi' }]);

      const page = await repository.list('account-1', { limit: 20 });

      expect(page.items[0]?.title).toBe('Đặt lớp thành công');
      expect(page.items[0]?.body).toBe('Lớp bạn đặt đã được xác nhận. Mở lịch học để xem chi tiết.');
      const [localeSql, localeParams] = (source.query as jest.Mock).mock.calls[2] as [string, unknown[]];
      expect(localeSql).toContain('"is_active" = true');
      expect(localeSql).toContain('ORDER BY "updated_at" DESC');
      expect(localeParams).toEqual(['account-1']);
    });

    it('renders English for an account whose active device is en', async () => {
      (source.query as jest.Mock)
        .mockResolvedValueOnce([stored])
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([{ locale: 'en' }]);

      const page = await repository.list('account-1', { limit: 20 });

      expect(page.items[0]?.title).toBe('Booking confirmed');
      expect(page.items[0]?.body).toBe('Your class booking is confirmed. Open your schedule to view the details.');
    });

    it('defaults to Vietnamese when the account has no active device', async () => {
      (source.query as jest.Mock)
        .mockResolvedValueOnce([stored])
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([]);

      const page = await repository.list('account-1', { limit: 20 });

      // The same default the device insert uses, so the inbox cannot disagree with the device.
      expect(page.items[0]?.title).toBe('Đặt lớp thành công');
    });

    it('ignores a device locale that is not one of the two supported languages', async () => {
      (source.query as jest.Mock)
        .mockResolvedValueOnce([stored])
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([{ locale: 'fr' }]);

      const page = await repository.list('account-1', { limit: 20 });

      expect(page.items[0]?.title).toBe('Đặt lớp thành công');
    });

    it('renders every contract notification type in both languages, with no stored text leaking', async () => {
      const types = ['booking_cancelled', 'booking_confirmed', 'verification_outcome', 'wallet_transaction', 'class_starting_soon', 'withdrawal_outcome'];
      const rows = types.map((type, index) => ({
        ...stored,
        id: `n${index}`,
        type,
        // The stored English text is deliberately a sentinel so a leak is visible.
        title: 'STORED-TITLE',
        body: 'STORED-BODY',
        created_at: new Date(Date.UTC(2026, 9, 20, 10, index)),
      }));

      for (const locale of ['vi', 'en'] as const) {
        (source.query as jest.Mock)
          .mockResolvedValueOnce(rows)
          .mockResolvedValueOnce([{ count: '6' }])
          .mockResolvedValueOnce([{ locale }]);

        const page = await repository.list('account-1', { limit: 20 });

        expect(page.items).toHaveLength(6);
        for (const item of page.items) {
          expect(item.title).not.toBe('STORED-TITLE');
          expect(item.body).not.toBe('STORED-BODY');
          expect(item.title.length).toBeGreaterThan(0);
          expect(item.body.length).toBeGreaterThan(0);
        }
      }
      // The fallback path is unreachable for these six types: the contract enum is closed, and all
      // six carry copy in both languages (`notification-copy.spec.ts`).
    });
  });

  it('stores the shared English copy for the NOT NULL compatibility columns', async () => {
    (manager.query as jest.Mock)
      .mockResolvedValueOnce([{ id: 'claim' }])
      .mockResolvedValueOnce([{ id: 'n1' }])
      .mockResolvedValueOnce([]);

    await repository.recordInboxNotification({
      eventId: 'evt-1', accountId: 'account-1', type: 'booking_confirmed',
      targetType: 'booking', targetId: 'b1',
    });

    const insertParams = (manager.query as jest.Mock).mock.calls[1][1] as unknown[];
    // B7: write time no longer decides the reader's language. It stores the `en` copy from the one
    // shared function — the same text `notificationCopy(type, 'en')` returns — and the read path
    // replaces it per reader.
    expect(insertParams[3]).toBe('Booking confirmed');
    expect(insertParams[4]).toBe('Your class booking is confirmed. Open your schedule to view the details.');
  });

  it('upserts an existing installation onto the current account and deactivates only owned devices', async () => {
    (manager.query as jest.Mock)
      .mockResolvedValueOnce([{ id: 'device-1' }])
      .mockResolvedValueOnce([{ id: 'device-1', installation_id: 'install-1', platform: 'ios', is_active: true, created_at: new Date('2026-10-20T10:00:00.000Z') }])
      .mockResolvedValueOnce([{ id: 'device-1' }])
      .mockResolvedValueOnce([]);
    const result = await repository.upsertDevice('account-2', { token: 'ExponentPushToken[x]', platform: 'ios', installationId: 'install-1' });
    expect(result).toMatchObject({ id: 'device-1', installationId: 'install-1', isActive: true });
    expect((manager.query as jest.Mock).mock.calls[1][1][1]).toBe('account-2');
    await repository.deleteDevice('account-2', 'device-1');
    expect((manager.query as jest.Mock).mock.calls[2][1]).toEqual(['device-1', 'account-2']);
    expect((manager.query as jest.Mock).mock.calls[3][1]).toEqual(['device-1']);
  });

  it('does not fail deliveries when another account tries to disable a device', async () => {
    (manager.query as jest.Mock).mockResolvedValueOnce([]);
    await repository.deleteDevice('account-attacker', 'device-owned-by-someone-else');
    expect(manager.query).toHaveBeenCalledTimes(1);
    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('RETURNING "id"'), ['device-owned-by-someone-else', 'account-attacker']);
  });

  describe('read state (B6)', () => {
    it('marks one owned row read in a single ownership-scoped UPDATE, then reports the count', async () => {
      (source.query as jest.Mock)
        .mockResolvedValueOnce([{ id: 'n1' }])
        .mockResolvedValueOnce([{ count: '2' }]);

      await expect(repository.markRead('account-a', 'n1')).resolves.toBe(2);

      const [updateSql, updateParams] = (source.query as jest.Mock).mock.calls[0] as [string, unknown[]];
      // Ownership lives in the WHERE clause. A read-then-write would let "not yours" and "not
      // there" produce different answers, which is the existence leak the 404 avoids.
      expect(updateSql).toContain('SET "read" = true');
      expect(updateSql).toContain('"id" = $1 AND "account_id" = $2');
      expect(updateParams).toEqual(['n1', 'account-a']);
      expect((source.query as jest.Mock).mock.calls[1][1]).toEqual(['account-a']);
    });

    it('reports null when the row belongs to somebody else, and counts nothing', async () => {
      (source.query as jest.Mock).mockResolvedValueOnce([]);

      await expect(repository.markRead('account-b', 'n1')).resolves.toBeNull();
      // No follow-up count for a write that touched nothing.
      expect(source.query).toHaveBeenCalledTimes(1);
      expect(source.query).toHaveBeenCalledWith(expect.stringContaining('AND "account_id" = $2'), ['n1', 'account-b']);
    });

    it('treats a second mark of the same row as still successful', async () => {
      (source.query as jest.Mock)
        .mockResolvedValueOnce([{ id: 'n1' }])
        .mockResolvedValueOnce([{ count: '2' }])
        .mockResolvedValueOnce([{ id: 'n1' }])
        .mockResolvedValueOnce([{ count: '2' }]);

      await expect(repository.markRead('account-a', 'n1')).resolves.toBe(2);
      await expect(repository.markRead('account-a', 'n1')).resolves.toBe(2);
    });

    it('clears the whole inbox with one statement and no second query', async () => {
      (source.query as jest.Mock).mockResolvedValueOnce([]);

      await expect(repository.markAllRead('account-a')).resolves.toBe(0);

      expect(source.query).toHaveBeenCalledTimes(1);
      const [sql, params] = (source.query as jest.Mock).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('SET "read" = true');
      expect(sql).toContain('"read" = false');
      expect(params).toEqual(['account-a']);
    });
  });
});
