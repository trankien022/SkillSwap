import { TableColumn, type MigrationInterface, type QueryRunner } from 'typeorm';
import { notificationDeviceLocaleColumn } from '../notification-device-locale.entity';
import { SCHEMA } from '../schema';

/** Generated from notificationDeviceLocaleColumn; additive, preserving subscriptions. */
export class AddNotificationDeviceLocale1791072000008 implements MigrationInterface {
  name = 'AddNotificationDeviceLocale1791072000008';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(`${SCHEMA}.notification_devices`, new TableColumn({
      name: notificationDeviceLocaleColumn.name!, type: 'text', isNullable: false,
      default: "'vi'",
    }));
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(`${SCHEMA}.notification_devices`, 'locale');
  }
}
