import { demoClassDetails } from './mock-data';
import type { ClassDetailView } from './types';

/**
 * Mock class-detail gateway (FR-006 detail mock).
 *
 * No network. Returns the enriched `ClassDetailView` for a known id or
 * `null` if the id is unknown, so the page can render a 404. A future
 * `HttpClassDetailGateway` can be dropped in here with the same shape
 * and the page does not change.
 */
export class MockClassDetailGateway {
  private readonly byId: ReadonlyMap<string, ClassDetailView>;

  constructor(details: ReadonlyArray<ClassDetailView> = demoClassDetails()) {
    this.byId = new Map(details.map((item) => [item.id, item]));
  }

  async getById(id: string): Promise<ClassDetailView | null> {
    return this.byId.get(id) ?? null;
  }

  async listIds(): Promise<string[]> {
    return [...this.byId.keys()];
  }
}
