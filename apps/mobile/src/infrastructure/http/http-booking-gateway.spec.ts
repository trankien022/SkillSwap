import { BookClassService } from '@/application/book-class-service';
import { BookingError, type ClassView } from '@/domain/booking/booking';
import { HttpBookingGateway } from '@/infrastructure/http/http-booking-gateway';

const CLASS: ClassView = {
  id: 'cls-1',
  teacherId: 'teacher-1',
  startsAt: '2026-12-01T10:00:00.000Z',
  durationMinutes: 60,
  priceCredits: 100,
  capacity: 5,
  state: 'published',
};

interface FakeResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

function jsonResponse(body: unknown, status = 200): FakeResponse {
  return { ok: status < 400, status, json: async () => body };
}

function envelopeOk<T>(data: T, code = 'OK'): unknown {
  return { success: true, code, message: code, data, errors: [] };
}

function envelopeErr(code: string, message = code): unknown {
  return {
    success: false,
    code,
    message,
    data: null,
    errors: [{ code, message }],
  };
}

/** Builds a fetch stub that records the request and returns a fixed response. */
function fetchStub(response: unknown, status = 200) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return jsonResponse(response, status) as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function gateway(impl: typeof fetch): HttpBookingGateway {
  return new HttpBookingGateway({ fetchImpl: impl, headers: {}, baseUrl: 'http://api.test' });
}

describe('HttpBookingGateway (FR-007, NFR-013 envelope at the infra boundary)', () => {
  it('unwraps the success envelope into the bare ClassView the port promises', async () => {
    const { impl, calls } = fetchStub(envelopeOk(CLASS));
    const result = await new BookClassService(gateway(impl)).loadClass('cls-1');

    expect(result).toEqual(CLASS);
    expect(calls[0]?.url).toContain('/api/classes/cls-1');
  });

  it('unwraps the { booking, created } body for a booking', async () => {
    const { impl, calls } = fetchStub(
      envelopeOk({ booking: { bookingId: 'bkg-1', classId: 'cls-1' }, created: true }),
      201,
    );
    const result = await new BookClassService(gateway(impl)).book('cls-1', 'key-1');

    expect(result).toEqual({ booking: { bookingId: 'bkg-1', classId: 'cls-1' }, created: true });
    expect(calls[0]?.init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ idempotencyKey: 'key-1' });
  });

  it('maps a domain error code on the failure envelope onto BookingError.reason', async () => {
    const { impl } = fetchStub(envelopeErr('duplicate_booking', 'Learner already booked'), 409);
    await expect(new BookClassService(gateway(impl)).book('cls-1', 'k')).rejects.toMatchObject({
      name: 'BookingError',
      reason: 'duplicate_booking',
    });
  });

  it('maps a nested errors[].code rejection reason', async () => {
    const body = {
      success: false,
      code: 'ConflictError',
      message: 'conflict',
      data: null,
      errors: [{ code: 'class_full', message: 'Class has no available seats' }],
    };
    const { impl } = fetchStub(body, 409);
    await expect(gateway(impl).bookClass('cls-1', 'k')).rejects.toBeInstanceOf(BookingError);
    await expect(gateway(impl).bookClass('cls-1', 'k')).rejects.toMatchObject({
      reason: 'class_full',
    });
  });

  it('propagates a non-domain failure unchanged', async () => {
    const { impl } = fetchStub(envelopeErr('HTTP_500', 'Internal server error'), 500);
    await expect(gateway(impl).getClass('cls-1')).rejects.toMatchObject({ code: 'HTTP_500' });
  });
});
