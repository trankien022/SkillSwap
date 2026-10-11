import './init-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { pinoHttp } from 'pino-http';
import { AppModule } from './app.module';
import { ApiConfig } from '../shared/config/api-config';
import { AppLogger } from '../shared/logger/app-logger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  const config = app.get(ApiConfig);
  const logger = app.get(AppLogger);

  app.useLogger(logger);
  app.use(pinoHttp({ logger: logger.raw }));
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('SkillSwap API')
      .setDescription('Public REST surface for the SkillSwap marketplace (FR/API ids in summaries).')
      .setVersion('1.0')
      // ADR-016: the gateway verifies the RS256 bearer token before proxying.
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'bearer',
      )
      .addServer('/api')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, cleanupOpenApiDoc(document));

  await app.listen(config.apiPort);
}

bootstrap().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
});
