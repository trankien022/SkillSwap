import { newIdempotencyKey } from '@/application/idempotency';
import { SessionExpiredRetryRequiredError } from '@/application/port/session-types';
import type { BookingHttpGateway } from '@/infrastructure/http/booking-http-gateway';
import { GatewayHttpError } from '@/infrastructure/http/gateway-client';
import type { ClassDetailView } from '@skillswap/contracts';

export type CoordinatorPhase =
  | 'idle'
  | 'loading'
  | 'not_found'
  | 'ready'
  | 'submitting_booking'
  | 'submitting_confirm'
  | 'reconciling_session'
  | 'reconciling_network'
  | 'confirmed_success'
  | 'error';

export interface CoordinatorState {
  readonly phase: CoordinatorPhase;
  readonly classDetail: ClassDetailView | null;
  readonly isBusy: boolean;
  readonly errorMessage: string | null;
  readonly errorReason: string | null;
  readonly isInsufficientBalance: boolean;
  readonly canRetryWithSameKey: boolean;
  readonly userBalanceCredits: number | null;
}

export interface CoordinatorOptions {
  readonly gateway: BookingHttpGateway;
  readonly accountId: string;
  readonly classId: string;
  readonly onSessionRefresh?: () => Promise<void>;
  readonly fetchWalletBalance?: () => Promise<{ availableCredits: number }>;
  readonly onBalanceInvalidated?: () => void;
  readonly onStateChange?: (state: CoordinatorState) => void;
  readonly isMounted?: () => boolean;
}

/**
 * Pure state and concurrency coordinator for Class Detail and Booking flow (FR-007, FR-009).
 *
 * Invariants enforced:
 * - Synchronous busy guard: duplicate clicks rejected synchronously without racing.
 * - Generation fencing: responses after classId or accountId switches are discarded.
 * - Idempotency key stability: preserved per (accountId, classId) across retries & network errors.
 * - No auto-confirm after create; explicit confirm required.
 * - Confirmed success requires response booking.state === 'confirmed' or reread confirmation;
 *   confirm false + null booking never fabricates success and reconciles authoritative GET.
 * - POST 401 SessionExpiredRetryRequiredError suppresses replay; reconciles detail before manual retry.
 * - Network failures reconcile detail before offering manual retry with the same key.
 */
export class ClassDetailCoordinator {
  private state: CoordinatorState = {
    phase: 'idle',
    classDetail: null,
    isBusy: false,
    errorMessage: null,
    errorReason: null,
    isInsufficientBalance: false,
    canRetryWithSameKey: false,
    userBalanceCredits: null,
  };

  private generation = 0;
  private isBusyFlag = false;
  private idempotencyKeyMap = new Map<string, string>();

  constructor(private readonly options: CoordinatorOptions) {}

  getState(): CoordinatorState {
    return this.state;
  }

  isBusy(): boolean {
    return this.isBusyFlag;
  }

  dispose(): void {
    this.generation++;
    this.isBusyFlag = false;
    this.state = { ...this.state, isBusy: false };
  }

  invalidate(): void {
    this.dispose();
  }

  private setState(partial: Partial<CoordinatorState>): void {
    this.state = { ...this.state, ...partial };
    this.options.onStateChange?.(this.state);
  }

  private isStale(gen: number): boolean {
    if (this.options.isMounted && !this.options.isMounted()) {
      return true;
    }
    return gen !== this.generation;
  }

  getStableIdempotencyKey(): string {
    const compoundKey = `${this.options.accountId}:${this.options.classId}`;
    let existing = this.idempotencyKeyMap.get(compoundKey);
    if (!existing) {
      existing = newIdempotencyKey();
      this.idempotencyKeyMap.set(compoundKey, existing);
    }
    return existing;
  }

  async loadDetail(): Promise<void> {
    if (this.isBusyFlag) {
      return;
    }

    const gen = ++this.generation;
    this.setState({ phase: 'loading', isBusy: false, errorMessage: null, errorReason: null });

    try {
      const detail = await this.options.gateway.getClassDetail(this.options.classId);
      if (this.isStale(gen)) return;

      let insufficient = false;
      let balanceCredits = this.state.userBalanceCredits;

      if (this.options.fetchWalletBalance) {
        try {
          const bal = await this.options.fetchWalletBalance();
          if (this.isStale(gen)) return;
          balanceCredits = bal.availableCredits;
          if (detail.ownBooking?.state === 'pending') {
            insufficient = balanceCredits < detail.priceCredits;
          }
        } catch {
          if (this.isStale(gen)) return;
          // Non-critical balance fetch failure
        }
      }

      if (this.isStale(gen)) return;

      this.setState({
        phase: 'ready',
        classDetail: detail,
        isInsufficientBalance: insufficient,
        userBalanceCredits: balanceCredits,
        errorMessage: null,
        errorReason: null,
      });
    } catch (error) {
      if (this.isStale(gen)) return;

      if (error instanceof GatewayHttpError && error.statusCode === 404) {
        this.setState({ phase: 'not_found', errorMessage: error.message, errorReason: 'not_found' });
      } else {
        this.setState({
          phase: 'error',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorReason: 'load_detail_failed',
        });
      }
    }
  }

  async bookClass(): Promise<void> {
    // 1. Synchronous busy guard: prevents duplicate/concurrent clicks
    if (this.isBusyFlag) {
      return;
    }

    if (!this.state.classDetail?.canBook) {
      return;
    }

    this.isBusyFlag = true;
    const gen = ++this.generation;
    this.setState({
      isBusy: true,
      phase: 'submitting_booking',
      errorMessage: null,
      errorReason: null,
    });
    const key = this.getStableIdempotencyKey();

    try {
      await this.options.gateway.bookClass(this.options.classId, key);
      if (this.isStale(gen)) return;

      // Authoritative reread to populate full ownBooking view
      await this.reconcileDetailAfterAction(gen);
    } catch (error) {
      if (this.isStale(gen)) return;

      if (error instanceof SessionExpiredRetryRequiredError) {
        // 401: Suppress replay; refresh session then reconcile authoritative detail
        this.setState({ phase: 'reconciling_session' });
        try {
          if (this.options.onSessionRefresh) {
            await this.options.onSessionRefresh();
          }
        } catch {
          // Refresh failed
        }
        if (this.isStale(gen)) return;
        await this.reconcileAfterUncertainOutcome(gen, 'session_expired');
      } else if (
        error instanceof GatewayHttpError &&
        (error.statusCode === 0 || error.statusCode >= 500)
      ) {
        // Network / transport uncertain outcome
        this.setState({ phase: 'reconciling_network' });
        await this.reconcileAfterUncertainOutcome(gen, 'network_uncertain');
      } else {
        // Domain rejection (e.g. 409 BookingNotAllowedError)
        let reason = 'unknown';
        if (error instanceof GatewayHttpError && typeof error.errorDetails === 'string') {
          reason = error.errorDetails;
        }
        try {
          const detail = await this.options.gateway.getClassDetail(this.options.classId);
          if (this.isStale(gen)) return;
          this.setState({
            phase: 'error',
            classDetail: detail,
            errorMessage: error instanceof Error ? error.message : 'Booking failed',
            errorReason: reason,
            canRetryWithSameKey: false,
          });
        } catch {
          if (this.isStale(gen)) return;
          this.setState({
            phase: 'error',
            errorMessage: error instanceof Error ? error.message : 'Booking failed',
            errorReason: reason,
            canRetryWithSameKey: false,
          });
        }
      }
    } finally {
      if (!this.isStale(gen)) {
        this.isBusyFlag = false;
        this.setState({ isBusy: false });
      }
    }
  }

  async confirmBooking(): Promise<void> {
    if (this.isBusyFlag) {
      return;
    }

    const ownBooking = this.state.classDetail?.ownBooking;
    if (!ownBooking || ownBooking.state !== 'pending') {
      return;
    }

    // Expired pending hold check: cannot confirm expired hold
    if (ownBooking.expiresAt && new Date(ownBooking.expiresAt).getTime() <= Date.now()) {
      this.setState({
        errorReason: 'hold_expired',
        errorMessage: 'Seat reservation hold has expired.',
      });
      return;
    }

    // Pre-check balance before confirm if known (UX check only, never financial authority)
    if (
      this.state.userBalanceCredits !== null &&
      this.state.classDetail &&
      this.state.userBalanceCredits < this.state.classDetail.priceCredits
    ) {
      this.setState({ isInsufficientBalance: true, errorReason: 'insufficient_balance' });
      return;
    }

    this.isBusyFlag = true;
    const gen = ++this.generation;
    this.setState({
      isBusy: true,
      phase: 'submitting_confirm',
      errorMessage: null,
      errorReason: null,
    });
    const bookingId = ownBooking.bookingId;

    try {
      const response = await this.options.gateway.confirmBooking(bookingId);
      if (this.isStale(gen)) return;

      // Verification rule: only success when reread confirms ownBooking.state === 'confirmed'
      // or response.booking.state === 'confirmed'
      if (response.confirmed && response.booking?.state === 'confirmed') {
        const detail = await this.options.gateway.getClassDetail(this.options.classId);
        if (this.isStale(gen)) return;

        if (detail.ownBooking?.state === 'confirmed') {
          this.options.onBalanceInvalidated?.();
          this.setState({
            phase: 'confirmed_success',
            classDetail: detail,
            errorMessage: null,
            errorReason: null,
          });
          return;
        }
      }

      // If response.confirmed is false or null booking: reconcile GET, no fake success!
      await this.reconcileConfirmOutcome(gen);
    } catch (error) {
      if (this.isStale(gen)) return;

      if (error instanceof SessionExpiredRetryRequiredError) {
        this.setState({ phase: 'reconciling_session' });
        try {
          if (this.options.onSessionRefresh) {
            await this.options.onSessionRefresh();
          }
        } catch {
          // Refresh failed
        }
        if (this.isStale(gen)) return;
        await this.reconcileConfirmOutcome(gen);
      } else if (
        error instanceof GatewayHttpError &&
        (error.statusCode === 0 || error.statusCode >= 500)
      ) {
        this.setState({ phase: 'reconciling_network' });
        await this.reconcileConfirmOutcome(gen);
      } else {
        this.setState({
          phase: 'error',
          errorMessage: error instanceof Error ? error.message : 'Confirmation failed',
          errorReason: 'confirm_failed',
        });
        try {
          const detail = await this.options.gateway.getClassDetail(this.options.classId);
          if (this.isStale(gen)) return;
          this.setState({ classDetail: detail });
        } catch {
          // Detail fetch failed
        }
      }
    } finally {
      if (!this.isStale(gen)) {
        this.isBusyFlag = false;
        this.setState({ isBusy: false });
      }
    }
  }

  private async reconcileDetailAfterAction(gen: number): Promise<void> {
    try {
      const detail = await this.options.gateway.getClassDetail(this.options.classId);
      if (this.isStale(gen)) return;

      let insufficient = false;
      if (
        detail.ownBooking?.state === 'pending' &&
        this.state.userBalanceCredits !== null &&
        this.state.userBalanceCredits < detail.priceCredits
      ) {
        insufficient = true;
      }

      this.setState({
        phase: 'ready',
        classDetail: detail,
        isInsufficientBalance: insufficient,
        errorMessage: null,
        errorReason: null,
      });
    } catch {
      if (this.isStale(gen)) return;
      this.setState({
        phase: 'error',
        errorReason: 'read_reconcile_failed',
        errorMessage: 'Unable to refresh class status. Please check your booking.',
        canRetryWithSameKey: true,
      });
    }
  }

  private async reconcileAfterUncertainOutcome(
    gen: number,
    cause: 'session_expired' | 'network_uncertain',
  ): Promise<void> {
    try {
      const detail = await this.options.gateway.getClassDetail(this.options.classId);
      if (this.isStale(gen)) return;

      if (detail.ownBooking) {
        // Seat was successfully booked despite transient error
        this.setState({
          phase: 'ready',
          classDetail: detail,
          canRetryWithSameKey: false,
          errorMessage: null,
          errorReason: null,
        });
        return;
      }

      // Seat was not booked; offer manual retry with same idempotency key
      this.setState({
        phase: 'error',
        classDetail: detail,
        errorMessage:
          cause === 'session_expired'
            ? 'Session expired during booking. Please retry.'
            : 'Network connection was interrupted. Please retry.',
        errorReason: cause,
        canRetryWithSameKey: true,
      });
    } catch {
      if (this.isStale(gen)) return;
      this.setState({
        phase: 'error',
        errorReason: 'read_reconcile_failed',
        errorMessage: 'Unable to verify booking status. Please retry.',
        canRetryWithSameKey: true,
      });
    }
  }

  private async reconcileConfirmOutcome(gen: number): Promise<void> {
    try {
      const detail = await this.options.gateway.getClassDetail(this.options.classId);
      if (this.isStale(gen)) return;

      if (detail.ownBooking?.state === 'confirmed') {
        this.options.onBalanceInvalidated?.();
        this.setState({
          phase: 'confirmed_success',
          classDetail: detail,
          errorMessage: null,
          errorReason: null,
        });
        return;
      }

      // Reconciled but not confirmed
      this.setState({
        phase: 'ready',
        classDetail: detail,
        errorMessage: 'Booking confirmation could not be completed.',
        errorReason: 'confirm_unconfirmed',
      });
    } catch {
      if (this.isStale(gen)) return;
      this.setState({
        phase: 'error',
        errorReason: 'read_reconcile_failed',
        errorMessage: 'Unable to verify confirmation status.',
        canRetryWithSameKey: true,
      });
    }
  }
}
