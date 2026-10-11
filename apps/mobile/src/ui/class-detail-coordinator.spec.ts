import { SessionExpiredRetryRequiredError } from '@/application/port/session-types';
import type { BookingHttpGateway } from '@/infrastructure/http/booking-http-gateway';
import { GatewayHttpError } from '@/infrastructure/http/gateway-client';
import type { BookClassResponse, ClassDetailView } from '@skillswap/contracts';
import { ClassDetailCoordinator } from './class-detail-coordinator';

describe('ClassDetailCoordinator', () => {
  const sampleClassDetail: ClassDetailView = {
    id: 'class-1',
    teacher: {
      id: 'teacher-1',
      displayName: 'Teacher One',
      averageRating: 4.8,
      ratingsCount: 5,
    },
    skillIds: ['skill-1'],
    description: 'Advanced React Native',
    startsAt: '2026-10-30T10:00:00.000Z',
    durationMinutes: 60,
    priceCredits: 50,
    capacity: 10,
    availableSeats: 4,
    state: 'published',
    canBook: true,
    recentRatings: [],
    ownBooking: null,
  };

  const samplePendingBooking = {
    bookingId: 'booking-1',
    classId: 'class-1',
    learnerId: 'account-1',
    state: 'pending' as const,
    expiresAt: null,
    priceCredits: 50,
    createdAt: '2026-10-22T08:00:00.000Z',
  };

  let mockGateway: jest.Mocked<BookingHttpGateway>;

  beforeEach(() => {
    mockGateway = {
      getClassDetail: jest.fn().mockResolvedValue(sampleClassDetail),
      bookClass: jest.fn().mockResolvedValue({
        booking: samplePendingBooking,
        created: true,
      }),
      confirmBooking: jest.fn().mockResolvedValue({
        confirmed: true,
        booking: { ...samplePendingBooking, state: 'confirmed' },
      }),
      confirm: jest.fn().mockResolvedValue({
        confirmed: true,
        booking: { ...samplePendingBooking, state: 'confirmed' },
      }),
    } as unknown as jest.Mocked<BookingHttpGateway>;
  });

  it('preserves the exact same idempotency key across retries and does not reset on GET reload', async () => {
    const coordinator = new ClassDetailCoordinator({
      gateway: mockGateway,
      accountId: 'account-1',
      classId: 'class-1',
    });

    const key1 = coordinator.getStableIdempotencyKey();
    expect(key1).toBeTruthy();

    // Reload detail
    await coordinator.loadDetail();
    const key2 = coordinator.getStableIdempotencyKey();
    expect(key2).toBe(key1);

    // Book once
    await coordinator.bookClass();
    expect(mockGateway.bookClass).toHaveBeenCalledWith('class-1', key1);

    // Key remains identical for any subsequent retry
    const key3 = coordinator.getStableIdempotencyKey();
    expect(key3).toBe(key1);
  });

  it('synchronous busy guard prevents rapid concurrent double-booking clicks', async () => {
    let resolveBooking!: (val: BookClassResponse) => void;
    const slowBookingPromise = new Promise<BookClassResponse>((res) => {
      resolveBooking = res;
    });
    mockGateway.bookClass.mockReturnValueOnce(slowBookingPromise);

    const coordinator = new ClassDetailCoordinator({
      gateway: mockGateway,
      accountId: 'account-1',
      classId: 'class-1',
    });

    await coordinator.loadDetail();

    // Fire first click
    const firstCall = coordinator.bookClass();
    expect(coordinator.isBusy()).toBe(true);

    // Fire second click immediately while first is in-flight
    const secondCall = coordinator.bookClass();

    // Only 1 request was sent to gateway!
    expect(mockGateway.bookClass).toHaveBeenCalledTimes(1);

    // Settle first
    resolveBooking({ booking: samplePendingBooking, created: true });
    await Promise.all([firstCall, secondCall]);

    expect(coordinator.isBusy()).toBe(false);
  });

  it('discards stale GET responses after classId switch or unmount', async () => {
    let resolveFirstLoad!: (val: ClassDetailView) => void;
    const slowFirstLoad = new Promise<ClassDetailView>((res) => {
      resolveFirstLoad = res;
    });

    mockGateway.getClassDetail
      .mockReturnValueOnce(slowFirstLoad)
      .mockResolvedValueOnce({ ...sampleClassDetail, id: 'class-2', description: 'Class Two' });

    const isMounted = true;
    const coordinator = new ClassDetailCoordinator({
      gateway: mockGateway,
      accountId: 'account-1',
      classId: 'class-1',
      isMounted: () => isMounted,
    });

    const load1 = coordinator.loadDetail();
    // Trigger second load
    const load2 = coordinator.loadDetail();

    await load2;
    expect(coordinator.getState().classDetail?.id).toBe('class-2');

    // First load settles late
    resolveFirstLoad(sampleClassDetail);
    await load1;

    // Must still be class-2, NOT overwritten by stale response
    expect(coordinator.getState().classDetail?.id).toBe('class-2');
  });

  it('never fabricates success when confirm returns confirmed: false and null booking', async () => {
    const detailWithPending: ClassDetailView = {
      ...sampleClassDetail,
      ownBooking: {
        bookingId: 'booking-1',
        state: 'pending',
        expiresAt: '2026-10-30T10:15:00.000Z',
      },
    };

    mockGateway.getClassDetail.mockResolvedValue(detailWithPending);
    mockGateway.confirmBooking.mockResolvedValueOnce({
      confirmed: false,
      booking: null,
    });

    const coordinator = new ClassDetailCoordinator({
      gateway: mockGateway,
      accountId: 'account-1',
      classId: 'class-1',
    });

    await coordinator.loadDetail();
    await coordinator.confirmBooking();

    // State must NOT be confirmed_success!
    expect(coordinator.getState().phase).not.toBe('confirmed_success');
    expect(coordinator.getState().errorMessage).toContain('could not be completed');
  });

  it('marks confirmed_success only when authoritative reread confirms ownBooking.state === confirmed', async () => {
    const detailWithPending: ClassDetailView = {
      ...sampleClassDetail,
      ownBooking: {
        bookingId: 'booking-1',
        state: 'pending',
        expiresAt: '2026-10-30T10:15:00.000Z',
      },
    };

    const detailWithConfirmed: ClassDetailView = {
      ...sampleClassDetail,
      ownBooking: {
        bookingId: 'booking-1',
        state: 'confirmed',
        expiresAt: null,
      },
    };

    mockGateway.getClassDetail
      .mockResolvedValueOnce(detailWithPending)
      .mockResolvedValueOnce(detailWithConfirmed);

    mockGateway.confirmBooking.mockResolvedValueOnce({
      confirmed: true,
      booking: { ...samplePendingBooking, state: 'confirmed' },
    });

    const onBalanceInvalidated = jest.fn();
    const coordinator = new ClassDetailCoordinator({
      gateway: mockGateway,
      accountId: 'account-1',
      classId: 'class-1',
      onBalanceInvalidated,
    });

    await coordinator.loadDetail();
    await coordinator.confirmBooking();

    expect(coordinator.getState().phase).toBe('confirmed_success');
    expect(coordinator.getState().classDetail?.ownBooking?.state).toBe('confirmed');
    expect(onBalanceInvalidated).toHaveBeenCalledTimes(1);
  });

  it('reconciles with authoritative GET on 401 SessionExpiredRetryRequiredError without auto POST replay', async () => {
    mockGateway.getClassDetail
      .mockResolvedValueOnce(sampleClassDetail)
      .mockResolvedValueOnce({
        ...sampleClassDetail,
        ownBooking: {
          bookingId: 'booking-recovered',
          state: 'pending',
          expiresAt: '2026-10-30T10:15:00.000Z',
        },
      });

    mockGateway.bookClass.mockRejectedValueOnce(
      new SessionExpiredRetryRequiredError('Session expired during booking command'),
    );

    const onSessionRefresh = jest.fn().mockResolvedValue(undefined);
    const coordinator = new ClassDetailCoordinator({
      gateway: mockGateway,
      accountId: 'account-1',
      classId: 'class-1',
      onSessionRefresh,
    });

    await coordinator.loadDetail();
    await coordinator.bookClass();

    expect(onSessionRefresh).toHaveBeenCalledTimes(1);
    // Verified that detail was reread to see if booking actually went through
    expect(mockGateway.getClassDetail).toHaveBeenCalledTimes(2);
    // Booking was found in reread: reconciled to ready with booking!
    expect(coordinator.getState().classDetail?.ownBooking?.bookingId).toBe('booking-recovered');
    expect(coordinator.getState().phase).toBe('ready');
  });

  it('reconciles network uncertain error and offers retry with same key if booking absent', async () => {
    mockGateway.getClassDetail
      .mockResolvedValueOnce(sampleClassDetail)
      .mockResolvedValueOnce(sampleClassDetail); // Still null ownBooking

    mockGateway.bookClass.mockRejectedValueOnce(new GatewayHttpError(0, 'Network timeout'));

    const coordinator = new ClassDetailCoordinator({
      gateway: mockGateway,
      accountId: 'account-1',
      classId: 'class-1',
    });

    await coordinator.loadDetail();
    await coordinator.bookClass();

    expect(coordinator.getState().phase).toBe('error');
    expect(coordinator.getState().canRetryWithSameKey).toBe(true);
  });

  it('discards older deferred wallet balance response after dispose and new generation', async () => {
    let resolveSlowBalance!: (val: { availableCredits: number }) => void;
    const slowBalancePromise = new Promise<{ availableCredits: number }>((res) => {
      resolveSlowBalance = res;
    });

    const fetchWalletBalance = jest.fn().mockImplementation(() => slowBalancePromise);

    const coordinator = new ClassDetailCoordinator({
      gateway: mockGateway,
      accountId: 'account-1',
      classId: 'class-1',
      fetchWalletBalance,
    });

    // 1. Start first loadDetail which awaits slow wallet balance
    const firstLoad = coordinator.loadDetail();
    await Promise.resolve();
    expect(fetchWalletBalance).toHaveBeenCalledTimes(1);

    // 2. Component unmounts or screen blurs: dispose is called
    coordinator.dispose();

    // 3. New mount / screen focus starts fresh loadDetail with fast balance
    fetchWalletBalance.mockResolvedValueOnce({ availableCredits: 200 });
    const secondLoad = coordinator.loadDetail();
    await secondLoad;

    expect(coordinator.getState().userBalanceCredits).toBe(200);

    // 4. Stale slow balance from first load finally resolves with old value 50
    resolveSlowBalance({ availableCredits: 50 });
    await firstLoad;

    // Must still be 200, NOT overwritten by 50
    expect(coordinator.getState().userBalanceCredits).toBe(200);
  });

  it('ignores loadDetail during in-flight write and preserves busy state until action finishes and reconciles', async () => {
    let resolveBooking!: (val: BookClassResponse) => void;
    const slowBookingPromise = new Promise<BookClassResponse>((res) => {
      resolveBooking = res;
    });
    mockGateway.bookClass.mockReturnValueOnce(slowBookingPromise);

    const coordinator = new ClassDetailCoordinator({
      gateway: mockGateway,
      accountId: 'account-1',
      classId: 'class-1',
    });

    await coordinator.loadDetail();
    expect(coordinator.getState().phase).toBe('ready');

    // Start booking write
    const bookingPromise = coordinator.bookClass();
    expect(coordinator.isBusy()).toBe(true);
    expect(coordinator.getState().phase).toBe('submitting_booking');

    // Focus or timer triggers loadDetail while write is in flight
    const interruptedLoad = coordinator.loadDetail();
    await interruptedLoad;

    // Phase must NOT have changed to 'loading'! isBusy remains true!
    expect(coordinator.getState().phase).toBe('submitting_booking');
    expect(coordinator.isBusy()).toBe(true);

    // Resolve booking and allow reconcile
    mockGateway.getClassDetail.mockResolvedValueOnce({
      ...sampleClassDetail,
      ownBooking: samplePendingBooking,
    });
    resolveBooking({ booking: samplePendingBooking, created: true });
    await bookingPromise;

    expect(coordinator.isBusy()).toBe(false);
    expect(coordinator.getState().phase).toBe('ready');
    expect(coordinator.getState().classDetail?.ownBooking?.bookingId).toBe('booking-1');
  });

  it('does not get stuck busy when GET detail fails after successful bookClass, preserving idempotency key and entering retryable error state', async () => {
    mockGateway.bookClass.mockResolvedValueOnce({
      booking: samplePendingBooking,
      created: true,
    });
    // Subsequent getClassDetail in reconcileDetailAfterAction throws network error
    mockGateway.getClassDetail
      .mockResolvedValueOnce(sampleClassDetail) // Initial load
      .mockRejectedValueOnce(new GatewayHttpError(0, 'Network disconnected after book'));

    const coordinator = new ClassDetailCoordinator({
      gateway: mockGateway,
      accountId: 'account-1',
      classId: 'class-1',
    });

    await coordinator.loadDetail();
    const originalKey = coordinator.getStableIdempotencyKey();

    // Book succeeds on server, but reconcile GET fails
    await coordinator.bookClass();

    // Invariants:
    // 1. NOT stuck busy!
    expect(coordinator.isBusy()).toBe(false);
    expect(coordinator.getState().isBusy).toBe(false);
    // 2. Explicit non-stuck error state (NOT submitting_booking!)
    expect(coordinator.getState().phase).toBe('error');
    expect(coordinator.getState().errorReason).toBe('read_reconcile_failed');
    // 3. canRetryWithSameKey is true
    expect(coordinator.getState().canRetryWithSameKey).toBe(true);
    // 4. Stable idempotency key is preserved
    expect(coordinator.getStableIdempotencyKey()).toBe(originalKey);

    // 5. Subsequent manual reconciliation / reload succeeds and recovers state
    mockGateway.getClassDetail.mockResolvedValueOnce({
      ...sampleClassDetail,
      ownBooking: samplePendingBooking,
    });
    await coordinator.loadDetail();
    expect(coordinator.getState().phase).toBe('ready');
    expect(coordinator.getState().classDetail?.ownBooking?.bookingId).toBe('booking-1');
  });

  it('rejects confirmation for an expired pending hold without sending request to gateway', async () => {
    const expiredPendingBooking = {
      bookingId: 'booking-expired',
      classId: 'class-1',
      learnerId: 'account-1',
      state: 'pending' as const,
      priceCredits: 50,
      createdAt: '2026-10-01T08:00:00.000Z',
      expiresAt: '2026-10-01T08:15:00.000Z', // In the past
    };

    mockGateway.getClassDetail.mockResolvedValueOnce({
      ...sampleClassDetail,
      ownBooking: expiredPendingBooking,
    });

    const coordinator = new ClassDetailCoordinator({
      gateway: mockGateway,
      accountId: 'account-1',
      classId: 'class-1',
    });

    await coordinator.loadDetail();
    await coordinator.confirmBooking();

    // Gateway confirm was NOT called
    expect(mockGateway.confirmBooking).not.toHaveBeenCalled();
    expect(coordinator.getState().errorReason).toBe('hold_expired');
  });
  it('does not let an obsolete write clear a newer write busy guard after refocus', async () => {
    let releaseOld!: (value: BookClassResponse) => void;
    let releaseNew!: (value: BookClassResponse) => void;
    const oldResponse = new Promise<BookClassResponse>((resolve) => { releaseOld = resolve; });
    const newResponse = new Promise<BookClassResponse>((resolve) => { releaseNew = resolve; });
    mockGateway.bookClass.mockReturnValueOnce(oldResponse).mockReturnValueOnce(newResponse);
    const coordinator = new ClassDetailCoordinator({ gateway: mockGateway, accountId: 'account-1', classId: 'class-1' });
    await coordinator.loadDetail();
    const oldWrite = coordinator.bookClass();
    coordinator.dispose();
    await coordinator.loadDetail();
    const newWrite = coordinator.bookClass();
    releaseOld({ booking: samplePendingBooking, created: true });
    await oldWrite;
    expect(coordinator.isBusy()).toBe(true);
    await coordinator.bookClass();
    expect(mockGateway.bookClass).toHaveBeenCalledTimes(2);
    releaseNew({ booking: samplePendingBooking, created: false });
    await newWrite;
    expect(coordinator.isBusy()).toBe(false);
  });

});
