import { deviceSubscriptionSchema, notificationsPageSchema, type DeviceSubscription, type ListNotificationsQuery, type NotificationsPage, type UpsertDeviceInput } from '@skillswap/contracts';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import { DEFAULT_NOTIFICATION_LOCALE, notificationCopy, type NotificationLocale } from '../../../application/notification-copy';
import type { NotificationManagementPort, RecordInboxNotification } from '../../../application/port/notification-management';

interface RawDevice { id: string; installation_id: string; platform: string; is_active: boolean; created_at: Date | string }
interface RawNotification { id: string; type: string; title: string; body: string; target_type: string; target_id: string; read: boolean; created_at: Date | string }
interface CountRow { count: string | number }
interface LocaleRow { locale: string }
function iso(value: Date | string): string { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
function encodeCursor(createdAt: string, id: string): string { return Buffer.from(`${createdAt}|${id}`).toString('base64url'); }

/**
 * B7 / defect #3: the language an inbox row is rendered in.
 *
 * Three sources, in this order of authority:
 *
 *  1. **The caller's `Accept-Language`.** The inbox is read by a person looking at a
 *     screen, and the screen states its language. Honouring the request is what makes
 *     `/en/notifications` read as English.
 *  2. **The account's most recently updated active device.** Still the right answer for
 *     a push-only client that reads its inbox natively, because there is no header to
 *     consult.
 *  3. **`en`.** Previously `vi`, which meant an account with no registered device — every
 *     web-only account, since the web client registers none — had its inbox rendered in
 *     Vietnamese regardless of the screen it was on. `en` is the product's own
 *     `routing.defaultLocale`, so the fallback now agrees with the app's default rather
 *     than contradicting it.
 */
type Locale = NotificationLocale;
const DEFAULT_LOCALE: Locale = DEFAULT_NOTIFICATION_LOCALE;

/** Account-owned notification storage adapter; all reads are owner-filtered. */
export class SqlNotificationManagement implements NotificationManagementPort {
  constructor(private readonly registry: ModuleDataSourceRegistry, private readonly moduleName: string) {}
  private get schema(): string { return this.registry.getSchema(this.moduleName); }

  /**
   * FR-016: the caller's inbox, with `title`/`body` resolved in **their** language at read time.
   *
   * B7: the copy used to be frozen at write time with an English-only switch, so the same event
   * arrived as a Vietnamese push and an English inbox row. Nothing about the row depends on who
   * read it when it was written, so the language belongs to the read.
   */
  async list(accountId: string, query: ListNotificationsQuery, cursor?: readonly [Date, string], requestLocale?: Locale): Promise<NotificationsPage> {
    const source = this.registry.get(this.moduleName);
    const inbox = qualified(this.schema, 'inbox_notifications');
    const params: unknown[] = [accountId];
    const where = ['"account_id" = $1'];
    if (query.unreadOnly) where.push('"read" = false');
    if (cursor) { params.push(cursor[0].toISOString(), cursor[1]); where.push(`("created_at", "id"::text) < ($${params.length - 1}, $${params.length})`); }
    params.push(query.limit + 1);
    const rows = await source.query(`SELECT "id", "type", "title", "body", "target_type", "target_id", "read", "created_at" FROM ${inbox} WHERE ${where.join(' AND ')} ORDER BY "created_at" DESC, "id" DESC LIMIT $${params.length}`, params) as RawNotification[];
    const unreadRows = await source.query(`SELECT COUNT(*)::int AS "count" FROM ${inbox} WHERE "account_id" = $1 AND "read" = false`, [accountId]) as CountRow[];
    // Defect #3: only consult the device when the caller did not state a language.
    const locale = requestLocale ?? (await this.readLocale(accountId));
    const pageRows = rows.slice(0, query.limit);
    const last = pageRows[pageRows.length - 1];
    const nextCursor = rows.length > query.limit && last ? encodeCursor(iso(last.created_at), last.id) : null;
    return notificationsPageSchema.parse({
      items: pageRows.map((r) => {
        // B7: reader's language first, then `en`, then whatever was stored at write time. The last
        // step is unreachable for the six contract types — it exists so a future type cannot render
        // `undefined` into a NOT NULL field.
        const copy = notificationCopy(r.type, locale) ?? notificationCopy(r.type, 'en');
        return {
          id: r.id, type: r.type,
          title: copy?.title ?? r.title,
          body: copy?.body ?? r.body,
          targetType: r.target_type, targetId: r.target_id, read: r.read, createdAt: iso(r.created_at),
        };
      }),
      nextCursor, unreadCount: Number(unreadRows[0]?.count ?? 0),
    });
  }

  /**
   * The account's speaking language, for callers that did not state one: their most
   * recently updated active device. An unsupported or missing value falls through to
   * `en`.
   */
  private async readLocale(accountId: string): Promise<Locale> {
    const devices = qualified(this.schema, 'notification_devices');
    const rows = (await this.registry.get(this.moduleName).query(
      `SELECT "locale" FROM ${devices}
        WHERE "account_id" = $1 AND "is_active" = true
        ORDER BY "updated_at" DESC, "id" DESC
        LIMIT 1`,
      [accountId],
    )) as LocaleRow[];
    const locale = rows[0]?.locale;
    // Was `locale === 'en' ? 'en' : DEFAULT_LOCALE`, which only worked while the
    // default was `vi`. Naming both supported values keeps a `vi` device Vietnamese
    // now that the fallback is English.
    return locale === 'vi' || locale === 'en' ? locale : DEFAULT_LOCALE;
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
        const result = returnedRows<RawDevice>(await manager.query(`UPDATE ${table} SET "account_id" = $2, "token" = $3, "platform" = $4, "installation_id" = $5, "app_version" = $6, "locale" = COALESCE($7, "locale"), "is_active" = true, "updated_at" = now() WHERE "id" = $1 RETURNING "id", "installation_id", "platform", "is_active", "created_at"`, [deviceId, accountId, input.token, input.platform, input.installationId, input.appVersion ?? null, input.locale ?? null]));
        return deviceSubscriptionSchema.parse({ id: result[0]!.id, installationId: result[0]!.installation_id, platform: result[0]!.platform, isActive: result[0]!.is_active, createdAt: iso(result[0]!.created_at) });
      }
      const result = returnedRows<RawDevice>(await manager.query(`INSERT INTO ${table} ("account_id", "token", "platform", "installation_id", "app_version", "locale") VALUES ($1,$2,$3,$4,$5,COALESCE($6, 'vi')) RETURNING "id", "installation_id", "platform", "is_active", "created_at"`, [accountId, input.token, input.platform, input.installationId, input.appVersion ?? null, input.locale ?? null]));
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

  /**
   * B6: one `UPDATE … WHERE account_id = $1 AND id = $2`. Ownership is part of the WHERE clause,
   * never a prior SELECT — a two-step read-then-write would leak the existence of another
   * account's notification through a different answer for "not yours" and "not there".
   */
  async markRead(accountId: string, id: string): Promise<number | null> {
    const source = this.registry.get(this.moduleName);
    const inbox = qualified(this.schema, 'inbox_notifications');
    const updated = returnedRows<{ id: string }>(await source.query(
      `UPDATE ${inbox} SET "read" = true WHERE "id" = $1 AND "account_id" = $2 RETURNING "id"`,
      [id, accountId],
    ));
    if (updated.length === 0) return null;
    const counts = await source.query(`SELECT COUNT(*)::int AS "count" FROM ${inbox} WHERE "account_id" = $1 AND "read" = false`, [accountId]) as CountRow[];
    return Number(counts[0]?.count ?? 0);
  }

  /** B6: one statement for the whole inbox; the remaining unread count is 0 by construction. */
  async markAllRead(accountId: string): Promise<number> {
    const inbox = qualified(this.schema, 'inbox_notifications');
    await this.registry.get(this.moduleName).query(
      `UPDATE ${inbox} SET "read" = true WHERE "account_id" = $1 AND "read" = false`,
      [accountId],
    );
    return 0;
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
      // B7: the columns are NOT NULL and stay for compatibility, so they still need a value. Store
      // the `en` copy through the **same** function the read path uses — never a second switch, and
      // never the text a client is expected to render (that is resolved per reader at read time).
      const copy = notificationCopy(notification.type, 'en');
      const created = returnedRows<{ id: string }>(await manager.query(
        `INSERT INTO ${inbox} ("account_id", "deduplication_key", "type", "title", "body", "target_type", "target_id") VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT ("deduplication_key") DO NOTHING RETURNING "id"`,
        [notification.accountId, dedupeKey, notification.type, copy?.title ?? notification.type, copy?.body ?? notification.type, notification.targetType, notification.targetId],
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
