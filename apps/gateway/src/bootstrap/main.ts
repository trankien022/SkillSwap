import './init-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../app.module';
import { GatewayConfig } from '../config/gateway-config';
import { ApiProxyService } from '../proxy/api-proxy.service';
import { corsMiddleware } from '../proxy/cors.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(GatewayConfig);
  const proxy = app.get(ApiProxyService);

  app.enableShutdownHooks();

  // Single public entry (ADR-008): rate-limit, verify identity, then forward.
  // Mounted before Nest's router so /api never reaches a controller here.
  // CORS is off unless CORS_ORIGINS lists explicit origins (browser clients).
  if (config.corsOrigins.length > 0) {
    app.use('/api', corsMiddleware(config.corsOrigins));
  }
  app.use('/api', proxy.rateLimiter, proxy.middleware);

  await app.listen(config.gatewayPort);
}

bootstrap().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
});
