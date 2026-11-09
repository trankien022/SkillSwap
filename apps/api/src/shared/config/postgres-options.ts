import type { TlsOptions } from 'node:tls';
import type { ApiConfig } from './api-config';

/**
 * The `ssl` value every module DataSource passes to `pg`.
 *
 * Managed Postgres requires TLS; the local `docker compose` server offers none. Returning
 * `undefined` rather than `false` when TLS is off matters: `pg` treats an explicit `false` as
 * "do not attempt an upgrade", which is the same thing, but `undefined` also leaves the
 * environment's own `PGSSLMODE` absent from the picture in a way that is easier to reason about.
 *
 * `rejectUnauthorized` is spelled out instead of relying on `ssl: true`, because `pg` turns a
 * bare `true` into an empty object and the certificate check then depends on the driver
 * version's defaults. Neon's CA is Let's Encrypt's ISRG Root X1, which Node ships, so strict
 * verification works without shipping a certificate file.
 */
export function sslOptions(config: ApiConfig): TlsOptions | undefined {
  if (!config.databaseSsl) {
    return undefined;
  }
  return { rejectUnauthorized: config.databaseSslVerify };
}

/**
 * The driver-level `extra` block shared by every module DataSource.
 *
 * `options` pins the session's `search_path` to the module's own schema (ADR-007). It is also
 * the reason a pooled PgBouncer endpoint cannot be used: transaction-mode pooling does not
 * carry session startup parameters, and the server rejects the whole connection with
 * `unsupported startup parameter in options` rather than silently dropping the schema.
 */
export function extraOptions(config: ApiConfig, schema: string): Record<string, unknown> {
  return {
    options: `-c search_path=${schema},public`,
    max: config.databasePoolMax,
  };
}
