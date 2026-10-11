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

type OpenApiDocument = ReturnType<typeof SwaggerModule.createDocument>;

/**
 * Rebuilds `paths` so the JSON (and therefore the UI) lists operations grouped by
 * tag in `tagOrder`, and alphabetically by path within each tag. Swagger otherwise
 * keeps controller declaration order.
 */
function sortOperationsByTag(document: OpenApiDocument, tagOrder: readonly string[]): void {
  const rank = new Map(tagOrder.map((tag, index) => [tag, index]));
  const entries: Array<{ path: string; method: string; operation: unknown; tag: string; key: string }> = [];
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    if (item === undefined) continue;
    for (const [method, operation] of Object.entries(item)) {
      const op = operation as { tags?: string[]; operationId?: string };
      const tag = op.tags?.[0] ?? '';
      const opId = op.operationId ?? `${method}:${path}`;
      entries.push({ path, method, operation, tag, key: `${path} ${opId}` });
    }
  }
  entries.sort((a, b) => {
    const byTag = (rank.get(a.tag) ?? tagOrder.length) - (rank.get(b.tag) ?? tagOrder.length);
    if (byTag !== 0) return byTag;
    const byPath = a.path.localeCompare(b.path);
    return byPath !== 0 ? byPath : a.method.localeCompare(b.method);
  });

  const sorted: Record<string, Record<string, unknown>> = {};
  for (const entry of entries) {
    (sorted[entry.path] ??= {})[entry.method] = entry.operation;
  }
  document.paths = sorted as OpenApiDocument['paths'];
}

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

  // Tag order is the first-seen order otherwise; list them alphabetically so the
  // docs page groups endpoints predictably.
  const tags = [
    'account-profile',
    'admin-operation',
    'auth',
    'classes',
    'health',
    'live-class',
    'schedule',
    'skill-verification',
    'student-verification',
    'wallet',
    'wallet-ledger',
  ];
  const builder = new DocumentBuilder()
    .setTitle('SkillSwap API')
    .setDescription('Public REST surface for the SkillSwap marketplace (FR/API ids in summaries).')
    .setVersion('1.0')
    // ADR-016: the gateway verifies the RS256 bearer token before proxying.
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addServer('/api');
  for (const tag of tags) {
    builder.addTag(tag);
  }

  const document = SwaggerModule.createDocument(app, builder.build());
  sortOperationsByTag(document, tags);
  SwaggerModule.setup('api/docs', app, cleanupOpenApiDoc(document), {
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
