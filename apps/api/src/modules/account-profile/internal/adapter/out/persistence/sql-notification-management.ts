import { deviceSubscriptionSchema, notificationsPageSchema, type DeviceSubscription, type ListNotificationsQuery, type NotificationsPage, type UpsertDeviceInput } from '@skillswap/contracts';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import type { NotificationManagementPort, RecordInboxNotification } from '../../../application/port/notification-management';

interface RawDevice { id: string; installation_id: string; platform: string; is_active: boolean; created_at: Date | string }
interface RawNotification { id: string; type: string; title: string; body: string; target_type: string; target_id: string; read: boolean; created_at: Date | string }
interface CountRow { count: string | number }
function iso(value: Date | string): string { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
function encodeCursor(createdAt: string, id: string): string { return Buffer.from(`${createdAt}|${id}`).toString('base64url'); }
function notificationCopy(type: RecordInboxNotification['type']): { title: string; body: string } {
  switch (type) {
    case 'booking_cancelled': return { title: 'Class booking updated', body: 'A teacher canceled a class you booked. Open your schedule to review the booking and wallet.' };
    case 'booking_confirmed': return { title: 'Booking confirmed', body: 'Your class booking is confirmed. Open your schedule to view the details.' };
    case 'verification_outcome': return { title: 'Verification updated', body: 'Your verification status changed. Open SkillSwap to review the result.' };
    case 'wallet_transaction': return { title: 'Wallet updated', body: 'A wallet transaction completed. Open your wallet to review the balance and history.' };
    case 'class_starting_soon': return { title: 'Class starting soon', body: 'Your class is starting soon. Open your schedule to review the class.' };
    case 'withdrawal_outcome': return { title: 'Withdrawal updated', body: 'Your withdrawal status changed. Open your wallet to review the result.' };
  }
}

/** Account-owned notification storage adapter; all reads are owner-filtered. */
export class SqlNotificationManagement implements NotificationManagementPort {
  constructor(private readonly registry: ModuleDataSourceRegistry, private readonly moduleName: string) {}
  private get schema(): string { return this.registry.getSchema(this.moduleName); }

  async list(accountId: string, query: ListNotificationsQuery, cursor?: readonly [Date, string]): Promise<NotificationsPage> {
    const source = this.registry.get(this.moduleName);
    const inbox = qualified(this.schema, 'inbox_notifications');
    const params: unknown[] = [accountId];
    const where = ['"account_id" = $1'];
    if (query.unreadOnly) where.push('"read" = false');
    if (cursor) { params.push(cursor[0].toISOString(), cursor[1]); where.push(`("created_at", "id"::text) < ($${params.length - 1}, $${params.length})`); }
    params.push(query.limit + 1);
    const rows = await source.query(`SELECT "id", "type", "title", "body", "target_type", "target_id", "read", "created_at" FROM ${inbox} WHERE ${where.join(' AND ')} ORDER BY "created_at" DESC, "id" DESC LIMIT $${params.length}`, params) as RawNotification[];
    const unreadRows = await source.query(`SELECT COUNT(*)::int AS "count" FROM ${inbox} WHERE "account_id" = $1 AND "read" = false`, [accountId]) as CountRow[];
    const pageRows = rows.slice(0, query.limit);
    const last = pageRows[pageRows.length - 1];
    const nextCursor = rows.length > query.limit && last ? encodeCursor(iso(last.created_at), last.id) : null;
    return notificationsPageSchema.parse({
      items: pageRows.map((r) => ({ id: r.id, type: r.type, title: r.title, body: r.body, targetType: r.target_type, targetId: r.target_id, read: r.read, createdAt: iso(r.created_at) })),
      nextCursor, unreadCount: Number(unreadRows[0]?.count ?? 0),
    });
  }

  async upsertDevice(accountId: string, input: UpsertDeviceInput): Promise<DeviceSubscription> {
    const source = this.registry.get(this.moduleName);
    const table = qualified(this.schema, 'notification_devices');
    return source.transaction(async (manager) => {
      const matches = await manager.query(`SELECT "id" FROM ${table} WHERE "token" = $1 OR "installation_id" = $2 FOR UPDATE`, [input.token, input.installationId]) as Array<{ id: string }>;
      const deviceId = matches.find((row) => row.id)?.id;
      if (matches.length > 1 && deviceId) {
        await manager.query(`DELETE FROM ${table} WHERE "id" = ANY($1::uuid[])`, [matches.filter((row) => row.id !== deviceId).map((row) => row.id)]);
      }
      if (deviceId) {
        const result = returnedRows<RawDevice>(await manager.query(`UPDATE ${table} SET "account_id" = $2, "token" = $3, "platform" = $4, "installation_id" = $5, "app_version" = $6, "is_active" = true, "updated_at" = now() WHERE "id" = $1 RETURNING "id", "installation_id", "platform", "is_active", "created_at"`, [deviceId, accountId, input.token, input.platform, input.installationId, input.appVersion ?? null]));
        return deviceSubscriptionSchema.parse({ id: result[0]!.id, installationId: result[0]!.installation_id, platform: result[0]!.platform, isActive: result[0]!.is_active, createdAt: iso(result[0]!.created_at) });
      }
      const result = returnedRows<RawDevice>(await manager.query(`INSERT INTO ${table} ("account_id", "token", "platform", "installation_id", "app_version") VALUES ($1,$2,$3,$4,$5) RETURNING "id", "installation_id", "platform", "is_active", "created_at"`, [accountId, input.token, input.platform, input.installationId, input.appVersion ?? null]));
      return deviceSubscriptionSchema.parse({ id: result[0]!.id, installationId: result[0]!.installation_id, platform: result[0]!.platform, isActive: result[0]!.is_active, createdAt: iso(result[0]!.created_at) });
    });
  }

  async deleteDevice(accountId: string, id: string): Promise<{ success: true }> {
    const table = qualified(this.schema, 'notification_devices');
    const deliveries = qualified(this.schema, 'push_deliveries');
    await this.registry.get(this.moduleName).transaction(async (manager) => {
      const deactivated = returnedRows<{ id: string }>(await manager.query(
        `UPDATE ${table} SET "is_active" = false, "updated_at" = now() WHERE "id" = $1 AND "account_id" = $2 RETURNING "id"`, [id, accountId],
      ));
      if (deactivated.length === 0) return;
      await manager.query(`UPDATE ${deliveries} SET "status" = 'failed', "lease_expires_at" = NULL,
        "last_error" = 'Device subscription was disabled', "updated_at" = now()
        WHERE "device_id" = $1 AND "status" IN ('pending','sending')`, [id]);
    });
    return { success: true };
  }

  async recordInboxNotification(notification: RecordInboxNotification): Promise<void> {
    const source = this.registry.get(this.moduleName);
    const processed = qualified(this.schema, 'processed_events');
    const inbox = qualified(this.schema, 'inbox_notifications');
    const dedupeKey = `${notification.eventId}:${notification.accountId}`;
    await source.transaction(async (manager) => {
      const claim = returnedRows<{ id: string }>(await manager.query(
        `INSERT INTO ${processed} ("id", "status", "processed_at") VALUES ($1, 'DONE', now()) ON CONFLICT ("id") DO NOTHING RETURNING "id"`,
        [`notification:${dedupeKey}`],
      ));
      if (claim.length === 0) return;
      const copy = notificationCopy(notification.type);
      const created = returnedRows<{ id: string }>(await manager.query(
        `INSERT INTO ${inbox} ("account_id", "deduplication_key", "type", "title", "body", "target_type", "target_id") VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT ("deduplication_key") DO NOTHING RETURNING "id"`,
        [notification.accountId, dedupeKey, notification.type, copy.title, copy.body, notification.targetType, notification.targetId],
      ));
      let notificationId = created[0]?.id;
      if (!notificationId) {
        const existing = await manager.query(`SELECT "id" FROM ${inbox} WHERE "deduplication_key" = $1`, [dedupeKey]) as Array<{ id: string }>;
        notificationId = existing[0]?.id;
      }
      if (!notificationId) throw new Error('Inbox notification insert returned no ID');
      const devices = await manager.query(`SELECT "id" FROM ${qualified(this.schema, 'notification_devices')} WHERE "account_id" = $1 AND "is_active" = true FOR SHARE`, [notification.accountId]) as Array<{ id: string }>;
      const deliveries = qualified(this.schema, 'push_deliveries');
      for (const device of devices) {
        await manager.query(`INSERT INTO ${deliveries} ("notification_id", "device_id") VALUES ($1,$2) ON CONFLICT ("notification_id", "device_id") DO NOTHING`, [notificationId, device.id]);
      }
    });
  }
}
