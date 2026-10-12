import './init-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { pinoHttp } from 'pino-http';
import { AppModule } from './app.module';
import { ApiConfig } from '../shared/config/api-config';
import { AppLogger } from '../shared/logger/app-logger';
import { createHttpLoggerOptions } from './http-logger-options';
import { buildOpenApiDocument } from './openapi';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  const config = app.get(ApiConfig);
  const logger = app.get(AppLogger);

  app.useLogger(logger);
  app.use(pinoHttp(createHttpLoggerOptions(logger.raw)));
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app), {
    swaggerOptions: {
      // Sort operations by HTTP verb then path within each tag.
      operationsSorter: (a: { get: (key: string) => string }, b: { get: (key: string) => string }) => {
        const order = ['get', 'post', 'put', 'patch', 'delete'];
        const byVerb = order.indexOf(a.get('method')) - order.indexOf(b.get('method'));
        return byVerb !== 0 ? byVerb : a.get('path').localeCompare(b.get('path'));
      },
      tagsSorter: 'alpha',
    },
  });

  await app.listen(config.apiPort);
}

bootstrap().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
});
