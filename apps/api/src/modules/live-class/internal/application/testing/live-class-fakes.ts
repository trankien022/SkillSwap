import type { BookingState, CancelReason } from '../../domain/booking';
import type { BookingRepository, PersistedBooking } from '../port/out/booking-repository';
import type { ClassEdit, ClassRepository, PersistedClass } from '../port/out/class-repository';
import type {
  RoomToken,
  RoomTokenInput,
  RoomTokenIssuer,
} from '../port/out/room-token-issuer';
import { RoomProviderUnavailableError } from '../port/out/room-token-issuer';
import type { RoomIncident, RoomIncidentRecorder } from '../port/out/room-incident-recorder';

export function makeBooking(
  partial: Partial<PersistedBooking> & Pick<PersistedBooking, 'id'>,
): PersistedBooking {
  return {
    classId: 'cls-1',
    learnerId: `st-${partial.id}`,
    state: 'pending',
    priceCredits: 100,
    idempotencyKey: `key-${partial.id}`,
    createdAt: new Date('2026-10-10T00:00:00.000Z'),
    expiresAt: new Date('2026-10-10T00:15:00.000Z'),
    ...partial,
  };
}

export class InMemoryBookingRepository implements BookingRepository {
  readonly rows: PersistedBooking[] = [];
  readonly emitted: Array<{ event: string; bookingId: string; reason?: CancelReason }> = [];

  constructor(rows: PersistedBooking[] = []) {
    this.rows = rows;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<PersistedBooking | null> {
    return this.rows.find((row) => row.idempotencyKey === idempotencyKey) ?? null;
  }

  async findById(bookingId: string): Promise<PersistedBooking | null> {
    return this.rows.find((row) => row.id === bookingId) ?? null;
  }

  async createWithSeatGuard(): Promise<{ booking: PersistedBooking; created: boolean }> {
    throw new Error('not used in these tests');
  }

  async confirmAndEmit(
    bookingId: string,
    learnerId: string,
  ): Promise<{ confirmed: boolean; booking: PersistedBooking | null }> {
    const row = this.rows.find((r) => r.id === bookingId && r.learnerId === learnerId);
    if (row === undefined || row.state !== 'pending') {
      return { confirmed: false, booking: row ?? null };
    }
    row.state = 'confirmed';
    return { confirmed: true, booking: row };
  }

  async cancelAndEmit(
    bookingId: string,
    reason: CancelReason,
  ): Promise<{ cancelled: boolean; booking: PersistedBooking | null }> {
    const row = this.rows.find((r) => r.id === bookingId);
    if (row === undefined || (row.state !== 'pending' && row.state !== 'confirmed')) {
      return { cancelled: false, booking: row ?? null };
    }
    row.state = 'cancelled';
    this.emitted.push({ event: 'booking.cancelled', bookingId, reason });
    return { cancelled: true, booking: row };
  }

  async expirePendingHolds(now: Date): Promise<number> {
    let count = 0;
    for (const row of this.rows) {
      if (
        row.state === 'pending' &&
        row.expiresAt !== null &&
        row.expiresAt.getTime() <= now.getTime()
      ) {
        row.state = 'cancelled';
        this.emitted.push({ event: 'booking.cancelled', bookingId: row.id, reason: 'expired' });
        count += 1;
      }
    }
    return count;
  }

  async countByClassAndState(classId: string, state: BookingState): Promise<number> {
    return this.rows.filter((row) => row.classId === classId && row.state === state).length;
  }

  async findActiveByClass(classId: string): Promise<PersistedBooking[]> {
    return this.rows.filter(
      (row) => row.classId === classId && (row.state === 'pending' || row.state === 'confirmed'),
    );
  }
}

export function classView(partial: Partial<PersistedClass> = {}): PersistedClass {
  return {
    id: 'cls-1',
    teacherId: 'teacher-1',
    state: 'published',
    startsAt: new Date('2026-10-11T00:00:00.000Z'),
    durationMinutes: 60,
    priceCredits: 100,
    capacity: 3,
    description: 'Guitar',
    skillIds: ['skill-1'],
    ...partial,
  };
}

export class InMemoryClassRepository implements ClassRepository {
  cancelled: string[] = [];
  updated: ClassEdit | null = null;

  constructor(private value: PersistedClass | null = classView()) {}

  async insert(): Promise<PersistedClass> {
    throw new Error('not used in these tests');
  }

  async findById(id: string): Promise<PersistedClass | null> {
    if (this.value === null || this.value.id !== id) {
      return null;
    }
    return this.value;
  }

  async update(id: string, edit: ClassEdit): Promise<PersistedClass> {
    if (this.value === null || this.value.id !== id) {
      throw new Error(`class ${id} not found`);
    }
    this.updated = edit;
    this.value = { ...this.value, ...edit };
    return this.value;
  }

  async markCancelled(id: string): Promise<void> {
    this.cancelled.push(id);
    if (this.value !== null) {
      this.value = { ...this.value, state: 'cancelled' };
    }
  }
}

export class FakeRoomTokenIssuer implements RoomTokenIssuer {
  readonly issued: RoomTokenInput[] = [];
  fail = false;

  issue(input: RoomTokenInput): RoomToken {
    if (this.fail) {
      throw new RoomProviderUnavailableError('jitsi down');
    }
    this.issued.push(input);
    return { token: `tok-${input.role}`, expiresAt: '2026-10-12T11:00:00.000Z' };
  }
}

export class FakeRoomIncidentRecorder implements RoomIncidentRecorder {
  readonly incidents: RoomIncident[] = [];
  async record(incident: RoomIncident): Promise<void> {
    this.incidents.push(incident);
  }
}
