import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/bootstrap/app.module';
import { ModuleDataSourceRegistry } from '../src/shared/messaging/module-registry';
import { RabbitConsumer } from '../src/shared/messaging/rabbit-consumer';
import { PAYMENT_GATEWAY } from '../src/modules/wallet-ledger/internal/application/port/out/payment-gateway';
import { StubPaymentGateway } from './support/stub-payment-gateway';
import { waitFor } from './support/api-client';

// Load the repo-root `.env` exactly like the real bootstrap does.
loadEnv({ path: resolve(__dirname, '../../../.env') });

export interface Harness {
  baseUrl: string;
  /** Raw query against a module (by module name, e.g. "wallet-ledger"). */
  query<T = unknown>(moduleName: string, sql: string, params?: unknown[]): Promise<T[]>;
  /** The DataSource for a module, for truncation between tests. */
  dataSource(moduleName: string): DataSource;
  /** Module name for a given schema (e.g. "wallet_ledger" -> "wallet-ledger"). */
  moduleForSchema(schema: string): string;
  /** Resolve a provider/token from the running Nest container (test-only nudges). */
  resolve<T>(token: unknown): T;
  /** The stub standing in for SePay's outbound checkout redirect. */
  paymentGateway: StubPaymentGateway;
  close(): Promise<void>;
}

const SCHEMA_TO_MODULE: Record<string, string> = {
  account_profile: 'account-profile',
  live_class: 'live-class',
  wallet_ledger: 'wallet-ledger',
  student_verification: 'student-verification',
  skill_verification: 'skill-verification',
};

/**
 * Boots the REAL AppModule against the docker stack (Postgres + RabbitMQ), so
 * events flow through the outbox relay and the consumer exactly as in
 * production. Requires `docker compose up -d postgres rabbitmq` and
 * `pnpm db:migrate` beforehand (the integration jest project gates on this).
 */
export async function startHarness(): Promise<Harness> {
  const stub = new StubPaymentGateway();
  // `overrideProvider` only takes effect before the instance graph is built, so
  // the app is composed through the testing module rather than NestFactory.
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PAYMENT_GATEWAY)
    .useValue(stub)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bufferLogs: true,
    rawBody: true,
    logger: ['error', 'warn'],
  });
  // Replace only the outbound SePay redirect: the IPN receiver, the wallet
  // settlement, the outbox and the consumers all stay real, so the suite runs
  // offline without a sandbox merchant.
  app.setGlobalPrefix('api');
  await app.listen(0);

  const registry = app.get(ModuleDataSourceRegistry);
  await registry.ready; // rejects if the database is unreachable
  await waitFor(async () => app.get(RabbitConsumer).isReady() ? true : null, {
    timeoutMs: 15_000,
    intervalMs: 50,
  });

  const baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');

  return {
    baseUrl,
    paymentGateway: stub,
    dataSource: (moduleName) => registry.get(moduleName),
    moduleForSchema: (schema) => {
      const moduleName = SCHEMA_TO_MODULE[schema];
      if (moduleName === undefined) {
        throw new Error(`Unknown schema: ${schema}`);
      }
      return moduleName;
    },
    async query<T>(moduleName: string, sql: string, params?: unknown[]) {
      return (await registry.get(moduleName).query(sql, params)) as T[];
    },
    resolve: <T>(token: unknown) => app.get(token as never) as T,
    async close() {
      await app.close();
    },
  };
}
