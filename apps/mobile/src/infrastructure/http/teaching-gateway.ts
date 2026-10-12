import { classSchema, createClassSchema, updateClassSchema, type ClassView, type CreateClassInput, type UpdateClassInput } from '@skillswap/contracts';
import type { GatewayClient } from './gateway-client';

/** Authenticated teacher commands. Lifecycle transitions stay server-authoritative. */
export class TeachingGateway {
  constructor(private readonly gateway: GatewayClient) {}

  async create(input: CreateClassInput): Promise<ClassView> {
    const body = createClassSchema.parse(input);
    return classSchema.parse(await this.gateway.authenticatedRequest<unknown>('/classes', { method: 'POST', body }));
  }
  async update(classId: string, input: UpdateClassInput): Promise<ClassView> {
    const body = updateClassSchema.parse(input);
    return classSchema.parse(await this.gateway.authenticatedRequest<unknown>(`/classes/${encodeURIComponent(classId)}`, { method: 'PATCH', body }));
  }
  async cancel(classId: string): Promise<void> {
    await this.gateway.authenticatedRequest<unknown>(`/classes/${encodeURIComponent(classId)}/cancel`, { method: 'POST' });
  }
  async start(classId: string): Promise<void> {
    await this.gateway.authenticatedRequest<unknown>(`/classes/${encodeURIComponent(classId)}/start`, { method: 'POST' });
  }
  async complete(classId: string): Promise<void> {
    await this.gateway.authenticatedRequest<unknown>(`/classes/${encodeURIComponent(classId)}/complete`, { method: 'POST' });
  }
}
