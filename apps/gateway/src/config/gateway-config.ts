import { Injectable } from '@nestjs/common';
import { isAbsolute, resolve } from 'node:path';

function readInt(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name]?.trim();
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, got "${raw}"`);
  }
  return value;
}

function readBool(env: NodeJS.ProcessEnv, name: string, fallback: boolean): boolean {
  const raw = env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  throw new Error(`${name} must be "true" or "false", got "${raw}"`);
}

/**
 * Reads a comma-separated origin allow-list. An empty or absent value disables
 * CORS entirely, so an unconfigured deployment keeps its previous behaviour.
 * `*` is rejected: the gateway injects trusted identity headers, and a blanket
 * wildcard would let any site issue authenticated calls through it.
 */
function readOrigins(env: NodeJS.ProcessEnv, name: string): string[] {
  const raw = env[name]?.trim();
  if (raw === undefined || raw === '') return [];
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');
  if (origins.includes('*')) {
    throw new Error(
      `${name} must list explicit origins; "*" is not allowed because the gateway injects trusted identity headers`,
    );
  }
  return origins;
}

/** Single reader of gateway environment variables (ADR-009 pattern). */
@Injectable()
export class GatewayConfig {
  readonly gatewayPort: number;
  readonly apiInternalUrl: string;
  readonly authRequired: boolean;
  readonly jwtPublicKeyPath: string;
  readonly rateLimitWindowMs: number;
  readonly rateLimitMax: number;
  readonly corsOrigins: string[];

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.gatewayPort = readInt(env, 'GATEWAY_PORT', 4000);
    this.apiInternalUrl = env.API_INTERNAL_URL?.trim() || 'http://localhost:4001';
    this.authRequired = readBool(env, 'AUTH_REQUIRED', false);
    this.corsOrigins = readOrigins(env, 'CORS_ORIGINS');

    const algorithm = env.JWT_ALGORITHM?.trim() || 'RS256';
    if (algorithm !== 'RS256') {
      throw new Error(`JWT_ALGORITHM must be "RS256", got "${algorithm}"`);
    }
    const keyPath = env.JWT_PUBLIC_KEY_PATH?.trim() || '../../.secrets/jwt-public.pem';
    this.jwtPublicKeyPath = isAbsolute(keyPath) ? keyPath : resolve(process.cwd(), keyPath);

    this.rateLimitWindowMs = readInt(env, 'RATE_LIMIT_WINDOW_MS', 60_000);
    this.rateLimitMax = readInt(env, 'RATE_LIMIT_MAX', 300);
  }
}
