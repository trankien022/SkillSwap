import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import type { PushDelivery, PushDeliveryStorePort, PushReceiptCheck } from '../../../application/port/push-delivery-store';

interface RawDelivery {
  delivery_id: string; notification_id: string; device_id: string; token: string; type: string;
  title: string; body: string; target_type: string; target_id: string; attempts: number; locale: 'vi' | 'en';
}
interface RawReceipt { delivery_id: string; device_id: string; ticket_id: string; receipt_attempts: number }

/** Persistence for leased Expo deliveries, scoped only to account_profile. */
export class SqlPushDeliveryStore implements PushDeliveryStorePort {
  constructor(private readonly registry: ModuleDataSourceRegistry, private readonly moduleName: string) {}
  private get schema(): string { return this.registry.getSchema(this.moduleName); }
  private get deliveries(): string { return qualified(this.schema, 'push_deliveries'); }
  private get devices(): string { return qualified(this.schema, 'notification_devices'); }
  private get inbox(): string { return qualified(this.schema, 'inbox_notifications'); }

  async claimDueDeliveries(limit: number, leaseSeconds: number): Promise<PushDelivery[]> {
    await this.registry.ready;
    await this.registry.get(this.moduleName).query(
      `UPDATE ${this.deliveries} p SET "status" = 'failed', "lease_expires_at" = NULL,
        "last_error" = 'Device subscription is inactive or rebound', "updated_at" = now()
       WHERE p."status" IN ('pending','sending') AND EXISTS (
         SELECT 1 FROM ${this.devices} d JOIN ${this.inbox} n ON n."id" = p."notification_id"
         WHERE d."id" = p."device_id" AND (d."is_active" = false OR d."account_id" <> n."account_id")
       )`,
    );
    await this.registry.get(this.moduleName).query(
      `UPDATE ${this.deliveries} SET "status" = 'failed', "lease_expires_at" = NULL,
        "last_error" = 'Push lease expired after maximum attempts', "updated_at" = now()
       WHERE "status" = 'sending' AND "lease_expires_at" <= now() AND "attempts" >= 5`,
    );
    const rows = returnedRows<RawDelivery>(await this.registry.get(this.moduleName).query(
      `WITH due AS (
        SELECT "id" FROM ${this.deliveries}
        WHERE (("status" = 'pending' AND "next_attempt_at" <= now())
          OR ("status" = 'sending' AND "lease_expires_at" <= now()))
          AND "attempts" < 5
        ORDER BY "next_attempt_at", "created_at", "id"
        FOR UPDATE SKIP LOCKED LIMIT $1
      ), claimed AS (
        UPDATE ${this.deliveries} d SET "status" = 'sending', "attempts" = d."attempts" + 1,
          "lease_expires_at" = now() + make_interval(secs => $2), "updated_at" = now()
        FROM due WHERE d."id" = due."id"
        RETURNING d."id", d."notification_id", d."device_id", d."attempts"
      )
      SELECT c."id" AS "delivery_id", c."notification_id", c."device_id", d."token", d."locale",
        n."type", n."title", n."body", n."target_type", n."target_id", c."attempts"
      FROM claimed c JOIN ${this.devices} d ON d."id" = c."device_id" AND d."is_active" = true
      JOIN ${this.inbox} n ON n."id" = c."notification_id" AND n."account_id" = d."account_id"`, [limit, leaseSeconds],
    ));
    return rows.map((row) => ({
      deliveryId: row.delivery_id, notificationId: row.notification_id, deviceId: row.device_id,
      locale: row.locale, token: row.token, type: row.type, title: row.title, body: row.body,
      targetType: row.target_type, targetId: row.target_id, attempts: Number(row.attempts),
    }));
  }

  async acceptTicket(deliveryId: string, ticketId: string, receiptDelayMs: number): Promise<void> {
    await this.registry.ready;
    await this.registry.get(this.moduleName).query(
      `UPDATE ${this.deliveries} SET "status" = 'accepted', "provider_ticket_id" = $2,
        "receipt_status" = NULL, "receipt_attempts" = 0,
        "next_receipt_at" = now() + ($3 * interval '1 millisecond'), "lease_expires_at" = NULL,
        "last_error" = NULL, "updated_at" = now() WHERE "id" = $1`, [deliveryId, ticketId, receiptDelayMs],
    );
  }

  async retryDelivery(deliveryId: string, message: string, delayMs: number, maxAttempts: number): Promise<void> {
    await this.registry.ready;
    await this.registry.get(this.moduleName).query(
      `UPDATE ${this.deliveries} SET "status" = CASE WHEN "attempts" >= $4 THEN 'failed' ELSE 'pending' END,
        "next_attempt_at" = now() + ($3 * interval '1 millisecond'), "lease_expires_at" = NULL,
        "last_error" = left($2, 500), "updated_at" = now() WHERE "id" = $1`,
      [deliveryId, message, delayMs, maxAttempts],
    );
  }

  async failDelivery(deliveryId: string, message: string): Promise<void> {
    await this.registry.ready;
    await this.registry.get(this.moduleName).query(
      `UPDATE ${this.deliveries} SET "status" = 'failed', "lease_expires_at" = NULL,
        "last_error" = left($2, 500), "updated_at" = now() WHERE "id" = $1`, [deliveryId, message],
    );
  }

  async claimDueReceipts(limit: number, leaseSeconds: number): Promise<PushReceiptCheck[]> {
    await this.registry.ready;
    await this.registry.get(this.moduleName).query(
      `UPDATE ${this.deliveries} SET "receipt_status" = 'error', "lease_expires_at" = NULL,
        "last_error" = 'Receipt lease expired after maximum attempts', "updated_at" = now()
       WHERE "status" = 'accepted' AND "receipt_status" IS NULL AND "lease_expires_at" <= now() AND "receipt_attempts" >= 5`,
    );
    const rows = returnedRows<RawReceipt>(await this.registry.get(this.moduleName).query(
      `WITH due AS (
        SELECT "id" FROM ${this.deliveries}
        WHERE "status" = 'accepted' AND "provider_ticket_id" IS NOT NULL AND "receipt_status" IS NULL
          AND "next_receipt_at" <= now() AND ("lease_expires_at" IS NULL OR "lease_expires_at" <= now())
          AND "receipt_attempts" < 5
        ORDER BY "next_receipt_at", "created_at", "id"
        FOR UPDATE SKIP LOCKED LIMIT $1
      )
      UPDATE ${this.deliveries} d SET "receipt_attempts" = d."receipt_attempts" + 1,
        "lease_expires_at" = now() + make_interval(secs => $2), "updated_at" = now()
      FROM due WHERE d."id" = due."id"
      RETURNING d."id" AS "delivery_id", d."device_id", d."provider_ticket_id" AS "ticket_id", d."receipt_attempts"`,
      [limit, leaseSeconds],
    ));
    return rows.map((row) => ({
      deliveryId: row.delivery_id, deviceId: row.device_id, ticketId: row.ticket_id,
      receiptAttempts: Number(row.receipt_attempts),
    }));
  }

  async recordReceipt(deliveryId: string, status: 'ok' | 'error', message?: string): Promise<void> {
    await this.registry.ready;
    await this.registry.get(this.moduleName).query(
      `UPDATE ${this.deliveries} SET "receipt_status" = $2, "lease_expires_at" = NULL,
        "last_error" = $3, "updated_at" = now() WHERE "id" = $1`,
      [deliveryId, status, message ? message.slice(0, 500) : null],
    );
  }

  async retryReceipt(deliveryId: string, message: string, delayMs: number, maxAttempts: number): Promise<void> {
    await this.registry.ready;
    await this.registry.get(this.moduleName).query(
      `UPDATE ${this.deliveries} SET "receipt_status" = CASE WHEN "receipt_attempts" >= $4 THEN 'error' ELSE NULL END,
        "next_receipt_at" = now() + ($3 * interval '1 millisecond'), "lease_expires_at" = NULL,
        "last_error" = left($2, 500), "updated_at" = now() WHERE "id" = $1`,
      [deliveryId, message, delayMs, maxAttempts],
    );
  }

  async deactivateDevice(deviceId: string): Promise<void> {
    await this.registry.ready;
    await this.registry.get(this.moduleName).query(
      `UPDATE ${this.devices} SET "is_active" = false, "updated_at" = now() WHERE "id" = $1`, [deviceId],
    );
  }
}
