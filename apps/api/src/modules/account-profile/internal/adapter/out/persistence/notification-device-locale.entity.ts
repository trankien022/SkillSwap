import type { EntitySchemaColumnOptions } from 'typeorm';

/** Additive column metadata used by the generated device-locale migration. */
export const notificationDeviceLocaleColumn: EntitySchemaColumnOptions = {
  name: 'locale', type: 'text', nullable: false, default: 'vi',
};
