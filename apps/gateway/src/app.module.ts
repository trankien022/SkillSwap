import { Module } from '@nestjs/common';
import HttpProxy from 'http-proxy';
import { HealthController } from './health/health.controller';
import { GatewayConfig } from './config/gateway-config';
import { ApiProxyService } from './proxy/api-proxy.service';

@Module({
  controllers: [HealthController],
  providers: [
    { provide: GatewayConfig, useFactory: () => new GatewayConfig() },
    {
      provide: ApiProxyService,
      useFactory: (config: GatewayConfig): ApiProxyService => {
        const proxy = new HttpProxy({
          target: config.apiInternalUrl,
          changeOrigin: true,
          xfwd: true,
        });
        return new ApiProxyService(config, proxy);
      },
      inject: [GatewayConfig],
    },
  ],
})
export class AppModule {}

