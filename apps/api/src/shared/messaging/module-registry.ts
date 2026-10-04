import type { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { ModuleNotInitialisedError } from '../errors';

export type DataSourceFactory = (schema: string) => DataSource;

interface ModuleEntry {
  schema: string;
  factory: DataSourceFactory;
  dataSource?: DataSource;
}

/**
 * Per-module DataSource registry (§5: one connection pool per module schema).
 * Registration happens during `onModuleInit`; initialisation during
 * `onApplicationBootstrap`; consumers/relay await `ready` instead of blocking
 * application bootstrap.
 */
export class ModuleDataSourceRegistry implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly modules = new Map<string, ModuleEntry>();
  private initialized = false;
  private readonly readyPromise: Promise<void>;
  private resolveReady = (): void => undefined;
  private rejectReady = (_error: Error): void => undefined;

  readonly ready: Promise<void>;

  constructor() {
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    // No consumer is attached until bootstrap — keep an unhandled rejection
    // from crashing the process before `onApplicationBootstrap` runs.
    void this.readyPromise.catch(() => undefined);
    this.ready = this.readyPromise;
  }

  register(moduleName: string, schema: string, factory: DataSourceFactory): void {
    if (this.initialized) {
      throw new Error(`Cannot register "${moduleName}" after initialisation`);
    }
    if (this.modules.has(moduleName)) {
      throw new Error(`Module already registered: ${moduleName}`);
    }
    this.modules.set(moduleName, { schema, factory });
  }

  get(moduleName: string): DataSource {
    const entry = this.modules.get(moduleName);
    if (entry?.dataSource === undefined) {
      throw new ModuleNotInitialisedError(moduleName);
    }
    return entry.dataSource;
  }

  getSchema(moduleName: string): string {
    const entry = this.modules.get(moduleName);
    if (entry === undefined) {
      throw new ModuleNotInitialisedError(moduleName);
    }
    return entry.schema;
  }

  names(): string[] {
    return [...this.modules.keys()];
  }

  isReady(): boolean {
    return this.initialized && [...this.modules.values()].every((e) => e.dataSource !== undefined);
  }

  /**
   * Nest calls onApplicationBootstrap only after every module's onModuleInit
   * (registration) hooks — so all DataSources initialise here, fail-fast.
   */
  onApplicationBootstrap(): Promise<void> {
    return this.initializeAll();
  }

  onModuleDestroy(): Promise<void> {
    return this.destroyAll();
  }

  private async initializeAll(): Promise<void> {
    this.initialized = true;
    const failures: string[] = [];

    for (const [moduleName, entry] of this.modules) {
      try {
        const dataSource = entry.factory(entry.schema);
        await dataSource.initialize();
        entry.dataSource = dataSource;
      } catch (error) {
        failures.push(`${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (failures.length > 0) {
      const error = new Error(
        `Database unavailable — start it with "docker compose up -d" and run "pnpm db:migrate" (${failures.join('; ')})`,
      );
      this.rejectReady(error);
      throw error;
    }

    this.resolveReady();
  }

  private async destroyAll(): Promise<void> {
    const sources = [...this.modules.values()]
      .map((entry) => entry.dataSource)
      .filter((source): source is DataSource => source !== undefined);
    await Promise.all(sources.map((source) => source.destroy().catch(() => undefined)));
    for (const entry of this.modules.values()) {
      entry.dataSource = undefined;
    }
  }
}
