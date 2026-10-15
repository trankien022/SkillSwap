'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { ClassDetailView } from '../../lib/marketplace/types';
import { BookClassService } from '../../lib/booking/service';
import { HttpBookingGateway } from '../../lib/booking/http-gateway';
import { checkBalanceGate, obtainHold } from '../../lib/booking/gate';
import { BookingError, type ConfirmBookingResponse } from '../../lib/booking/domain';
import {
  resolveSettlement,
  type SettlementReadback,
  type SettlementStatus,
} from '../../lib/booking/settlement';
import { BookButton } from './book-button';
import { StatusPill } from './status-pill';

/**
 * The class detail's single committing action: **book → gate → confirm**
 * (FR-007, D5).
 *
 * It exists because the page used to offer two independent buttons — a
 * "Đặt lớp" panel and a separate "review & lock" link — both driving the same
 * `POST /classes/:id/bookings`. The first click created the hold, so the second
 * hit the duplicate guard and the learner was told they were "already in the
 * class". There is now one button, and it runs the whole flow in order:
 *
 * 1. **Book** — reuses a live hold instead of creating a second one. A
 *    rejection (class full, window closed, …) shows the reason the server
 *    sent, never a redirect and never a success.
 * 2. **Gate** — a fresh `GET /wallet/balance` compared with this class's price.
 *    No credits, or no readable balance, sends the learner to checkout, where
 *    the hold's countdown and the top-up branch live; confirm is not attempted
 *    (§2.3: there is no synchronous server-side gate to call).
 * 3. **Confirm** — and settlement is shown only when the read-back earns it:
 *    `resolveSettlement` never turns `confirmed: false` into success.
 */
const service = new BookClassService(new HttpBookingGateway());

/** Why a class cannot be booked, when the server says it cannot. */
export type DisabledReasonKey = 'confirmed' | 'full' | 'notOpen' | 'tooSoon' | 'notBookable';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The learner's live hold on this class: a `pending` booking still inside its
 * window. Null when there is none — including an expired one, whose seat the
 * server no longer protects.
 *
 * This is checked *before* `canBook`, which is false precisely while a hold
 * exists: a learner holding a seat must not be told they cannot book.
 */
export function activeHoldBookingId(item: ClassDetailView): string | null {
  const hold = item.ownBooking;
  if (hold === null || hold.state !== 'pending') return null;
  if (hold.expiresAt !== null && Date.parse(hold.expiresAt) <= Date.now()) return null;
  return hold.bookingId;
}

/**
 * The reason the action is disabled, or null when it may be pressed.
 *
 * Every branch is a fact the client already has — the server's verdict, the
 * hold, the free-seat count, the published state, the start time. Nothing is
 * guessed, and when no visible fact explains the refusal the last branch says
 * so instead of inventing a cause.
 */
export function disabledReasonKey(item: ClassDetailView): DisabledReasonKey | null {
  if (activeHoldBookingId(item) !== null) return null;
  if (item.ownBooking?.state === 'confirmed') return 'confirmed';
  if (item.canBook) return null;
  if (item.availableSeats === 0) return 'full';
  if (item.state !== 'published') return 'notOpen';
  const lead = Date.parse(item.startsAt) - Date.now();
  if (Number.isFinite(lead) && lead < DAY_MS) return 'tooSoon';
  return 'notBookable';
}

type ActionState =
  | { phase: 'idle' }
  | { phase: 'busy' }
  | { phase: 'failed'; message: string }
  | { phase: 'settled' }
  | { phase: 'checking'; status: Exclude<SettlementStatus, 'settled'>; reading: boolean };

export function CompositeBookingAction({
  item,
  service: injectedService,
  readCredits,
}: {
  item: ClassDetailView;
  /** Injected by tests; production composes the HTTP adapter above. */
  service?: BookClassService;
  /** Fresh balance for the gate; defaults to the wallet route. */
  readCredits?: () => Promise<number>;
}) {
  const t = useTranslations('Booking');
  const router = useRouter();
  const locale = useLocale();
  const [state, setState] = useState<ActionState>({ phase: 'idle' });

  const port = injectedService ?? service;
  const reason = disabledReasonKey(item);
  const settledByServer = item.ownBooking?.state === 'confirmed';

  async function readHold(): Promise<SettlementReadback> {
    try {
      return { read: 'ok', ownBooking: await port.ownBooking(item.id) };
    } catch {
      // The read is what earns a success, so its failure stays visible as
      // "cannot verify" rather than collapsing into a comfortable default.
      return { read: 'failed' };
    }
  }

  function reportFailure(error: unknown): void {
    if (error instanceof BookingError) {
      const mapped = t.raw(`error.${error.reason}`);
      setState({ phase: 'failed', message: typeof mapped === 'string' ? mapped : t('error.unknown') });
      return;
    }
    setState({
      phase: 'failed',
      message: error instanceof Error ? error.message : t('error.unknown'),
    });
  }

  function toActionState(status: SettlementStatus, confirmError: unknown): ActionState {
    if (status === 'settled') return { phase: 'settled' };
    // The read says there is no live hold and the confirm call refused as well:
    // that is a real failure with a real reason (insufficient credits, …).
    if (status === 'unconfirmed' && confirmError !== null) {
      return {
        phase: 'failed',
        message:
          confirmError instanceof Error ? confirmError.message : t('error.unknown'),
      };
    }
    return { phase: 'checking', status, reading: false };
  }

  async function submit(): Promise<void> {
    setState({ phase: 'busy' });

    try {
      // 1. Hold — `obtainHold` reuses the learner's live hold instead of asking
      //    the server for a second seat it will reject as a duplicate. A
      //    rejection (class full, window closed, …) surfaces the reason the
      //    server sent, never a redirect and never a success.
      const bookingId = await obtainHold(item, port);

      // 2. Gate — the shared check reads a fresh balance at press time so the
      //    decision uses the credits the learner has *now*, not the ones the
      //    page rendered with. Unaffordable or unreadable both go to checkout,
      //    where the hold's countdown and the top-up branch live; confirm is
      //    never attempted (§2.3: there is no synchronous gate to call).
      const gate = await checkBalanceGate(item.priceCredits, readCredits);
      if (gate.decision !== 'sufficient') {
        router.push(`/${locale}/classes/${item.id}/checkout`);
        return;
      }

      // 3. Confirm — then believe the read-back, not the reply.
      let response: ConfirmBookingResponse | null = null;
      let confirmError: unknown = null;
      try {
        response = await port.confirm(bookingId);
      } catch (error) {
        confirmError = error;
      }

      const status = resolveSettlement(response, await readHold());
      setState(toActionState(status, confirmError));
    } catch (error) {
      // A booking rejection carries the backend's stable reason; anything else
      // degrades to its message. Both render as the reason, not as success.
      reportFailure(error);
    }
  }

  async function recheck(current: Exclude<SettlementStatus, 'settled'>): Promise<void> {
    // Keep showing the status being re-read: flipping it mid-flight would claim
    // a change the read has not reported yet.
    setState({ phase: 'checking', status: current, reading: true });
    const status = resolveSettlement(null, await readHold());
    setState(status === 'settled' ? { phase: 'settled' } : { phase: 'checking', status, reading: false });
  }

  const settled = state.phase === 'settled' || (state.phase === 'idle' && settledByServer);

  if (settled) {
    return (
      <div className="flex flex-col gap-2" data-testid="booking-action">
        <StatusPill tone="success">{t('settled')}</StatusPill>
        <p className="text-xs text-ink-soft">{t('settledHint')}</p>
      </div>
    );
  }

  if (state.phase === 'checking') {
    const copy =
      state.status === 'settling'
        ? { title: t('settling'), hint: t('settlingHint') }
        : state.status === 'unconfirmed'
          ? { title: t('unconfirmed'), hint: t('unconfirmedHint') }
          : { title: t('unknown'), hint: t('unknownHint') };
    return (
      <div className="flex flex-col gap-2" data-testid="booking-action">
        <StatusPill tone="warning">{copy.title}</StatusPill>
        <p className="text-xs text-ink-soft">{copy.hint}</p>
        <button
          type="button"
          onClick={() => void recheck(state.status)}
          disabled={state.reading}
          className="self-start rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('recheck')}
        </button>
      </div>
    );
  }

  const reasonText =
    reason === null
      ? null
      : {
          confirmed: t('disabled.confirmed'),
          full: t('disabled.full'),
          notOpen: t('disabled.notOpen'),
          tooSoon: t('disabled.tooSoon'),
          notBookable: t('disabled.notBookable'),
        }[reason];

  return (
    <div className="flex flex-col gap-2" data-testid="booking-action">
      <BookButton
        label={t('confirm')}
        busyLabel={t('confirming')}
        busy={state.phase === 'busy'}
        disabled={reason !== null}
        onPress={() => void submit()}
      />
      {state.phase === 'failed' ? (
        <p className="text-xs font-medium text-error-ink" role="alert">
          {state.message}
        </p>
      ) : null}
      {reasonText !== null ? <p className="text-xs text-ink-soft">{reasonText}</p> : null}
    </div>
  );
}
