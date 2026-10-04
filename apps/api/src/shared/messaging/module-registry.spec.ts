import type { DataSource } from 'typeorm';
import { ModuleNotInitialisedError } from '../errors';
import { ModuleDataSourceRegistry } from './module-registry';

const fakeDataSource = {
  initialize: async () => fakeDataSource,
  destroy: async () => undefined,
} as unknown as DataSource;
const factory = () => fakeDataSource;

describe('ModuleDataSourceRegistry', () => {
  it('registers and exposes module names', () => {
    const registry = new ModuleDataSourceRegistry();
    registry.register('schedule', 'schedule', factory);
    expect(registry.names()).toEqual(['schedule']);
    expect(registry.getSchema('schedule')).toBe('schedule');
  });

  it('rejects duplicate registrations', () => {
    const registry = new ModuleDataSourceRegistry();
    registry.register('schedule', 'schedule', factory);
    expect(() => registry.register('schedule', 'schedule', factory)).toThrow(
      /already registered/,
    );
  });

  it('throws ModuleNotInitialisedError before initialisation', () => {
    const registry = new ModuleDataSourceRegistry();
    registry.register('schedule', 'schedule', factory);
    expect(() => registry.get('schedule')).toThrow(ModuleNotInitialisedError);
    expect(registry.isReady()).toBe(false);
  });

  it('throws ModuleNotInitialisedError for unknown modules', () => {
    const registry = new ModuleDataSourceRegistry();
    expect(() => registry.get('ghost')).toThrow(ModuleNotInitialisedError);
    expect(() => registry.getSchema('ghost')).toThrow(ModuleNotInitialisedError);
  });

  it('initialises registered sources and becomes ready', async () => {
    const registry = new ModuleDataSourceRegistry();
    registry.register('schedule', 'schedule', factory);
    await registry.onApplicationBootstrap();
    expect(registry.get('schedule')).toBe(fakeDataSource);
    expect(registry.isReady()).toBe(true);
    await registry.onModuleDestroy();
    expect(registry.isReady()).toBe(false);
  });

  it('rejects registration after initialisation', async () => {
    const registry = new ModuleDataSourceRegistry();
    await registry.onApplicationBootstrap();
    expect(() => registry.register('late', 'late', factory)).toThrow(/after initialisation/);
  });

  it('fails fast with an actionable message when a source cannot initialise', async () => {
    const registry = new ModuleDataSourceRegistry();
    registry.register('broken', 'broken', () => {
      throw new Error('connect ECONNREFUSED');
    });
    await expect(registry.onApplicationBootstrap()).rejects.toThrow(
      /docker compose up -d.*pnpm db:migrate.*broken/s,
    );
    expect(registry.isReady()).toBe(false);
    expect(registry.names()).toEqual(['broken']);
  });
});
