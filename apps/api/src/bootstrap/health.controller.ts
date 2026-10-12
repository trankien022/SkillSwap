import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModuleDataSourceRegistry } from '../shared/messaging/module-registry';
import { RawResponse } from '../shared/http/response-code.decorator';

interface HealthReport {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  modules: string[];
  uptimeSeconds: number;
}

@Controller('health')
@ApiTags('health')
export class HealthController {
  constructor(
    @Inject(ModuleDataSourceRegistry) private readonly registry: ModuleDataSourceRegistry,
  ) {}

  @Get()
  @RawResponse()
  @ApiOperation({ summary: 'Liveness and readiness of the module data sources' })
  @ApiOkResponse({
    description: 'Always HTTP 200; check status/database fields',
    // NFR-013 exemption: /health is the one raw (unenveloped) response. Declared
    // inline so the API reference shows the fields instead of nothing.
    schema: {
      type: 'object',
      required: ['status', 'database', 'modules', 'uptimeSeconds'],
      properties: {
        status: { type: 'string', enum: ['ok', 'degraded'] },
        database: { type: 'string', enum: ['up', 'down'] },
        modules: { type: 'array', items: { type: 'string' } },
        uptimeSeconds: { type: 'integer', minimum: 0 },
      },
    },
  })
  getHealth(): HealthReport {
    const database = this.registry.isReady() ? 'up' : 'down';
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      modules: this.registry.names(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
