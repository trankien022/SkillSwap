import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import type { INestApplication } from '@nestjs/common';

export type OpenApiDocument = ReturnType<typeof SwaggerModule.createDocument>;

/**
 * Public API surface, grouped by tag. Order drives docs grouping.
 *
 * Only tags that own at least one business endpoint are listed. The module lifecycle probes
 * (`account-profile`, `live-class`, `schedule`, `wallet-ledger`) were removed because they exposed
 * a module's internal bookkeeping, not a capability a client could use.
 */
export const API_TAGS = [
  'admin-operation',
  'auth',
  'classes',
  'health',
  'notifications',
  'skill-verification',
  'student-verification',
  'wallet',
] as const;

/**
 * Rebuilds `paths` so the JSON (and therefore the UI) lists operations grouped by
 * tag in `tagOrder`, and alphabetically by path within each tag. Swagger otherwise
 * keeps controller declaration order.
 */
export function sortOperationsByTag(
  document: OpenApiDocument,
  tagOrder: readonly string[] = API_TAGS,
): void {
  const rank = new Map(tagOrder.map((tag, index) => [tag, index]));
  const entries: Array<{ path: string; method: string; operation: unknown; tag: string }> = [];
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    if (item === undefined) continue;
    for (const [method, operation] of Object.entries(item)) {
      const op = operation as { tags?: string[] };
      entries.push({ path, method, operation, tag: op.tags?.[0] ?? '' });
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

/** Builds the cleaned, sorted OpenAPI document for an initialised Nest app. */
export function buildOpenApiDocument(app: INestApplication): OpenApiDocument {
  const builder = new DocumentBuilder()
    .setTitle('SkillSwap API')
    .setDescription('Public REST surface for the SkillSwap marketplace (FR/API ids in summaries).')
    .setVersion('1.0')
    // ADR-016: the gateway verifies the RS256 bearer token before proxying.
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addServer('/api');
  for (const tag of API_TAGS) {
    builder.addTag(tag);
  }
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, builder.build()));
  sortOperationsByTag(document);
  return document;
}
