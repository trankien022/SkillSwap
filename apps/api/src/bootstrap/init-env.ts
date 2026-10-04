import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

/**
 * Loads `.env` before anything else (ADR-009: ApiConfig is the only reader
 * of process.env). Four levels up works from both `src/bootstrap` (ts-node)
 * and `dist/bootstrap` (compiled `pnpm start`).
 */
loadEnv({ path: resolve(__dirname, '../../../../.env') });
