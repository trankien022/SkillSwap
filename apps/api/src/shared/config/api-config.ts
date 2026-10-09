import { Injectable } from '@nestjs/common';
import { isAbsolute, resolve } from 'node:path';

export type AuthMode = 'off' | 'strict';

function readString(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw === '' ? fallback : raw;
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid integer for ${name}: ${raw}`);
  }
  return parsed;
}

function snake(value: string): string {
  return value.toUpperCase().replace(/-/g, '_');
}

/**
 * The single accessor for process.env (ADR-009: nothing else reads env vars).
 * Instantiated by Nest after `bootstrap/init-env.ts` has loaded `.env`.
 */
@Injectable()
export class ApiConfig {
  readonly databaseHost: string;
  readonly databasePort: number;
  readonly databaseName: string;
  readonly databasePassword: string;
  readonly rabbitmqUrl: string;
  readonly outboxPollIntervalMs: number;
  readonly outboxBatchSize: number;
  readonly maxDeliveryAttempts: number;
  readonly apiPort: number;
  readonly authMode: AuthMode;
  readonly jwtPrivateKeyPath: string;
  readonly accessTokenTtlSeconds: number;
  readonly paymentWebhookSecret: string;
  readonly logLevel: string;

  constructor() {
    this.databaseHost = readString('DATABASE_HOST', 'localhost');
    this.databasePort = readInt('DATABASE_PORT', 5432);
    this.databaseName = readString('DATABASE_NAME', 'skillswap');
    this.databasePassword = readString('DATABASE_PASSWORD', 'skillswap_dev');
    this.rabbitmqUrl = readString('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672');
    this.outboxPollIntervalMs = readInt('OUTBOX_POLL_INTERVAL_MS', 2000);
    this.outboxBatchSize = readInt('OUTBOX_BATCH_SIZE', 20);
    this.maxDeliveryAttempts = readInt('MAX_DELIVERY_ATTEMPTS', 5);
    this.apiPort = readInt('API_PORT', 4001);
    this.logLevel = readString('LOG_LEVEL', 'info');

    const authMode = readString('AUTH_MODE', 'off');
    if (authMode !== 'off' && authMode !== 'strict') {
      throw new Error(`Invalid AUTH_MODE: ${authMode} (expected "off" or "strict")`);
    }
    this.authMode = authMode;

    const keyPath = readString('JWT_PRIVATE_KEY_PATH', '../../.secrets/jwt-private.pem');
    this.jwtPrivateKeyPath = isAbsolute(keyPath) ? keyPath : resolve(process.cwd(), keyPath);
    this.accessTokenTtlSeconds = readInt('ACCESS_TOKEN_TTL_SECONDS', 900);
    this.paymentWebhookSecret = readString('PAYMENT_WEBHOOK_SECRET', 'dev-webhook-secret');
  }

  /** Per-schema credentials (ADR-007): DATABASE_<SCHEMA>_USER / _PASSWORD. */
  databaseCredentials(schema: string): { user: string; password: string } {
    const suffix = snake(schema);
    return {
      user: readString(`DATABASE_${suffix}_USER`, `skillswap_${schema}`),
      password: readString(`DATABASE_${suffix}_PASSWORD`, this.databasePassword),
    };
  }
}
