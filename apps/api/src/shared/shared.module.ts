import { Global, Module } from '@nestjs/common';
import { ApiConfig } from './config/api-config';
import { AppLogger } from './logger/app-logger';
import { EventHandlerRegistry } from './messaging/event-handler-registry';
import { ModuleDataSourceRegistry } from './messaging/module-registry';
import { OutboxRelay } from './messaging/outbox-relay';
import { PostgresProcessedEventStore } from './messaging/processed-event-store';
import { RabbitConsumer } from './messaging/rabbit-consumer';
import { RabbitPublisher } from './messaging/rabbit-publisher';

/**
 * Cross-cutting providers (§5): config, logging, per-module connection
 * registry and the outbox relay/consumer machinery. Exported to every module;
 * the HTTP guard/filter are composed in AppModule instead.
 */
@Global()
@Module({
  providers: [
    ApiConfig,
    {
      provide: AppLogger,
      useFactory: (config: ApiConfig) => new AppLogger('api', { level: config.logLevel }),
      inject: [ApiConfig],
    },
    {
      provide: ModuleDataSourceRegistry,
      useFactory: () => new ModuleDataSourceRegistry(),
      inject: [],
    },
    EventHandlerRegistry,
    {
      provide: RabbitPublisher,
      useFactory: (config: ApiConfig, logger: AppLogger) =>
        new RabbitPublisher(config.rabbitmqUrl, logger.child('rabbit')),
      inject: [ApiConfig, AppLogger],
    },
    {
      provide: PostgresProcessedEventStore,
      useFactory: (registry: ModuleDataSourceRegistry) => new PostgresProcessedEventStore(registry),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: OutboxRelay,
      useFactory: (
        config: ApiConfig,
        registry: ModuleDataSourceRegistry,
        publisher: RabbitPublisher,
        logger: AppLogger,
      ) => new OutboxRelay(config, registry, publisher, logger.child('outbox-relay')),
      inject: [ApiConfig, ModuleDataSourceRegistry, RabbitPublisher, AppLogger],
    },
    {
      provide: RabbitConsumer,
      useFactory: (
        config: ApiConfig,
        registry: ModuleDataSourceRegistry,
        handlers: EventHandlerRegistry,
        store: PostgresProcessedEventStore,
        logger: AppLogger,
      ) => new RabbitConsumer(config, registry, handlers, store, logger.child('consumer')),
      inject: [ApiConfig, ModuleDataSourceRegistry, EventHandlerRegistry, PostgresProcessedEventStore, AppLogger],
    },
  ],
  exports: [ApiConfig, AppLogger, ModuleDataSourceRegistry, EventHandlerRegistry],
})
export class SharedModule {}
