import {
  accountRoleSchema,
  advanceStatusResultSchema,
  advanceStatusSchema,
  apiErrorSchema,
  bookingCancelledSchema,
  bookingConfirmedSchema,
  bookingRequestSchema,
  bookingSchema,
  classSchema,
  createClassSchema,
  eventEnvelopeSchema,
  identityHeadersSchema,
  loginSchema,
  meResponseSchema,
  moduleStatusSchema,
  refreshRequestSchema,
  registerSchema,
  statusChangedSchema,
  tokenResponseSchema,
  topUpCallbackSchema,
  topUpIntentSchema,
  topUpRequestSchema,
  updateClassSchema,
  walletBalanceSchema,
} from './index';

describe('advanceStatusSchema', () => {
  it('accepts a target state', () => {
    expect(advanceStatusSchema.parse({ toState: 'reviewing' })).toEqual({
      toState: 'reviewing',
    });
  });

  it('rejects an empty target state', () => {
    expect(() => advanceStatusSchema.parse({ toState: '' })).toThrow();
  });

  it('rejects a missing target state', () => {
    expect(() => advanceStatusSchema.parse({})).toThrow();
  });
});

describe('moduleStatusSchema', () => {
  it('accepts a status with a timestamp', () => {
    const parsed = moduleStatusSchema.parse({
      module: 'admin-operation',
      state: 'open',
      updatedAt: '2026-10-04T00:00:00.000Z',
    });
    expect(parsed.module).toBe('admin-operation');
  });

  it('accepts a null timestamp', () => {
    expect(moduleStatusSchema.parse({ module: 'wallet-ledger', state: 'active', updatedAt: null })).toEqual({
      module: 'wallet-ledger',
      state: 'active',
      updatedAt: null,
    });
  });

  it('rejects a malformed timestamp', () => {
    expect(() =>
      moduleStatusSchema.parse({ module: 'schedule', state: 'open', updatedAt: 'yesterday' }),
    ).toThrow();
  });
});

describe('advanceStatusResultSchema', () => {
  it('round-trips previous and new state', () => {
    expect(advanceStatusResultSchema.parse({ previousState: 'draft', newState: 'submitted' })).toEqual({
      previousState: 'draft',
      newState: 'submitted',
    });
  });
});

describe('eventEnvelopeSchema', () => {
  it('accepts a well-formed envelope', () => {
    const parsed = eventEnvelopeSchema.parse({
      id: '7f9a1c2e-3b4d-4e5f-8a9b-0c1d2e3f4a5b',
      eventType: 'admin-operation.status.changed',
      occurredAt: '2026-10-04T12:00:00.000Z',
      payload: { module: 'admin-operation' },
    });
    expect(parsed.eventType).toBe('admin-operation.status.changed');
  });

  it('rejects a non-uuid id', () => {
    expect(() =>
      eventEnvelopeSchema.parse({
        id: 'not-a-uuid',
        eventType: 'x',
        occurredAt: '2026-10-04T12:00:00.000Z',
        payload: {},
      }),
    ).toThrow();
  });
});

describe('bookingConfirmedSchema', () => {
  it('accepts a positive integer credit amount', () => {
    const parsed = bookingConfirmedSchema.parse({
      bookingId: 'b-1',
      studentId: 's-1',
      teacherId: 't-1',
      amountCredits: 25,
    });
    expect(parsed.amountCredits).toBe(25);
  });

  it('rejects zero credits', () => {
    expect(() =>
      bookingConfirmedSchema.parse({
        bookingId: 'b-1',
        studentId: 's-1',
        teacherId: 't-1',
        amountCredits: 0,
      }),
    ).toThrow();
  });

  it('rejects fractional credits', () => {
    expect(() =>
      bookingConfirmedSchema.parse({
        bookingId: 'b-1',
        studentId: 's-1',
        teacherId: 't-1',
        amountCredits: 1.5,
      }),
    ).toThrow();
  });
});

describe('statusChangedSchema', () => {
  it('accepts a full transition payload', () => {
    const parsed = statusChangedSchema.parse({
      module: 'skill-verification',
      previousState: 'submitted',
      newState: 'assessing',
      changedBy: 'user-42',
      changedAt: '2026-10-04T12:00:00.000Z',
    });
    expect(parsed.newState).toBe('assessing');
  });
});

describe('apiErrorSchema', () => {
  it('accepts an error without the optional code', () => {
    expect(apiErrorSchema.parse({ statusCode: 409, message: 'conflict' })).toEqual({
      statusCode: 409,
      message: 'conflict',
    });
  });

  it('accepts an error with the optional code', () => {
    expect(apiErrorSchema.parse({ statusCode: 400, message: 'bad', error: 'Bad Request' }).error).toBe(
      'Bad Request',
    );
  });
});

describe('identityHeadersSchema', () => {
  it('accepts empty headers', () => {
    expect(identityHeadersSchema.parse({})).toEqual({});
  });

  it('accepts gateway-injected headers', () => {
    const parsed = identityHeadersSchema.parse({
      'x-user-id': 'user-1',
      'x-user-email': 'a@b.co',
      'x-user-role': 'student',
    });
    expect(parsed['x-user-id']).toBe('user-1');
  });

  it('rejects a malformed email', () => {
    expect(() => identityHeadersSchema.parse({ 'x-user-email': 'nope' })).toThrow();
  });
});

describe('createClassSchema', () => {
  const valid = {
    skillIds: ['skill-1'],
    description: 'Intro to guitar',
    startsAt: '2026-10-10T10:00:00.000Z',
    durationMinutes: 60,
    priceCredits: 100,
    capacity: 1,
  };

  it('accepts a valid class payload', () => {
    expect(createClassSchema.parse(valid)).toEqual(valid);
  });

  it('enforces the 30 to 180 minute duration', () => {
    expect(() => createClassSchema.parse({ ...valid, durationMinutes: 29 })).toThrow();
    expect(() => createClassSchema.parse({ ...valid, durationMinutes: 181 })).toThrow();
    expect(createClassSchema.parse({ ...valid, durationMinutes: 30 }).durationMinutes).toBe(30);
    expect(createClassSchema.parse({ ...valid, durationMinutes: 180 }).durationMinutes).toBe(180);
  });

  it('rejects a non-positive capacity (OQ-007)', () => {
    expect(() => createClassSchema.parse({ ...valid, capacity: 0 })).toThrow();
    expect(() => createClassSchema.parse({ ...valid, capacity: -1 })).toThrow();
    expect(createClassSchema.parse({ ...valid, capacity: 5 }).capacity).toBe(5);
  });

  it('rejects a non-positive price and an empty skill list', () => {
    expect(() => createClassSchema.parse({ ...valid, priceCredits: 0 })).toThrow();
    expect(() => createClassSchema.parse({ ...valid, skillIds: [] })).toThrow();
  });
});

describe('classSchema', () => {
  it('round-trips a published class view', () => {
    const view = {
      id: 'cls-1',
      teacherId: 'teacher-1',
      state: 'published',
      startsAt: '2026-10-10T10:00:00.000Z',
      durationMinutes: 60,
      priceCredits: 100,
      capacity: 2,
    };
    expect(classSchema.parse(view)).toEqual(view);
  });
});

describe('updateClassSchema (FR-007 / AC-017)', () => {
  it('accepts a partial edit', () => {
    expect(updateClassSchema.parse({ capacity: 5 })).toEqual({ capacity: 5 });
  });

  it('rejects an empty edit and out-of-range values', () => {
    expect(() => updateClassSchema.parse({})).toThrow();
    expect(() => updateClassSchema.parse({ durationMinutes: 10 })).toThrow();
    expect(() => updateClassSchema.parse({ priceCredits: 0 })).toThrow();
  });
});

describe('bookingCancelledSchema (FR-007 / ADR-019)', () => {
  it('accepts a cancellation event and rejects an unknown reason', () => {
    const event = {
      bookingId: 'b1',
      classId: 'c1',
      learnerId: 'l1',
      teacherId: 't1',
      priceCredits: 100,
      reason: 'class_cancelled',
    };
    expect(bookingCancelledSchema.parse(event)).toEqual(event);
    expect(() => bookingCancelledSchema.parse({ ...event, reason: 'oops' })).toThrow();
  });
});

describe('bookingRequestSchema', () => {
  it('accepts an idempotency key', () => {
    expect(bookingRequestSchema.parse({ idempotencyKey: 'key-1' })).toEqual({
      idempotencyKey: 'key-1',
    });
  });

  it('rejects an empty idempotency key', () => {
    expect(() => bookingRequestSchema.parse({ idempotencyKey: '' })).toThrow();
    expect(() => bookingRequestSchema.parse({})).toThrow();
  });
});

describe('bookingSchema', () => {
  it('round-trips a booking view', () => {
    const view = {
      bookingId: 'bkg-1',
      classId: 'cls-1',
      learnerId: 'learner-1',
      state: 'pending',
      priceCredits: 100,
      createdAt: '2026-10-08T00:00:00.000Z',
    };
    expect(bookingSchema.parse(view)).toEqual(view);
  });
});

describe('auth schemas (ADR-016)', () => {
  it('accepts a valid registration and defaults the role to learner', () => {
    const parsed = registerSchema.parse({
      email: 'a@b.co',
      displayName: 'An',
      password: 'secret-password',
    });
    expect(parsed.role).toBe('learner');
  });

  it('rejects a short password and a bad email', () => {
    expect(() => registerSchema.parse({ email: 'a@b.co', displayName: 'An', password: 'short' })).toThrow();
    expect(() =>
      registerSchema.parse({ email: 'nope', displayName: 'An', password: 'secret-password' }),
    ).toThrow();
  });

  it('accepts only the known account roles', () => {
    expect(accountRoleSchema.parse('teacher')).toBe('teacher');
    expect(() => accountRoleSchema.parse('superuser')).toThrow();
  });

  it('round-trips a token response', () => {
    const token = { accessToken: 'a', refreshToken: 'r', expiresIn: 900, tokenType: 'Bearer' as const };
    expect(tokenResponseSchema.parse(token)).toEqual(token);
  });

  it('round-trips a me response', () => {
    const me = { id: 'u1', email: 'a@b.co', displayName: 'An', role: 'learner', status: 'active' };
    expect(meResponseSchema.parse(me)).toEqual(me);
  });

  it('requires a non-empty refresh token', () => {
    expect(() => refreshRequestSchema.parse({ refreshToken: '' })).toThrow();
    expect(refreshRequestSchema.parse({ refreshToken: 'r' })).toEqual({ refreshToken: 'r' });
  });

  it('accepts a login payload and rejects a bad email', () => {
    expect(loginSchema.parse({ email: 'a@b.co', password: 'x' })).toEqual({
      email: 'a@b.co',
      password: 'x',
    });
    expect(() => loginSchema.parse({ email: 'nope', password: 'x' })).toThrow();
  });
});

describe('top-up schemas (FR-008)', () => {
  it('accepts a positive integer VND amount and rejects non-positive', () => {
    expect(topUpRequestSchema.parse({ amountVnd: 100_000 })).toEqual({ amountVnd: 100_000 });
    expect(() => topUpRequestSchema.parse({ amountVnd: 0 })).toThrow();
    expect(() => topUpRequestSchema.parse({ amountVnd: -1 })).toThrow();
    expect(() => topUpRequestSchema.parse({ amountVnd: 1.5 })).toThrow();
  });

  it('accepts only settled/failed/reversed callbacks', () => {
    expect(topUpCallbackSchema.parse({ providerRef: 'r', amountVnd: 1000, status: 'settled' }).status).toBe(
      'settled',
    );
    expect(() =>
      topUpCallbackSchema.parse({ providerRef: 'r', amountVnd: 1000, status: 'pending' }),
    ).toThrow();
  });

  it('round-trips an intent and a balance', () => {
    const intent = {
      id: 'i1',
      ownerId: 'u1',
      provider: 'mock',
      providerRef: 'r1',
      amountVnd: 100_000,
      amountCredits: 100,
      status: 'pending',
    };
    expect(topUpIntentSchema.parse(intent)).toEqual(intent);
    expect(walletBalanceSchema.parse({ availableCredits: 100, pendingCredits: 0 })).toEqual({
      availableCredits: 100,
      pendingCredits: 0,
    });
  });
});
