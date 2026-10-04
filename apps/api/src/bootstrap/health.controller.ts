import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModuleDataSourceRegistry } from '../shared/messaging/module-registry';

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
  @ApiOperation({ summary: 'Liveness and readiness of the module data sources' })
  @ApiOkResponse({ description: 'Always HTTP 200; check status/database fields' })
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
