import {
  accountRoleSchema,
  adminDashboardSchema,
  adminVerificationQuerySchema,
  adminVerifierQueueQuerySchema,
  advanceStatusResultSchema,
  advanceStatusSchema,
  apiEnvelopeSchema,
  apiErrorItemSchema,
  apiErrorSchema,
  ApiResponseError,
  auditEventSchema,
  auditLogPageSchema,
  auditLogQuerySchema,
  bookingCancelledSchema,
  bookingConfirmedSchema,
  bookingRequestSchema,
  bookingSchema,
  bookClassResultSchema,
  cancelClassResultSchema,
  classCompletedSchema,
  classSchema,
  completeClassResultSchema,
  confirmBookingResultSchema,
  createClassSchema,
  documentUploadRequestSchema,
  documentUploadTargetSchema,
  errorEnvelopeSchema,
  envelopeErr,
  envelopeOk,
  EnvelopeResponseLike,
  eventEnvelopeSchema,
  evidenceAuditActionSchema,
  evidenceAuditEventSchema,
  evidenceStatusSchema,
  evidenceTypeSchema,
  identityHeadersSchema,
  httpStatusCode,
  loginSchema,
  markTeacherNoShowResultSchema,
  meResponseSchema,
  moduleStatusSchema,
  pageMetaSchema,
  pagedSchema,
  paginationQuerySchema,
  parseEnvelope,
  profileSkillSchema,
  refreshRequestSchema,
  registerSchema,
  roomAccessRequestSchema,
  roomAccessResponseSchema,
  selfRegistrationRoleSchema,
  skillEvidenceEventSchema,
  skillEvidenceHistorySchema,
  skillEvidenceViewSchema,
  skillEvidenceDecisionSchema,
  skillLevelSchema,
  skillSchema,
  startClassResultSchema,
  statusChangedSchema,
  studentVerificationEventSchema,
  studentVerificationSchema,
  submitSkillEvidenceSchema,
  submitStudentVerificationSchema,
  successEnvelopeSchema,
  sepayIpnSchema,
  tokenResponseSchema,
  topUpIntentSchema,
  topUpRequestSchema,
  updateClassSchema,
  unwrapEnvelope,
  verificationDecisionSchema,
  verificationRevocationSchema,
  verificationStatusSchema,
  verifierSchema,
  verifierStatusChangeSchema,
  verifierStatusSchema,
  walletBalanceSchema,
  walletHistoryItemSchema,
  walletHistoryPageSchema,
  walletHistoryQuerySchema,
} from './index';
import { z } from 'zod';

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
    expect(parsed.settled).toBe(false);
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

describe('apiErrorSchema (legacy shape, retained for reference)', () => {
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

describe('response envelope (NFR-013)', () => {
  it('accepts a success envelope with a null or object payload', () => {
    const ok = {
      success: true,
      code: 'WALLET_HISTORY_OK',
      message: 'Wallet history loaded',
      data: { items: [] },
      errors: [],
    };
    expect(apiEnvelopeSchema.parse(ok)).toEqual(ok);
    expect(apiEnvelopeSchema.parse({ ...ok, data: null }).data).toBeNull();
  });

  it('accepts a failure envelope and requires at least one error entry', () => {
    const bad = {
      success: false,
      code: 'ReasonRequiredError',
      message: 'A rejection requires a reason',
      data: null,
      errors: [{ code: 'ReasonRequiredError', message: 'A rejection requires a reason' }],
    };
    expect(apiEnvelopeSchema.parse(bad)).toEqual(bad);
    expect(() => apiEnvelopeSchema.parse({ ...bad, errors: [] })).not.toThrow();
  });

  it('rejects an error entry missing code or message', () => {
    expect(() => apiErrorItemSchema.parse({ code: 'X' })).toThrow();
    expect(() => apiErrorItemSchema.parse({ message: 'x' })).toThrow();
  });

  it('builds typed success and error envelopes', () => {
    expect(
      successEnvelopeSchema(z.array(z.string())).parse({
        success: true,
        code: 'PROFILE_SKILLS_OK',
        message: 'ok',
        data: ['a'],
        errors: [],
      }),
    ).toMatchObject({ data: ['a'] });
    expect(() =>
      successEnvelopeSchema(z.array(z.string())).parse({
        success: true,
        code: 'X',
        message: 'ok',
        data: ['a'],
        errors: [{ code: 'x', message: 'x' }],
      }),
    ).toThrow();
    expect(
      errorEnvelopeSchema().parse({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        data: null,
        errors: [{ code: 'INTERNAL_ERROR', message: 'Internal server error' }],
      }).success,
    ).toBe(false);
  });
});

describe('envelope runtime helpers (NFR-013, shared client layer)', () => {
  const okBody = { success: true, code: 'ME_OK', message: 'ok', data: { id: 'u1' }, errors: [] };
  const errBody = {
    success: false,
    code: 'ReasonRequiredError',
    message: 'A rejection requires a reason',
    data: null,
    errors: [{ code: 'ReasonRequiredError', message: 'A rejection requires a reason' }],
  };

  function res(body: unknown, status = 200): EnvelopeResponseLike {
    return { status, json: async () => body };
  }

  it('parses a success envelope and returns it', () => {
    expect(parseEnvelope<{ id: string }>(okBody).data).toEqual({ id: 'u1' });
  });

  it('throws an ApiError carrying the stable code on a failure envelope', () => {
    let caught: unknown;
    try {
      parseEnvelope(errBody, 409);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ApiResponseError);
    expect((caught as ApiResponseError).code).toBe('ReasonRequiredError');
    expect((caught as ApiResponseError).errors).toHaveLength(1);
  });

  it('throws HTTP_<status> when the body is not an envelope at all', () => {
    expect(() => parseEnvelope({ not: 'an envelope' }, 500)).toThrow(ApiResponseError);
    try {
      parseEnvelope('boom', 500);
    } catch (error) {
      expect((error as ApiResponseError).code).toBe('HTTP_500');
    }
  });

  it('unwrapEnvelope returns data on success and throws on failure', async () => {
    await expect(unwrapEnvelope<{ id: string }>(res(okBody))).resolves.toEqual({ id: 'u1' });
    await expect(unwrapEnvelope(res(errBody, 409))).rejects.toBeInstanceOf(ApiResponseError);
  });

  it('envelopeOk/envelopeErr build canonical envelopes', () => {
    expect(envelopeOk(['a'], { code: 'X_OK', message: 'loaded' })).toEqual({
      success: true,
      code: 'X_OK',
      message: 'loaded',
      data: ['a'],
      errors: [],
    });
    expect(envelopeErr('Boom', 'it broke')).toMatchObject({
      success: false,
      code: 'Boom',
      data: null,
      errors: [{ code: 'Boom', message: 'it broke' }],
    });
  });

  it('httpStatusCode is the stable HTTP_<status> form', () => {
    expect(httpStatusCode(401)).toBe('HTTP_401');
  });
});

describe('pagination contracts (NFR-014)', () => {
  it('coerces limit and rejects out-of-range values', () => {
    expect(paginationQuerySchema.parse({ limit: '20' })).toEqual({ limit: 20 });
    expect(() => paginationQuerySchema.parse({ limit: 0 })).toThrow();
    expect(() => paginationQuerySchema.parse({ limit: 101 })).toThrow();
  });

  it('models page metadata with a non-null total and a nullable cursor', () => {
    const meta = { limit: 20, nextCursor: null, total: 0 };
    expect(pageMetaSchema.parse(meta)).toEqual(meta);
    expect(pageMetaSchema.parse({ limit: 20, nextCursor: 'abc', total: 137 }).total).toBe(137);
  });

  it('wraps an item schema into a paged collection', () => {
    const page = pagedSchema(walletHistoryItemSchema).parse({
      items: [],
      page: { limit: 20, nextCursor: null, total: 0 },
    });
    expect(page.page.total).toBe(0);
    expect(page.items).toEqual([]);
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

describe('room access schemas (FR-011 / ADR-020)', () => {
  it('accepts an optional display name', () => {
    expect(roomAccessRequestSchema.parse({})).toEqual({});
    expect(roomAccessRequestSchema.parse({ displayName: 'An' })).toEqual({ displayName: 'An' });
  });

  it('round-trips a room access response', () => {
    const response = {
      room: 'skillswap-cls-1',
      token: 'a.b.c',
      expiresAt: '2026-10-12T10:00:00.000Z',
      url: 'https://localhost:8443/skillswap-cls-1',
    };
    expect(roomAccessResponseSchema.parse(response)).toEqual(response);
  });
});

describe('wallet history schemas (FR-010 / ADR-022)', () => {
  it('coerces query params and defaults are optional', () => {
    expect(walletHistoryQuerySchema.parse({})).toEqual({});
    expect(walletHistoryQuerySchema.parse({ limit: '20', cursor: 'abc' })).toEqual({
      limit: 20,
      cursor: 'abc',
    });
    expect(() => walletHistoryQuerySchema.parse({ limit: 0 })).toThrow();
    expect(() => walletHistoryQuerySchema.parse({ limit: 101 })).toThrow();
  });

  it('accepts only completed/reversed display statuses', () => {
    const item = {
      id: '1',
      type: 'top_up',
      direction: 'credit',
      amountCredits: 100,
      status: 'completed',
      reference: null,
      createdAt: '2026-10-12T10:00:00.000Z',
    };
    expect(walletHistoryItemSchema.parse(item)).toEqual(item);
    expect(() => walletHistoryItemSchema.parse({ ...item, status: 'pending' })).toThrow();
    expect(() => walletHistoryItemSchema.parse({ ...item, amountCredits: -5 })).toThrow();
  });

  it('round-trips a paged result with metadata (NFR-014)', () => {
    const page = { items: [], page: { limit: 20, nextCursor: 'xyz', total: 3 } };
    expect(walletHistoryPageSchema.parse(page)).toEqual(page);
  });
});

describe('classCompletedSchema (FR-020 / ADR-021)', () => {
  it('accepts a completion with its confirmed bookings', () => {
    const event = {
      classId: 'cls-1',
      teacherId: 't1',
      basis: 'scheduled_end',
      completedAt: '2026-10-12T11:00:00.000Z',
      bookings: [{ bookingId: 'b1', learnerId: 'l1', priceCredits: 100 }],
    };
    expect(classCompletedSchema.parse(event)).toEqual(event);
  });

  it('rejects an unknown basis', () => {
    expect(() =>
      classCompletedSchema.parse({
        classId: 'cls-1',
        teacherId: 't1',
        basis: 'made_up',
        completedAt: '2026-10-12T11:00:00.000Z',
        bookings: [],
      }),
    ).toThrow();
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

describe('class lifecycle result schemas (FR-007 / FR-020)', () => {
  const booking = {
    bookingId: 'bkg-1',
    classId: 'cls-1',
    learnerId: 'learner-1',
    state: 'pending',
    priceCredits: 100,
    createdAt: '2026-10-08T00:00:00.000Z',
  };

  it('bookClassResultSchema wraps a booking and its idempotency flag', () => {
    expect(bookClassResultSchema.parse({ booking, created: true })).toEqual({
      booking,
      created: true,
    });
  });

  it('confirmBookingResultSchema allows a null booking when nothing was pending', () => {
    expect(confirmBookingResultSchema.parse({ confirmed: false, booking: null })).toEqual({
      confirmed: false,
      booking: null,
    });
  });

  it('cancelClassResultSchema counts affected bookings', () => {
    expect(cancelClassResultSchema.parse({ classCancelled: true, bookingsCancelled: 3 })).toEqual({
      classCancelled: true,
      bookingsCancelled: 3,
    });
    expect(() => cancelClassResultSchema.parse({ classCancelled: true, bookingsCancelled: -1 })).toThrow();
  });

  it('markTeacherNoShowResultSchema and startClassResultSchema carry a boolean', () => {
    expect(markTeacherNoShowResultSchema.parse({ cancelled: true })).toEqual({ cancelled: true });
    expect(startClassResultSchema.parse({ started: false })).toEqual({ started: false });
  });

  it('completeClassResultSchema allows a null basis when not completed', () => {
    expect(completeClassResultSchema.parse({ completed: false, basis: null })).toEqual({
      completed: false,
      basis: null,
    });
    expect(completeClassResultSchema.parse({ completed: true, basis: 'scheduled_end' })).toEqual({
      completed: true,
      basis: 'scheduled_end',
    });
  });
});

describe('auth schemas (ADR-016)', () => {
  it('accepts a valid registration and defaults the role to user', () => {
    const parsed = registerSchema.parse({
      email: 'a@b.co',
      displayName: 'An',
      password: 'secret-password',
    });
    expect(parsed.role).toBe('user');
  });

  it('rejects a short password and a bad email', () => {
    expect(() => registerSchema.parse({ email: 'a@b.co', displayName: 'An', password: 'short' })).toThrow();
    expect(() =>
      registerSchema.parse({ email: 'nope', displayName: 'An', password: 'secret-password' }),
    ).toThrow();
  });

  it('accepts only the known account roles', () => {
    expect(accountRoleSchema.parse('user')).toBe('user');
    expect(accountRoleSchema.parse('verifier')).toBe('verifier');
    expect(accountRoleSchema.options).toEqual(['user', 'verifier', 'admin']);
    expect(() => accountRoleSchema.parse('superuser')).toThrow();
    expect(() => accountRoleSchema.parse('learner')).toThrow();
    expect(() => accountRoleSchema.parse('teacher')).toThrow();
  });

  it('restricts public registration to the ordinary user role (ADR-030)', () => {
    expect(selfRegistrationRoleSchema.options).toEqual(['user']);
    expect(registerSchema.parse({ email: 'a@b.co', displayName: 'A', password: 'password1' }).role).toBe(
      'user',
    );
    expect(() =>
      registerSchema.parse({ email: 'a@b.co', displayName: 'A', password: 'password1', role: 'admin' }),
    ).toThrow();
    expect(() =>
      registerSchema.parse({ email: 'a@b.co', displayName: 'A', password: 'password1', role: 'verifier' }),
    ).toThrow();
  });

  it('round-trips a token response', () => {
    const token = { accessToken: 'a', refreshToken: 'r', expiresIn: 900, tokenType: 'Bearer' as const };
    expect(tokenResponseSchema.parse(token)).toEqual(token);
  });

  it('round-trips a me response', () => {
    const me = {
      id: 'u1',
      email: 'a@b.co',
      displayName: 'An',
      role: 'user',
      status: 'active',
      studentVerification: null,
    };
    expect(meResponseSchema.parse(me)).toEqual(me);
  });

  it('round-trips a me response with a projected verification (FR-017)', () => {
    const me = {
      id: 'u1',
      email: 'a@b.co',
      displayName: 'An',
      role: 'user',
      status: 'active',
      studentVerification: { status: 'rejected', reason: 'Illegible document' },
    };
    expect(meResponseSchema.parse(me)).toEqual(me);
    expect(
      meResponseSchema.parse({ ...me, studentVerification: { status: 'approved', reason: null } })
        .studentVerification?.status,
    ).toBe('approved');
    expect(() =>
      meResponseSchema.parse({ ...me, studentVerification: { status: 'expired', reason: null } }),
    ).toThrow();
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

  it('carries an optional per-request returnUrl', () => {
    // Omitted (the API falls back to the configured return URL) …
    expect(topUpRequestSchema.parse({ amountVnd: 100_000 }).returnUrl).toBeUndefined();
    // … or supplied by the client. The *allow-list* is the API's job; the
    // contract only pins that the field travels as a non-empty string.
    expect(
      topUpRequestSchema.parse({ amountVnd: 100_000, returnUrl: 'skillswap://wallet' })
        .returnUrl,
    ).toBe('skillswap://wallet');
    expect(() => topUpRequestSchema.parse({ amountVnd: 100_000, returnUrl: '' })).toThrow();
  });

  it('accepts a SePay IPN whose amounts are strings or numbers', () => {
    const base = {
      notification_type: 'ORDER_PAID',
      order: { order_invoice_number: 'SS-1-A1B2C3' },
    };
    // Live Sandbox delivery: string amounts with a fractional part.
    expect(
      sepayIpnSchema.parse({ ...base, order: { ...base.order, order_amount: '10000.00' } }).order
        .order_amount,
    ).toBe('10000.00');
    // SePay's own test send: numeric amounts.
    expect(
      sepayIpnSchema.parse({
        ...base,
        order: { ...base.order, order_amount: 50000 },
      }).order.order_amount,
    ).toBe(50000);
    expect(() =>
      sepayIpnSchema.parse({ notification_type: 'ORDER_PAID', order: {} }),
    ).toThrow();
  });

  it('round-trips an intent and a balance', () => {
    const intent = {
      id: 'i1',
      ownerId: 'u1',
      provider: 'sepay',
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

describe('student verification contracts', () => {
  it('accepts a submission with or without a major', () => {
    expect(
      submitStudentVerificationSchema.parse({
        schoolName: 'FPT University',
        documentId: 'doc-1',
      }),
    ).toEqual({ schoolName: 'FPT University', documentId: 'doc-1' });
    expect(
      submitStudentVerificationSchema.parse({
        schoolName: 'FPT University',
        major: 'SE',
        documentId: 'doc-1',
      }).major,
    ).toBe('SE');
  });

  it('rejects an empty school name or document id', () => {
    expect(() =>
      submitStudentVerificationSchema.parse({ schoolName: '', documentId: 'd' }),
    ).toThrow();
    expect(() =>
      submitStudentVerificationSchema.parse({ schoolName: 'FPT', documentId: '' }),
    ).toThrow();
  });

  it('validates the document upload request and target', () => {
    expect(
      documentUploadRequestSchema.parse({
        fileName: 'transcript.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      }),
    ).toEqual({ fileName: 'transcript.pdf', contentType: 'application/pdf', sizeBytes: 1024 });
    expect(() =>
      documentUploadRequestSchema.parse({ fileName: 'x.pdf', contentType: 'application/pdf', sizeBytes: 0 }),
    ).toThrow();
    const target = {
      documentId: 'd1',
      uploadUrl: 'https://s3.local/bucket/k?sig=x',
      objectKey: 'a1/d1.pdf',
      expiresAt: '2026-10-10T00:15:00.000Z',
    };
    expect(documentUploadTargetSchema.parse(target)).toEqual(target);
  });

  it('requires a reason to reject', () => {
    expect(() => verificationDecisionSchema.parse({ decision: 'reject' })).toThrow();
    expect(() => verificationDecisionSchema.parse({ decision: 'reject', reason: '  ' })).toThrow();
    expect(
      verificationDecisionSchema.parse({ decision: 'reject', reason: 'illegible' }),
    ).toEqual({ decision: 'reject', reason: 'illegible' });
  });

  it('accepts an approval without a reason', () => {
    expect(
      verificationDecisionSchema.parse({ decision: 'approve', approvedMajor: 'SE' }),
    ).toEqual({ decision: 'approve', approvedMajor: 'SE' });
  });

  it('validates the revocation request (FR-019)', () => {
    expect(verificationRevocationSchema.parse({ reason: 'Fake document' })).toEqual({
      reason: 'Fake document',
    });
    expect(() => verificationRevocationSchema.parse({ reason: '' })).toThrow();
    expect(() => verificationRevocationSchema.parse({})).toThrow();
  });

  it('round-trips the owner-scoped view', () => {
    const view = {
      id: 'v1',
      status: 'rejected',
      schoolName: 'FPT University',
      major: null,
      reviewerId: 'admin-1',
      reason: 'illegible document',
      decidedAt: '2026-10-10T00:00:00.000Z',
      submittedAt: '2026-10-09T00:00:00.000Z',
    };
    expect(studentVerificationSchema.parse(view)).toEqual(view);
  });

  it('rejects the removed superseded status and drops expiry (dev decisions)', () => {
    expect(verificationStatusSchema.safeParse('superseded').success).toBe(false);
    expect(verificationStatusSchema.parse('revoked')).toBe('revoked');
    const parsed = studentVerificationSchema.parse({
      id: 'v1',
      status: 'approved',
      schoolName: 'FPT',
      major: null,
      reviewerId: 'admin',
      reason: null,
      decidedAt: '2026-10-10T00:00:00.000Z',
      expiresAt: '2027-10-10T00:00:00.000Z',
      submittedAt: '2026-10-09T00:00:00.000Z',
    });
    expect(parsed).not.toHaveProperty('expiresAt');
  });

  it('validates the emitted event payload', () => {
    const event = {
      verificationId: 'v1',
      accountId: 'a1',
      status: 'approved',
      schoolName: 'FPT University',
      reason: null,
      occurredAt: '2026-10-10T00:00:00.000Z',
    };
    expect(studentVerificationEventSchema.parse(event)).toEqual(event);
    expect(() => studentVerificationEventSchema.parse({ ...event, status: 'nope' })).toThrow();
  });

  describe('FR-003 skill evidence (ADR-026)', () => {
    it('exposes the fixed ordered level scale and evidence enums', () => {
      expect(skillLevelSchema.options).toEqual(['beginner', 'intermediate', 'advanced', 'expert']);
      expect(evidenceTypeSchema.options).toEqual(['certificate', 'verifier_assessment']);
      expect(evidenceStatusSchema.options).toEqual(['pending', 'claimed', 'approved', 'rejected', 'superseded']);
      expect(skillLevelSchema.safeParse('master').success).toBe(false);
    });

    it('validates a taxonomy skill and the profile-skill level cache', () => {
      const skill = { id: 'sk-1', name: 'IELTS', category: 'Languages' };
      expect(skillSchema.parse(skill)).toEqual(skill);

      const link = {
        id: 'ps-1',
        skillId: 'sk-1',
        skillName: 'IELTS',
        category: 'Languages',
        approvedLevel: 'advanced',
      };
      expect(profileSkillSchema.parse(link)).toEqual(link);
      expect(profileSkillSchema.parse({ ...link, approvedLevel: null }).approvedLevel).toBeNull();
    });

    it('validates a submit-evidence input and an evidence view', () => {
      const input = {
        skillId: 'sk-1',
        requestedLevel: 'intermediate',
        evidenceType: 'certificate',
        documentRef: 'docs/cert.pdf',
      };
      expect(submitSkillEvidenceSchema.parse(input)).toEqual(input);

      const view = {
        id: 'ev-1',
        profileSkillId: 'ps-1',
        skillId: 'sk-1',
        skillName: 'IELTS',
        category: 'Languages',
        ownerId: 'acc-1',
        version: 1,
        evidenceType: 'certificate',
        documentRef: 'docs/cert.pdf',
        description: null,
        requestedLevel: 'intermediate',
        approvedLevel: null,
        status: 'pending',
        claimedBy: null,
        claimedAt: null,
        reason: null,
        decidedAt: null,
        submittedAt: '2026-10-11T00:00:00.000Z',
      };
      expect(skillEvidenceViewSchema.parse(view)).toEqual(view);
    });

    it('validates the emitted evidence event payload', () => {
      const event = {
        evidenceId: 'ev-1',
        profileSkillId: 'ps-1',
        accountId: 'a1',
        skillId: 'sk-1',
        version: 1,
        requestedLevel: 'intermediate',
        status: 'pending',
        occurredAt: '2026-10-11T00:00:00.000Z',
      };
      expect(skillEvidenceEventSchema.parse(event)).toEqual(event);
      expect(() => skillEvidenceEventSchema.parse({ ...event, status: 'nope' })).toThrow();

      // A decision event carries the effective approved level (FR-005 gate consumes it).
      const approved = {
        ...event,
        status: 'approved',
        approvedLevel: 'advanced',
        reason: null,
      };
      expect(skillEvidenceEventSchema.parse(approved)).toEqual(approved);
    });

    it('validates a verifier, its status change and a decision (FR-004)', () => {
      const verifier = { accountId: 'vf-1', status: 'active', expertise: ['sk-1', 'sk-2'] };
      expect(verifierSchema.parse(verifier)).toEqual(verifier);
      expect(verifierStatusSchema.options).toEqual(['active', 'suspended', 'revoked']);
      expect(verifierStatusChangeSchema.parse({ status: 'suspended' })).toEqual({ status: 'suspended' });

      expect(skillEvidenceDecisionSchema.parse({ decision: 'approve' })).toEqual({ decision: 'approve' });
      expect(
        skillEvidenceDecisionSchema.parse({ decision: 'approve', approvedLevel: 'advanced' }),
      ).toEqual({ decision: 'approve', approvedLevel: 'advanced' });
      // A rejection requires a reason; an approval does not.
      expect(skillEvidenceDecisionSchema.safeParse({ decision: 'reject' }).success).toBe(false);
      expect(
        skillEvidenceDecisionSchema.safeParse({ decision: 'reject', reason: 'Illegible' }).success,
      ).toBe(true);
    });

    it('validates the audit event and evidence history (FR-018)', () => {
      expect(evidenceAuditActionSchema.options).toEqual([
        'submitted',
        'claimed',
        'approved',
        'rejected',
        'superseded',
      ]);

      const audit = {
        id: 'a-1',
        evidenceId: 'ev-1',
        version: 1,
        action: 'approved',
        actorId: 'vf-1',
        fromStatus: 'pending',
        toStatus: 'approved',
        reason: null,
        snapshot: {
          version: 1,
          status: 'approved',
          evidenceType: 'certificate',
          requestedLevel: 'intermediate',
          approvedLevel: 'intermediate',
          reason: null,
        },
        occurredAt: '2026-10-11T00:00:00.000Z',
        traceId: null,
      };
      expect(evidenceAuditEventSchema.parse(audit)).toEqual(audit);
      expect(() => evidenceAuditEventSchema.parse({ ...audit, action: 'nope' })).toThrow();

      const history = {
        profileSkillId: 'ps-1',
        skillId: 'sk-1',
        versions: [
          {
            version: 1,
            evidenceId: 'ev-1',
            currentStatus: 'approved',
            requestedLevel: 'intermediate',
            approvedLevel: 'intermediate',
            submittedAt: '2026-10-11T00:00:00.000Z',
            entries: [audit],
          },
        ],
      };
      expect(skillEvidenceHistorySchema.parse(history)).toEqual(history);
    });
  });

  /**
   * FR-015 / ADR-034: the admin operations contracts.
   *
   * The general audit row is separate from FR-018's evidence entry (ADR-034 §1), so it is pinned
   * on its own terms: the SRS shape, an open action/target set with a constrained form, and the
   * NFR-005 guarantee that a snapshot cannot smuggle document contents through a nested object.
   */
  describe('admin operations contracts (FR-015)', () => {
    const event = {
      id: 'audit-1',
      actorId: 'admin-1',
      action: 'student.verification.approved',
      targetType: 'verification',
      targetId: 'v-1',
      oldState: { status: 'pending' },
      newState: { status: 'approved' },
      occurredAt: '2026-10-15T00:00:00.000Z',
      traceId: null,
      metadata: null,
      sourceEventId: 'evt-1',
    };

    it('round-trips the general SRS audit row', () => {
      expect(auditEventSchema.parse(event)).toEqual(event);
    });

    it('accepts a row with no actor or target (system-initiated actions)', () => {
      const system = { ...event, actorId: null, targetId: null, sourceEventId: null };
      expect(auditEventSchema.parse(system)).toEqual(system);
    });

    it('rejects an action that is not a dotted lowercase identifier', () => {
      for (const action of ['Approved', 'approved', 'student..approved', 'a b.c', '']) {
        expect(() => auditEventSchema.parse({ ...event, action })).toThrow();
      }
    });

    it('rejects a malformed target type', () => {
      for (const targetType of ['Verification', 'has-dash', 'has space']) {
        expect(() => auditEventSchema.parse({ ...event, targetType })).toThrow();
      }
    });

    it('refuses a nested snapshot so a document cannot ride along (NFR-005)', () => {
      expect(() =>
        auditEventSchema.parse({
          ...event,
          oldState: { document: { contents: 'base64…' } },
        }),
      ).toThrow();
      expect(() =>
        auditEventSchema.parse({ ...event, metadata: { list: ['a', 'b'] } }),
      ).toThrow();
    });

    it('bounded-pages the audit log with the FR-015 filters', () => {
      const parsed = auditLogQuerySchema.parse({
        actorId: 'admin-1',
        action: 'student.verification.revoked',
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-15T00:00:00.000Z',
        sort: '-occurredAt',
      });
      expect(parsed.actorId).toBe('admin-1');
      expect(parsed.sort).toBe('-occurredAt');
    });

    it('rejects an unwhitelisted audit sort and an over-limit page', () => {
      expect(() => auditLogQuerySchema.parse({ sort: 'actorId' })).toThrow();
      expect(() => auditLogQuerySchema.parse({ limit: 101 })).toThrow();
    });

    it('bounds the admin verification queue query', () => {
      expect(adminVerificationQuerySchema.parse({ status: 'pending', sort: '-decidedAt' })).toEqual({
        status: 'pending',
        sort: '-decidedAt',
      });
      expect(() => adminVerificationQuerySchema.parse({ status: 'nope' })).toThrow();
      expect(() => adminVerificationQuerySchema.parse({ limit: 0 })).toThrow();
      expect(() => adminVerificationQuerySchema.parse({ limit: 101 })).toThrow();
    });

    it('bounds the admin verifier queue query', () => {
      expect(adminVerifierQueueQuerySchema.parse({ domain: 'Languages' })).toEqual({
        domain: 'Languages',
      });
      expect(() => adminVerifierQueueQuerySchema.parse({ status: 'nope' })).toThrow();
      expect(() => adminVerifierQueueQuerySchema.parse({ sort: 'decidedAt' })).toThrow();
    });

    it('accepts a comma-separated status list, for the queue\'s live-work view', () => {
      // The screen's default is unclaimed + in review at once. One status per request could not
      // express it, and paging two queries would split the shared total and the keyset cursor.
      expect(adminVerifierQueueQuerySchema.parse({ status: 'pending,claimed' })).toEqual({
        status: ['pending', 'claimed'],
      });
      expect(adminVerifierQueueQuerySchema.parse({ status: 'pending' })).toEqual({
        status: ['pending'],
      });
      // Whitespace is tolerated so a hand-written URL is not a 400.
      expect(adminVerifierQueueQuerySchema.parse({ status: ' pending , claimed ' })).toEqual({
        status: ['pending', 'claimed'],
      });
      // An empty list is not "no filter" — that is `status` omitted. Reject it rather than
      // silently returning the whole table for a typo like `?status=`.
      expect(() => adminVerifierQueueQuerySchema.parse({ status: '' })).toThrow();
      // A trailing comma is a hand-written URL, not a different query: empty parts drop out.
      expect(adminVerifierQueueQuerySchema.parse({ status: 'pending,' })).toEqual({
        status: ['pending'],
      });
      expect(() => adminVerifierQueueQuerySchema.parse({ status: 'pending,nope' })).toThrow();
    });

    it('composes the operations dashboard without any optional field', () => {
      const dashboard = {
        verifications: { pending: 3, approved: 5, rejected: 1, revoked: 2 },
        evidence: { pending: 4, claimed: 2, approved: 9, rejected: 1, superseded: 1 },
        evidenceByDomain: { Programming: 6, Languages: 1 },
        recentAuditEvents: [event],
        generatedAt: '2026-10-15T00:00:00.000Z',
      };
      expect(adminDashboardSchema.parse(dashboard)).toEqual(dashboard);
    });

    it('rejects a negative count, because a count of rows cannot be below zero', () => {
      expect(() =>
        adminDashboardSchema.parse({
          verifications: { pending: -1, approved: 0, rejected: 0, revoked: 0 },
          evidence: { pending: 0, claimed: 0, approved: 0, rejected: 0, superseded: 0 },
          evidenceByDomain: {},
          recentAuditEvents: [],
          generatedAt: '2026-10-15T00:00:00.000Z',
        }),
      ).toThrow();
    });

    it('requires every count group in full, so a blank is never a missing key', () => {
      expect(() =>
        adminDashboardSchema.parse({
          verifications: { pending: 0 },
          evidence: { pending: 0, claimed: 0, approved: 0, rejected: 0, superseded: 0 },
          evidenceByDomain: {},
          recentAuditEvents: [],
          generatedAt: '2026-10-15T00:00:00.000Z',
        }),
      ).toThrow();
    });

    it('pages the audit log with the shared page metadata', () => {
      const page = auditLogPageSchema.parse({
        items: [event],
        page: { limit: 20, nextCursor: null, total: 1 },
      });
      expect(page.items).toHaveLength(1);
      expect(page.page.total).toBe(1);
    });

    it('rejects an audit page whose cursor is an empty string', () => {
      expect(() =>
        auditLogPageSchema.parse({ items: [], page: { limit: 20, nextCursor: '', total: 0 } }),
      ).toThrow();
    });
  });
});
