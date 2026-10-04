export const EVENT_EXCHANGE = 'skillswap.events';
export const CONSUMER_PREFETCH = 20;
export const RETRY_QUEUE_TTL_MS = 5000;
export const TRANSIENT_RETRY_DELAY_MS = 5000;
export const PUBLISH_TIMEOUT_MS = 10000;

export const OUTBOX_TABLE = 'outbox_messages';
export const PROCESSED_EVENTS_TABLE = 'processed_events';
export const MODULE_STATUS_TABLE = 'module_status';
export const MIGRATIONS_TABLE = 'schema_migrations';
export const MODULE_STATUS_ID = 1;

export type OutboxStatus = 'PENDING' | 'PUBLISHED' | 'DEAD';
export type ProcessedEventStatus = 'PROCESSING' | 'DONE' | 'FAILED';
