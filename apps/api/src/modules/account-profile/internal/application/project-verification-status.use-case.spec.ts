import type { StudentVerificationEvent } from '@skillswap/contracts';
import { ProjectVerificationStatusUseCase } from './project-verification-status.use-case';
import type {
  UpsertVerificationStatusRequest,
  VerificationStatusWriter,
} from './port/out/verification-status-projector';

class RecordingWriter implements VerificationStatusWriter {
  readonly writes: UpsertVerificationStatusRequest[] = [];
  async upsert(request: UpsertVerificationStatusRequest): Promise<void> {
    this.writes.push(request);
  }
}

function event(overrides: Partial<StudentVerificationEvent> = {}): StudentVerificationEvent {
  return {
    verificationId: 'v1',
    accountId: 'a1',
    status: 'approved',
    schoolName: 'FPT University',
    reason: null,
    occurredAt: '2026-10-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('ProjectVerificationStatusUseCase (FR-017 / ADR-024)', () => {
  it('maps an approved event to the projection write', async () => {
    const writer = new RecordingWriter();
    await new ProjectVerificationStatusUseCase(writer).execute(event());
    expect(writer.writes).toEqual([
      {
        accountId: 'a1',
        verificationId: 'v1',
        status: 'approved',
        reason: null,
        occurredAt: '2026-10-10T00:00:00.000Z',
      },
    ]);
  });

  it('carries the rejection reason', async () => {
    const writer = new RecordingWriter();
    await new ProjectVerificationStatusUseCase(writer).execute(
      event({ status: 'rejected', reason: 'Illegible document' }),
    );
    expect(writer.writes[0]).toMatchObject({ status: 'rejected', reason: 'Illegible document' });
  });

  it('projects pending submissions too', async () => {
    const writer = new RecordingWriter();
    await new ProjectVerificationStatusUseCase(writer).execute(event({ status: 'pending' }));
    expect(writer.writes[0]?.status).toBe('pending');
  });
});
