import type {
  LearnerBookingItemView,
  MyBookingsPageView,
} from '@skillswap/contracts';
import type { MyBookingsQueryOptions } from '@/infrastructure/http/my-bookings-gateway';

export type BookingFilter = 'upcoming' | 'history' | 'all';
export type CoordinatorStatus = 'loading' | 'ready' | 'error';

export interface MyBookingsGatewayPort {
  getMyBookingsPage(options?: MyBookingsQueryOptions): Promise<MyBookingsPageView>;
}

export interface MyBookingsState {
  readonly status: CoordinatorStatus;
  readonly filter: BookingFilter;
  readonly items: readonly LearnerBookingItemView[];
  readonly nextCursor: string | null;
  readonly totalUpcomingCount: number;
  readonly isRefreshing: boolean;
  readonly isLoadingMore: boolean;
  readonly errorMessage: string | null;
  readonly isBusy: boolean;
}

export interface MyBookingsCoordinatorOptions {
  readonly gateway: MyBookingsGatewayPort;
  readonly accountId: string;
  readonly initialFilter?: BookingFilter;
  readonly pageSize?: number;
  readonly onStateChange?: (state: MyBookingsState) => void;
  readonly isMounted?: () => boolean;
}

/**
 * Pure state and concurrency coordinator for learner bookings (Route 22, FR-007, FR-009).
 *
 * Invariants enforced:
 * - Pure coordinator: dependency-injected gateway interface, no raw network dependencies.
 * - State lifecycle: loading / ready / error, with refreshing and loadingMore tracking.
 * - Filter fidelity: upcoming boolean true / false / undefined sent explicitly (never omitted for history).
 * - Exact count: keeps authoritative totalUpcomingCount from server response, never derived from page length.
 * - Concurrency & generation fences: stale requests discarded after all awaits; old requests cannot clear newer spinner.
 * - Deduplication: merges page items deduplicated by bookingId.
 * - Cycle protection: detects duplicate nextCursor cycles and halts pagination safely.
 * - Cursor stability: failures during loadMore retain existing items and nextCursor for retry.
 * - React lifecycle fencing: silent disposal without callbacks after unmount.
 * - Identity bound: bound to owner accountId, not raw auth tokens.
 */
export class MyBookingsCoordinator {
  private state: MyBookingsState;
  private generation = 0;
  private isBusyFlag = false;
  private seenCursors = new Set<string>();
  private failedOperation: 'first' | 'page' | null = null;
  private readonly pageSize: number;

  constructor(private readonly options: MyBookingsCoordinatorOptions) {
    this.pageSize = options.pageSize ?? 20;
    this.state = {
      status: 'loading',
      filter: options.initialFilter ?? 'upcoming',
      items: [],
      nextCursor: null,
      totalUpcomingCount: 0,
      isRefreshing: false,
      isLoadingMore: false,
      errorMessage: null,
      isBusy: false,
    };
  }

  getState(): MyBookingsState {
    return this.state;
  }

  isBusy(): boolean {
    return this.isBusyFlag;
  }

  getAccountId(): string {
    return this.options.accountId;
  }

  dispose(): void {
    this.generation++;
    this.isBusyFlag = false;
  }

  private isStale(gen: number): boolean {
    if (this.options.isMounted && !this.options.isMounted()) {
      return true;
    }
    return gen !== this.generation;
  }

  private setState(partial: Partial<MyBookingsState>): void {
    if (this.options.isMounted && !this.options.isMounted()) {
      return;
    }
    this.state = { ...this.state, ...partial };
    this.options.onStateChange?.(this.state);
  }

  async loadInitial(): Promise<void> {
    await this.fetchFirstPage(this.state.filter, false);
  }

  async reload(): Promise<void> {
    await this.fetchFirstPage(this.state.filter, false);
  }

  async refresh(): Promise<void> {
    if (this.state.isRefreshing) {
      return;
    }
    await this.fetchFirstPage(this.state.filter, true);
  }

  async setFilter(newFilter: BookingFilter): Promise<void> {
    if (newFilter === this.state.filter && this.state.status === 'ready') {
      return;
    }
    await this.fetchFirstPage(newFilter, false);
  }

  private async fetchFirstPage(filter: BookingFilter, isPullRefresh: boolean): Promise<void> {
    if (isPullRefresh && this.state.isRefreshing) {
      return;
    }

    this.isBusyFlag = true;
    const gen = ++this.generation;
    this.seenCursors.clear();
    this.failedOperation = null;
    const filterChanged = filter !== this.state.filter;

    if (isPullRefresh) {
      this.setState({
        isRefreshing: true,
        isBusy: true,
        errorMessage: null,
        ...(filterChanged ? { items: [], nextCursor: null } : {}),
      });
    } else {
      this.setState({
        status: 'loading',
        filter,
        ...(filterChanged ? { items: [], nextCursor: null } : {}),
        isBusy: true,
        isRefreshing: false,
        isLoadingMore: false,
        errorMessage: null,
      });
    }

    const upcomingParam =
      filter === 'upcoming'
        ? true
        : filter === 'history'
          ? false
          : undefined;

    try {
      const page = await this.options.gateway.getMyBookingsPage({
        upcoming: upcomingParam,
        limit: this.pageSize,
      });

      if (this.isStale(gen)) {
        return;
      }

      if (page.nextCursor) {
        this.seenCursors.add(page.nextCursor);
      }

      const seenIds = new Set<string>();
      const uniqueItems: LearnerBookingItemView[] = [];
      for (const item of page.items) {
        if (!seenIds.has(item.bookingId)) {
          seenIds.add(item.bookingId);
          uniqueItems.push(item);
        }
      }

      this.isBusyFlag = false;
      this.setState({
        status: 'ready',
        filter,
        items: uniqueItems,
        nextCursor: page.nextCursor,
        totalUpcomingCount: page.totalUpcomingCount,
        isRefreshing: false,
        isLoadingMore: false,
        isBusy: false,
        errorMessage: null,
      });
    } catch (err) {
      if (this.isStale(gen)) {
        return;
      }

      this.isBusyFlag = false;
      this.failedOperation = 'first';
      this.setState({
        status: this.state.items.length > 0 ? 'ready' : 'error',
        isRefreshing: false,
        isLoadingMore: false,
        isBusy: false,
        errorMessage: err instanceof Error ? err.message : 'Failed to load bookings',
      });
    }
  }

  async loadMore(): Promise<void> {
    if (
      !this.state.nextCursor ||
      this.state.isLoadingMore ||
      this.state.isRefreshing ||
      this.isBusyFlag ||
      this.state.status !== 'ready'
    ) {
      return;
    }

    const currentCursor = this.state.nextCursor;
    this.failedOperation = null;
    this.isBusyFlag = true;
    const gen = ++this.generation;

    this.setState({
      isLoadingMore: true,
      isBusy: true,
      errorMessage: null,
    });

    const upcomingParam =
      this.state.filter === 'upcoming'
        ? true
        : this.state.filter === 'history'
          ? false
          : undefined;

    try {
      const page = await this.options.gateway.getMyBookingsPage({
        upcoming: upcomingParam,
        limit: this.pageSize,
        cursor: currentCursor,
      });

      if (this.isStale(gen)) {
        return;
      }

      let nextCursor: string | null = null;
      if (page.nextCursor) {
        if (this.seenCursors.has(page.nextCursor) || page.nextCursor === currentCursor) {
          nextCursor = null;
        } else {
          this.seenCursors.add(page.nextCursor);
          nextCursor = page.nextCursor;
        }
      }

      const seenIds = new Set(this.state.items.map((i) => i.bookingId));
      const combinedItems = [...this.state.items];
      for (const item of page.items) {
        if (!seenIds.has(item.bookingId)) {
          seenIds.add(item.bookingId);
          combinedItems.push(item);
        }
      }

      this.isBusyFlag = false;
      this.setState({
        items: combinedItems,
        nextCursor,
        totalUpcomingCount: page.totalUpcomingCount,
        isLoadingMore: false,
        isBusy: false,
        errorMessage: null,
      });
    } catch (err) {
      if (this.isStale(gen)) {
        return;
      }

      this.isBusyFlag = false;
      this.failedOperation = 'page';
      this.setState({
        isLoadingMore: false,
        isBusy: false,
        errorMessage: err instanceof Error ? err.message : 'Failed to load more bookings',
      });
    }
  }

  async retry(): Promise<void> {
    if (this.isBusyFlag) return;
    if (this.failedOperation === 'page') {
      await this.loadMore();
    } else {
      await this.reload();
    }
  }
}
