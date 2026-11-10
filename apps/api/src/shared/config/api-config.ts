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

/**
 * Reads an integer that is allowed to be **zero**, refusing only negatives.
 *
 * `readInt` rejects `<= 0`, which is right for ports, ports-of-wait and intervals whose
 * zero would be a busy loop. Some settings are the opposite: `ROOM_IDLE_GRACE_MINUTES = 0`
 * is a meaningful instruction ("close as soon as everyone has gone"), and reusing `readInt`
 * would have made the documented value impossible to configure at all.
 *
 * A negative or non-numeric value still fails loudly at boot. Silently coercing a typo to a
 * plausible number is how a money path acquires a rule nobody chose.
 */
function readNonNegativeInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  // `Number`, not `parseInt`: `parseInt('1.5x')` is `1` and `parseInt('5x')` is `5`, so a
  // truncated value would be accepted as if it had been written deliberately. `Number` is
  // all-or-nothing, and the integer check below rejects a fractional grace, which would
  // otherwise be silently floored into a different rule.
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid non-negative integer for ${name}: ${raw}`);
  }
  return parsed;
}

/**
 * Reads a boolean, refusing anything that is not visibly one of the two states.
 *
 * Deliberately not `=== 'true'`: a typo'd value would then silently mean "false", and the two
 * variables this reads decide whether real credentials cross the network in plaintext. A loud
 * failure at boot is the only safe reading of an unrecognised value.
 */
function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const normalised = raw.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalised)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalised)) {
    return false;
  }
  throw new Error(`Invalid boolean for ${name}: ${raw} (expected true or false)`);
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
  /**
   * Whether to negotiate TLS with Postgres.
   *
   * Defaults to false because the local stack is `docker compose` on localhost, where the
   * server offers no TLS; every *managed* provider requires it, so a deployment sets this true.
   */
  readonly databaseSsl: boolean;
  /**
   * Whether a TLS connection also validates the certificate chain.
   *
   * Defaults to true: an encrypted connection to an unverified peer protects against passive
   * eavesdropping but not against a machine-in-the-middle. Only a host whose CA is genuinely
   * unavailable should turn this off, which is why it takes a second, deliberate variable.
   */
  readonly databaseSslVerify: boolean;
  /** Connection ceiling per module pool. Seven modules each open their own pool (ADR-007). */
  readonly databasePoolMax: number;
  readonly rabbitmqUrl: string;
  readonly outboxPollIntervalMs: number;
  readonly outboxBatchSize: number;
  readonly maxDeliveryAttempts: number;
  readonly apiPort: number;
  readonly authMode: AuthMode;
  readonly jwtPrivateKeyPath: string;
  readonly accessTokenTtlSeconds: number;
  readonly jitsiAppId: string;
  /** ADR-039: key id from the 8x8 API-key page; JaaS wants `<appId>/<keyId>` as `kid`. */
  readonly jitsiKeyId: string;
  /** ADR-039: PEM path for the JaaS API private key. Replaces the old shared HS256 secret. */
  readonly jitsiPrivateKeyPath: string;
  /** Hosted-Jitsi origin including the tenant, e.g. `8x8.vc/<appId>`. */
  readonly jitsiDomain: string;
  readonly jitsiTokenTtlSeconds: number;
  readonly jitsiOpenMinutes: number;
  /**
   * FR-020 / AC-035 (ADR-021 Amendment D): how long the room must stay empty before the
   * class may complete with basis `room_idle`.
   *
   * Was a constant (`ROOM_IDLE_GRACE_MINUTES = 5`), which made the one tunable part of the
   * early-completion rule impossible to change without a code change. Default stays 5, the
   * value W1 C3a decided.
   *
   * `0` is valid and means "complete on the first sweep after the last departure". Read with
   * `readNonNegativeInt`, not `readInt`, because `readInt` rejects zero.
   *
   * Note: the completion sweeper ticks every 60 s, so any value below one minute behaves
   * exactly like 0.
   */
  readonly jitsiIdleGraceMinutes: number;
  /**
   * FR-011 / AC-035: endpoint secret used to verify `X-Jaas-Signature` on presence webhooks.
   * Empty = refuse all presence, so an unset secret is never mistaken for "trust everyone".
   */
  readonly jitsiWebhookSecret: string;
  /**
   * FR-016 (W3 C1): how long before `starts_at` the "class starting soon" reminder fires.
   *
   * Defaults to 15 to match `jitsiOpenMinutes`: the reminder should arrive when the room door
   * becomes usable. It is separate config rather than a derived value because the Product Owner
   * may move one without moving the other, and a silent coupling would make that impossible.
   */
  readonly classReminderOffsetMinutes: number;
  readonly logLevel: string;

  // FR-008 / ADR-033: SePay Payment Gateway (hosted checkout + IPN).
  readonly sepayEnvironment: string;
  readonly sepayCheckoutHost: string;
  readonly sepayRestBaseUrl: string;
  readonly sepayMerchantId: string;
  readonly sepaySecretKey: string;
  readonly sepayReturnUrl: string;
  /**
   * FR-008 / ADR-033: extra browser origins a per-request `returnUrl` may use.
   *
   * `SEPAY_RETURN_URL`'s own origin is always allowed, but the payer's browser
   * usually runs the client on a different origin in development
   * (e.g. `http://localhost:3000` while the configured return URL is a tunnel),
   * and those origins have to be listed explicitly — never inferred from a
   * request header, which is what would make this an open redirect.
   */
  readonly sepayReturnUrlAllowedOrigins: string[];
  /**
   * FR-008 / ADR-033 reconciliation (deliberately incomplete, see the sweeper).
   * Off by default so no dev, test or CI run ever calls SePay.
   */
  readonly sepayReconEnabled: boolean;
  readonly sepayReconIntervalMs: number;
  /** Only intents older than this are re-queried, so a live checkout is left alone. */
  readonly sepayReconMinAgeMs: number;

  /**
   * BR-027 (decision D3, closed 2026-10-26): VND per credit for a top-up.
   *
   * Was hardcoded at `wallet.ts:4`. Configurable because the exchange rate is a business
   * parameter, not a law of physics, and a rate change must be a deployment change rather
   * than a code change plus a migration. Every intent stores the rate it was created under
   * (`top_up_intents.vnd_per_credit`), so a later change cannot silently re-price money that
   * was already paid for.
   *
   * Withdrawal is out of the MVP (FR-014 deferred), so this is top-up-only for now.
   */
  readonly vndPerCredit: number;

  // FR-002 / ADR-038: document storage (Cloudinary, signed multipart upload).
  readonly cloudinaryCloudName: string;
  readonly cloudinaryApiKey: string;
  readonly cloudinaryApiSecret: string;
  readonly cloudinaryUploadTtlSeconds: number;
  readonly cloudinaryMaxUploadBytes: number;
  readonly cloudinaryAllowedContentTypes: string[];

  constructor() {
    this.databaseHost = readString('DATABASE_HOST', 'localhost');
    this.databasePort = readInt('DATABASE_PORT', 5432);
    this.databaseName = readString('DATABASE_NAME', 'skillswap');
    this.databasePassword = readString('DATABASE_PASSWORD', 'skillswap_dev');
    // NFR-004: a managed Postgres (Neon, Aiven, …) refuses plaintext connections, while the
    // local container offers no TLS at all — so this has to be configuration, not a constant.
    this.databaseSsl = readBool('DATABASE_SSL', false);
    this.databaseSslVerify = readBool('DATABASE_SSL_VERIFY', true);
    // Seven pools (ADR-007) against a free plan's ~104 connection ceiling: the default keeps
    // local behaviour, a deployment template lowers it.
    this.databasePoolMax = readInt('DATABASE_POOL_MAX', 10);
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

    this.sepayEnvironment = readString('SEPAY_ENVIRONMENT', 'sandbox');
    this.sepayCheckoutHost = readString('SEPAY_CHECKOUT_HOST', 'https://pay-sandbox.sepay.vn');
    this.sepayRestBaseUrl = readString('SEPAY_REST_BASE_URL', 'https://pgapi-sandbox.sepay.vn');
    this.sepayMerchantId = readString('SEPAY_MERCHANT_ID', '');
    this.sepaySecretKey = readString('SEPAY_SECRET_KEY', '');
    this.sepayReturnUrl = readString('SEPAY_RETURN_URL', '');
    this.sepayReturnUrlAllowedOrigins = readString('SEPAY_RETURN_URL_ALLOWED_ORIGINS', '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    // FR-008 / ADR-033: reconciliation is off unless explicitly enabled, so a
    // test or local run never reaches out to SePay.
    this.sepayReconEnabled = readString('SEPAY_RECON_ENABLED', 'false') === 'true';
    this.sepayReconIntervalMs = readInt('SEPAY_RECON_INTERVAL_MS', 5 * 60 * 1000);
    this.sepayReconMinAgeMs = readInt('SEPAY_RECON_MIN_AGE_MS', 15 * 60 * 1000);

    // BR-027 (D3): 1000 VND per credit, matching the historical hardcoded value, so an
    // existing deployment that sets nothing keeps pricing top-ups exactly as it did.
    //
    // `readInt` already refuses a non-positive or non-integer value at boot, which is the
    // important part: a zero rate would divide by zero and a negative one would invert the sign
    // of real money, so there is no safe fallback to degrade to.
    this.vndPerCredit = readInt('VND_PER_CREDIT', 1000);

    this.jitsiAppId = readString('JITSI_APP_ID', 'vpaas-magic-cookie-dev');
    this.jitsiKeyId = readString('JITSI_KEY_ID', 'dev');
    // Mirrors JWT_PRIVATE_KEY_PATH's shape: a default location, not a default key. `pnpm keys:gen`
    // writes a placeholder there for offline development; a real deployment replaces it with the
    // PEM from the 8x8 console (ADR-039).
    const jitsiKeyPath = readString('JITSI_PRIVATE_KEY_PATH', '../../.secrets/jaas-private.pem');
    this.jitsiPrivateKeyPath = isAbsolute(jitsiKeyPath)
      ? jitsiKeyPath
      : resolve(process.cwd(), jitsiKeyPath);
    // The tenant is part of the origin: `https://${jitsiDomain}/${room}` then yields
    // `https://8x8.vc/<appId>/<room>`, which is the JaaS meeting URL (ADR-039 decision 3).
    this.jitsiDomain = readString('JITSI_DOMAIN', '8x8.vc');
    this.jitsiTokenTtlSeconds = readInt('JITSI_TOKEN_TTL_SECONDS', 3600);
    this.jitsiOpenMinutes = readInt('JITSI_OPEN_MINUTES', 15);
    // ADR-021 Amendment D: zero is meaningful here (close as soon as the room empties),
    // so this deliberately does not use readInt.
    this.jitsiIdleGraceMinutes = readNonNegativeInt('ROOM_IDLE_GRACE_MINUTES', 5);
    this.classReminderOffsetMinutes = readInt('CLASS_REMINDER_OFFSET_MINUTES', 15);
    // Deliberately empty by default: an unset secret must refuse presence rather than
    // accept it, so a misconfigured deployment cannot have its classes closed by strangers.
    this.jitsiWebhookSecret = readString('JITSI_WEBHOOK_SECRET', '');

    // FR-002 / ADR-038: Cloudinary. The upload ceiling defaults to 10 MB because that is the
    // Free plan's hard cap for raw and image files — raising it here alone would not raise it
    // at the vendor, so the two move together.
    this.cloudinaryCloudName = readString('CLOUDINARY_CLOUD_NAME', 'skillswap');
    this.cloudinaryApiKey = readString('CLOUDINARY_API_KEY', 'skillswap_dev_key');
    this.cloudinaryApiSecret = readString('CLOUDINARY_API_SECRET', 'skillswap_dev_secret');
    this.cloudinaryUploadTtlSeconds = readInt('CLOUDINARY_UPLOAD_TTL_SECONDS', 900);
    this.cloudinaryMaxUploadBytes = readInt('CLOUDINARY_MAX_UPLOAD_BYTES', 10 * 1024 * 1024);
    this.cloudinaryAllowedContentTypes = readString(
      'CLOUDINARY_ALLOWED_CONTENT_TYPES',
      'application/pdf,image/png,image/jpeg',
    )
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
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
