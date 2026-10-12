import type {
  LearnerBookingItemView,
  MyBookingsPageView,
} from '@skillswap/contracts';
import {
  MyBookingsCoordinator,
  type MyBookingsGatewayPort,
} from './my-bookings-coordinator';

describe('MyBookingsCoordinator', () => {
  const createMockBooking = (
    bookingId: string,
    overrides?: Partial<LearnerBookingItemView>,
  ): LearnerBookingItemView => ({
    bookingId,
    classId: `class-${bookingId}`,
    state: 'confirmed',
    priceCredits: 50,
    createdAt: '2026-10-12T00:00:00.000Z',
    expiresAt: null,
    classSummary: {
      description: `Class for ${bookingId}`,
      skillIds: ['skill-1'],
      startsAt: '2026-10-20T10:00:00.000Z',
      durationMinutes: 60,
      teacherId: 'teacher-1',
      teacherDisplayName: 'Prof. Smith',
      classState: 'published',
    },
    roomAccessEligible: false,
    ratingEligible: false,
    hasRated: false,
    ...overrides,
  });

  let mockGateway: jest.Mocked<MyBookingsGatewayPort>;

  beforeEach(() => {
    mockGateway = {
      getMyBookingsPage: jest.fn(),
    };
  });

  it('preserves exact server totalUpcomingCount when larger than page size', async () => {
    const pageData: MyBookingsPageView = {
      items: [createMockBooking('b1'), createMockBooking('b2')],
      nextCursor: 'cursor-1',
      totalUpcomingCount: 42,
    };
    mockGateway.getMyBookingsPage.mockResolvedValueOnce(pageData);

    const coordinator = new MyBookingsCoordinator({
      gateway: mockGateway,
      accountId: 'acc-1',
    });

    await coordinator.loadInitial();

    const state = coordinator.getState();
    expect(state.status).toBe('ready');
    expect(state.items).toHaveLength(2);
    expect(state.totalUpcomingCount).toBe(42);
    expect(state.nextCursor).toBe('cursor-1');
  });

  it('sends upcoming explicitly as false for history and undefined for all', async () => {
    const defaultPage: MyBookingsPageView = {
      items: [],
      nextCursor: null,
      totalUpcomingCount: 0,
    };
    mockGateway.getMyBookingsPage.mockResolvedValue(defaultPage);

    const coordinator = new MyBookingsCoordinator({
      gateway: mockGateway,
      accountId: 'acc-1',
      pageSize: 20,
    });

    // 1. Initial load defaults to upcoming: true
    await coordinator.loadInitial();
    expect(mockGateway.getMyBookingsPage).toHaveBeenLastCalledWith({
      upcoming: true,
      limit: 20,
    });

    // 2. Switching to history passes upcoming: false explicitly
    await coordinator.setFilter('history');
    expect(mockGateway.getMyBookingsPage).toHaveBeenLastCalledWith({
      upcoming: false,
      limit: 20,
    });

    // 3. Switching to all passes upcoming: undefined
    await coordinator.setFilter('all');
    expect(mockGateway.getMyBookingsPage).toHaveBeenLastCalledWith({
      upcoming: undefined,
      limit: 20,
    });
  });

  it('ignores stale responses after filter change and drops updates when unmounted', async () => {
    let resolveFirst!: (value: MyBookingsPageView) => void;
    const slowFirstPromise = new Promise<MyBookingsPageView>((res) => {
      resolveFirst = res;
    });

    const secondPage: MyBookingsPageView = {
      items: [createMockBooking('history-1')],
      nextCursor: null,
      totalUpcomingCount: 1,
    };

    mockGateway.getMyBookingsPage
      .mockReturnValueOnce(slowFirstPromise)
      .mockResolvedValueOnce(secondPage);

    const onStateChange = jest.fn();
    const coordinator = new MyBookingsCoordinator({
      gateway: mockGateway,
      accountId: 'acc-1',
      onStateChange,
    });

    // Start initial request (slow)
    const initialPromise = coordinator.loadInitial();

    // Immediately switch filter to history
    await coordinator.setFilter('history');

    // Late resolve of the initial upcoming request
    resolveFirst({
      items: [createMockBooking('stale-upcoming-1')],
      nextCursor: null,
      totalUpcomingCount: 99,
    });
    await initialPromise;

    // Verify state belongs to history, stale upcoming response was completely discarded
    const state = coordinator.getState();
    expect(state.filter).toBe('history');
    expect(state.items).toHaveLength(1);
    expect(state.items[0]?.bookingId).toBe('history-1');
    expect(state.totalUpcomingCount).toBe(1);

    // Verify unmount drops updates
    let isMounted = true;
    const unmountedCoordinator = new MyBookingsCoordinator({
      gateway: mockGateway,
      accountId: 'acc-1',
      isMounted: () => isMounted,
      onStateChange: jest.fn(),
    });
    isMounted = false;
    unmountedCoordinator.dispose();
    await unmountedCoordinator.reload();
    expect(unmountedCoordinator.getState().status).toBe('loading');
  });

  it('ensures deferred old request cannot clear newer spinner during rapid filter switches', async () => {
    let resolveFirst!: (value: MyBookingsPageView) => void;
    const firstPromise = new Promise<MyBookingsPageView>((res) => {
      resolveFirst = res;
    });

    let resolveSecond!: (value: MyBookingsPageView) => void;
    const secondPromise = new Promise<MyBookingsPageView>((res) => {
      resolveSecond = res;
    });

    mockGateway.getMyBookingsPage
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise);

    const coordinator = new MyBookingsCoordinator({
      gateway: mockGateway,
      accountId: 'acc-1',
    });

    // Trigger request 1
    const p1 = coordinator.loadInitial();
    expect(coordinator.getState().status).toBe('loading');

    // Rapidly switch to history (trigger request 2)
    const p2 = coordinator.setFilter('history');
    expect(coordinator.getState().status).toBe('loading');

    // Resolve old request 1
    resolveFirst({
      items: [createMockBooking('b1')],
      nextCursor: null,
      totalUpcomingCount: 1,
    });
    await p1;

    // State MUST STILL BE loading; old request must NOT clear newer spinner to 'ready'
    expect(coordinator.getState().status).toBe('loading');
    expect(coordinator.getState().isBusy).toBe(true);

    // Now resolve request 2
    resolveSecond({
      items: [createMockBooking('b2')],
      nextCursor: null,
      totalUpcomingCount: 5,
    });
    await p2;

    expect(coordinator.getState().status).toBe('ready');
    expect(coordinator.getState().isBusy).toBe(false);
    expect(coordinator.getState().items[0]?.bookingId).toBe('b2');
  });

  it('merges subsequent page items deduplicating by bookingId', async () => {
    const page1: MyBookingsPageView = {
      items: [createMockBooking('b1'), createMockBooking('b2')],
      nextCursor: 'cursor-2',
      totalUpcomingCount: 3,
    };
    const page2: MyBookingsPageView = {
      items: [createMockBooking('b2'), createMockBooking('b3')], // b2 is duplicated
      nextCursor: null,
      totalUpcomingCount: 3,
    };

    mockGateway.getMyBookingsPage
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    const coordinator = new MyBookingsCoordinator({
      gateway: mockGateway,
      accountId: 'acc-1',
    });

    await coordinator.loadInitial();
    expect(coordinator.getState().items).toHaveLength(2);

    await coordinator.loadMore();
    const state = coordinator.getState();
    expect(state.items).toHaveLength(3);
    expect(state.items.map((i) => i.bookingId)).toEqual(['b1', 'b2', 'b3']);
    expect(state.nextCursor).toBeNull();
  });

  it('retains cursor and items on page failure and allows retrying loadMore', async () => {
    const page1: MyBookingsPageView = {
      items: [createMockBooking('b1'), createMockBooking('b2')],
      nextCursor: 'cursor-retry',
      totalUpcomingCount: 4,
    };

    mockGateway.getMyBookingsPage
      .mockResolvedValueOnce(page1)
      .mockRejectedValueOnce(new Error('Network disconnected'))
      .mockResolvedValueOnce({
        items: [createMockBooking('b3')],
        nextCursor: null,
        totalUpcomingCount: 4,
      });

    const coordinator = new MyBookingsCoordinator({
      gateway: mockGateway,
      accountId: 'acc-1',
    });

    await coordinator.loadInitial();
    expect(coordinator.getState().nextCursor).toBe('cursor-retry');

    // Attempt loadMore which fails
    await coordinator.loadMore();

    const failedState = coordinator.getState();
    expect(failedState.items).toHaveLength(2);
    expect(failedState.nextCursor).toBe('cursor-retry'); // Cursor retained!
    expect(failedState.errorMessage).toBe('Network disconnected');
    expect(failedState.isLoadingMore).toBe(false);

    // Retry loadMore succeeds using retained cursor
    await coordinator.retry();

    const recoveredState = coordinator.getState();
    expect(recoveredState.items).toHaveLength(3);
    expect(recoveredState.nextCursor).toBeNull();
    expect(recoveredState.errorMessage).toBeNull();
  });

  it('detects nextCursor cycle and terminates pagination safely', async () => {
    const page1: MyBookingsPageView = {
      items: [createMockBooking('b1')],
      nextCursor: 'loop-cursor',
      totalUpcomingCount: 2,
    };
    const page2: MyBookingsPageView = {
      items: [createMockBooking('b2')],
      nextCursor: 'loop-cursor', // Repeated cursor!
      totalUpcomingCount: 2,
    };

    mockGateway.getMyBookingsPage
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    const coordinator = new MyBookingsCoordinator({
      gateway: mockGateway,
      accountId: 'acc-1',
    });

    await coordinator.loadInitial();
    expect(coordinator.getState().nextCursor).toBe('loop-cursor');

    await coordinator.loadMore();
    // Cycle detected: nextCursor terminated to null
    expect(coordinator.getState().nextCursor).toBeNull();
    expect(coordinator.getState().items).toHaveLength(2);
  });

  it('reloads authoritative server status and count when refreshed', async () => {
    const initialPage: MyBookingsPageView = {
      items: [createMockBooking('b1', { state: 'pending' })],
      nextCursor: null,
      totalUpcomingCount: 1,
    };
    const updatedPage: MyBookingsPageView = {
      items: [
        createMockBooking('b1', { state: 'confirmed' }),
        createMockBooking('b2', { state: 'confirmed' }),
      ],
      nextCursor: null,
      totalUpcomingCount: 2,
    };

    mockGateway.getMyBookingsPage
      .mockResolvedValueOnce(initialPage)
      .mockResolvedValueOnce(updatedPage);

    const coordinator = new MyBookingsCoordinator({
      gateway: mockGateway,
      accountId: 'acc-1',
    });

    await coordinator.loadInitial();
    expect(coordinator.getState().items[0]?.state).toBe('pending');
    expect(coordinator.getState().totalUpcomingCount).toBe(1);

    // Refresh after confirmation
    await coordinator.refresh();

    const refreshedState = coordinator.getState();
    expect(refreshedState.items).toHaveLength(2);
    expect(refreshedState.items[0]?.state).toBe('confirmed');
    expect(refreshedState.totalUpcomingCount).toBe(2);
  });
  it('shows a recoverable error instead of old-filter items after filter load fails', async () => {
    mockGateway.getMyBookingsPage.mockResolvedValueOnce({
      items: [createMockBooking('old-upcoming')], nextCursor: 'old-cursor', totalUpcomingCount: 7,
    }).mockRejectedValueOnce(new Error('offline'));
    const coordinator = new MyBookingsCoordinator({ gateway: mockGateway, accountId: 'acc-1' });
    await coordinator.loadInitial();
    await coordinator.setFilter('history');
    expect(coordinator.getState()).toMatchObject({
      filter: 'history', status: 'error', items: [], nextCursor: null, isBusy: false,
    });
  });

  it('retries a failed refresh from the first page even when a next cursor exists', async () => {
    mockGateway.getMyBookingsPage.mockResolvedValueOnce({
      items: [createMockBooking('old')], nextCursor: 'page-two', totalUpcomingCount: 7,
    }).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({
      items: [createMockBooking('fresh')], nextCursor: null, totalUpcomingCount: 1,
    });
    const coordinator = new MyBookingsCoordinator({ gateway: mockGateway, accountId: 'acc-1' });
    await coordinator.loadInitial();
    await coordinator.refresh();
    expect(coordinator.getState().status).toBe('ready');
    await coordinator.retry();
    expect(mockGateway.getMyBookingsPage).toHaveBeenLastCalledWith({ upcoming: true, limit: 20 });
    expect(coordinator.getState().items.map(item => item.bookingId)).toEqual(['fresh']);
  });

  it('keeps previously loaded items visible after a failed focus reload', async () => {
    mockGateway.getMyBookingsPage.mockResolvedValueOnce({
      items: [createMockBooking('existing')], nextCursor: null, totalUpcomingCount: 1,
    }).mockRejectedValueOnce(new Error('offline'));
    const coordinator = new MyBookingsCoordinator({ gateway: mockGateway, accountId: 'acc-1' });
    await coordinator.loadInitial();
    await coordinator.reload();
    expect(coordinator.getState()).toMatchObject({ status: 'ready', isBusy: false });
    expect(coordinator.getState().items[0]?.bookingId).toBe('existing');
    expect(coordinator.getState().errorMessage).toBeTruthy();
  });

});
