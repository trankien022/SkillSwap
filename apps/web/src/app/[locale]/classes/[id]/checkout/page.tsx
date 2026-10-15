'use client';

import { use, useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { PageIntro } from '../../../../../components/ui/PageIntro';
import { StatePanel } from '../../../../../components/ui/StatePanel';
import { WorkspaceFooter } from '../../../../../components/ui/WorkspaceFooter';
import { Navbar } from '../../../../../components/navbar';
import { callApi, callApiOk, unwrapEnvelope, dispatchWalletBalanceUpdate, UNAUTHORIZED_CODE, type ApiResponseError } from '../../../../../lib/api-client';
import { ClassDetailApiGateway } from '../../../../../lib/marketplace/api-class-detail';
import { HttpBookingGateway } from '../../../../../lib/booking/http-gateway';
import { BookClassService } from '../../../../../lib/booking/service';
import { decideGate, obtainHold, topUpAmountForShortfall, type BalanceGate } from '../../../../../lib/booking/gate';
import {
  resolveSettlement,
  type SettlementReadback,
  type SettlementStatus,
} from '../../../../../lib/booking/settlement';
import { BookingError } from '../../../../../lib/booking/domain';
import type { ClassDetailView } from '../../../../../lib/marketplace/types';
import type { WalletBalanceView, TopUpIntentCreated, TopUpIntentStatusView } from '@skillswap/contracts';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

/** Terminal states: once reached, the intent can no longer change. */
const TERMINAL_TOP_UP_STATUSES = new Set(['settled', 'failed', 'reversed']);
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 120_000;

/**
 * The checkout is the **top-up branch of the booking flow**, not a second way
 * into it (D5).
 *
 * Reached when the class detail's balance gate fails, it has one job: let the
 * learner add credits and then finish the booking they already started. Two
 * things follow from that, and they are the reason this page changed:
 *
 * 1. **If a hold exists, this page confirms it; it does not book again.**
 *    `POST /classes/:id/bookings` rejects a second booking for the same learner,
 *    so the old unconditional call turned a learner who had just come from the
 *    class detail into an error. `obtainHold` reuses the live hold, and only a
 *    direct visit (no hold) books — which is why the same helper is shared with
 *    the class detail action rather than reimplemented here.
 * 2. **Settlement is shown when the read-back earns it.** `POST …/confirm`
 *    answers `confirmed: false` by design while the outbox consumer settles the
 *    debit (ADR-032 C3a), so `resolveSettlement` requires the hold to read
 *    `confirmed` before anything claims success — the same rule, from the same
 *    module, as the class detail action.
 */
const bookingService = new BookClassService(new HttpBookingGateway());

export default function BookingCheckoutPage({ params }: PageProps) {
  const ui = useTranslations('Workspace.copy');

  const { id, locale } = use(params);
  const t = useTranslations('Workspace.checkout');

  const [balance, setBalance] = useState<WalletBalanceView | null>(null);
  const [classDetail, setClassDetail] = useState<ClassDetailView | null>(null);
  const [agreementChecked, setAgreementChecked] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [settlement, setSettlement] = useState<SettlementStatus | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [topUpSettled, setTopUpSettled] = useState(false);
  const topUpPollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A timer that outlives the modal would keep calling the API and warn on a
  // dead component, so it is cleared on unmount.
  useEffect(() => {
    return () => {
      if (topUpPollTimer.current !== null) {
        clearTimeout(topUpPollTimer.current);
        topUpPollTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      // 1. Load wallet balance from the server (never a cached copy).
      //    The balance gates the confirm button's affordability copy, so a
      //    failure must not leave it unset while the page claims it loaded.
      try {
        const res = await callApiOk('/wallet/balance');
        const remoteBal = await unwrapEnvelope<WalletBalanceView>(res);
        if (isMounted) setBalance(remoteBal);
      } catch (e) {
        if (isMounted) {
          setLoadError(
            (e as ApiResponseError)?.code === UNAUTHORIZED_CODE
              ? ui('yourSessionHasExpiredPleaseSign')
              : e instanceof Error
                ? e.message
                : ui('couldNotLoadYourWalletBalance'),
          );
        }
      }

      // 2. Load class details from the server. There is deliberately no local
      // fallback: a class that the API cannot resolve is not a class, and
      // synthesising one here (with a placeholder teacher name, a 5.0 rating and
      // invented stats) let learners reach checkout for classes that did not
      // exist. The empty state below handles a missing class instead.
      try {
        const gateway = new ClassDetailApiGateway();
        const item = await gateway.getById(id);
        if (isMounted && item) {
          setClassDetail(item);
        } else if (isMounted) {
          setLoadError(ui('thisClassCouldNotBeFound'));
        }
      } catch (e) {
        if (isMounted) {
          setLoadError(e instanceof Error ? e.message : ui('couldNotLoadTheClassInformation'));
        }
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // All display values are derived in this one place from the resolved class and
  // wallet. Nothing here invents a fallback for a missing field: a class the API
  // cannot resolve renders the error state below, not a placeholder price,
  // title, teacher or rating.
  // Both are required: the class prices the booking and the wallet says whether
  // it is affordable, so with either missing there is nothing honest to show.
  // The error state below names *which* read failed rather than always blaming
  // the class, which is what a wallet failure used to be reported as.
  const display =
    classDetail !== null && balance !== null
      ? { classTitle: classDetail.description || classDetail.skillName || '', teacherName: classDetail.teacherName, priceCredits: classDetail.priceCredits, currentCredits: balance.availableCredits }
      : null;


  /**
   * The gate, decided from the data this page already loaded so it states the
   * *real* shortfall. It is the same decision function the class detail action
   * runs through `checkBalanceGate`, so a learner who lands here from that
   * action sees the same verdict it did — and `unreadable` never counts as
   * affordable, which is why a missing balance is treated as `short`.
   */
  const gate: BalanceGate | null =
    classDetail === null || balance === null
      ? null
      : decideGate(classDetail.priceCredits, balance.availableCredits);

  /** The page renders the shortfall branch from the same gate the action ran. */
  const affordable = gate?.decision === 'sufficient';
  const shortfallCredits = gate?.decision === 'short' ? gate.shortfall : 0;

  /**
   * The amount the top-up modal will ask for, derived from the shortfall shown
   * above it. Computed once so the modal's copy and the request body agree, and
   * so neither can drift from what the gate decided.
   */
  const topUpAmountVnd = topUpAmountForShortfall(shortfallCredits);

  /** Reads the hold back — the only thing that may earn a success claim. */
  const readHold = async (): Promise<SettlementReadback> => {
    try {
      return { read: 'ok', ownBooking: await bookingService.ownBooking(id) };
    } catch {
      return { read: 'failed' };
    }
  };

  const refreshBalance = async () => {
    const balRes = await callApiOk('/wallet/balance');
    const remote = await unwrapEnvelope<WalletBalanceView>(balRes);
    setBalance(remote);
    dispatchWalletBalanceUpdate(remote);
  };

  const handleConfirmBooking = async () => {
    if (!agreementChecked) {
      showToast(ui('pleaseAcceptTheLearningAgreementBefore'));
      return;
    }

    setIsProcessing(true);
    setSettlement(null);
    try {
      // 1. Hold. `obtainHold` reuses the hold that brought the learner here; it
      //    books only when there is none (a direct visit to this URL). Booking
      //    unconditionally is what used to make this page fail for exactly the
      //    learners it exists to serve.
      const finalBookingId = await obtainHold(
        { id, ownBooking: classDetail?.ownBooking ?? null },
        bookingService,
      );
      setBookingId(finalBookingId);

      // 2. Confirm, then believe the read-back rather than the reply. A rejected
      //    confirm is surfaced with the server's own reason; it is never turned
      //    into a success.
      let response = null;
      let confirmError: unknown = null;
      try {
        response = await bookingService.confirm(finalBookingId);
      } catch (error) {
        confirmError = error;
      }

      const status = resolveSettlement(response, await readHold());
      setSettlement(status);

      if (status === 'settled') {
        setIsSuccessModalOpen(true);
        await refreshBalance().catch((e) => {
          // The booking is real; only the badge is stale. Say so rather than
          // showing a number that no longer matches the ledger.
          console.warn('Failed to refresh balance after settlement', e);
          showToast(ui('yourBookingIsConfirmedButThe'));
        });
        return;
      }

      if (status === 'unconfirmed' && confirmError !== null) {
        showToast(
          confirmError instanceof BookingError
            ? confirmError.message
            : confirmError instanceof Error
              ? confirmError.message
              : ui('couldNotCompleteTheBooking'),
        );
        return;
      }

      // Still settling, or the outcome could not be read: neither is a success,
      // and the state stays on screen with a way to check again.
      showToast(
        status === 'settling'
          ? ui('theSystemIsRecordingTheTransaction')
          : status === 'unknown'
            ? ui('theLatestResultCouldNotBe')
            : ui('theTransactionIsNotConfirmed'),
      );
    } catch (err) {
      // A rejection explains itself (the class filled up, the window closed, the
      // balance moved); an unexpected error keeps its own message. Both are
      // failures, and neither is a booking.
      showToast(
        err instanceof BookingError
          ? err.message
          : ui('errorundefined') + (err instanceof Error ? err.message : ui('couldNotCompleteTheBooking')),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Re-reads the hold after a top-up or a timeout. This is the recovery path for
   * `settling`/`unknown`, and the way a learner confirms a booking once the
   * credits land — no redirect parameter and no local guess is involved.
   */
  const handleRecheckSettlement = async () => {
    setIsProcessing(true);
    try {
      const status = resolveSettlement(null, await readHold());
      setSettlement(status);
      if (status === 'settled') {
        setIsSuccessModalOpen(true);
        await refreshBalance().catch(() => undefined);
        return;
      }
      showToast(
        status === 'settling'
          ? ui('theSystemIsStillRecordingThe')
          : status === 'unknown'
            ? ui('theLatestResultCouldNotBec489a')
            : ui('noHoldWasFoundForThis'),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Polls until the intent settles, the budget runs out, or we stop. The SePay
   * IPN settles server-to-server, so the client's only honest source of truth is
   * the server's own record of the intent.
   */
  const pollTopUp = useCallback((intentId: string) => {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    const tick = async () => {
      topUpPollTimer.current = null;
      try {
        const res = await callApiOk(`/wallet/top-ups/${intentId}`);
        const status = await unwrapEnvelope<TopUpIntentStatusView>(res);
        if (TERMINAL_TOP_UP_STATUSES.has(status.status)) {
          setTopUpSettled(status.status === 'settled');
          const balRes = await callApiOk('/wallet/balance');
          const remote = await unwrapEnvelope<WalletBalanceView>(balRes);
          setBalance(remote);
          dispatchWalletBalanceUpdate(remote);
          return;
        }
      } catch (e) {
        console.warn('Top-up poll failed', e);
      }

      if (Date.now() >= deadline) return;
      topUpPollTimer.current = setTimeout(() => void tick(), POLL_INTERVAL_MS);
    };

    void tick();
  }, []);

  const handleConfirmTopUp = async () => {
    try {
      setIsProcessing(true);
      setTopUpSettled(false);
      // The top-up is sized to the shortfall this page exists to close, rounded
      // up to a whole 10.000 VNĐ (1 credit = 1.000 VNĐ). The old version always
      // asked for 100.000 VNĐ, which for a learner 10 credits short meant paying
      // ten times what they owed — and for a learner 400 short, still not enough
      // to finish the booking they had already started. `topUpAmountVnd` is the
      // same value the modal displayed.
      const res = await callApi('/wallet/top-ups', {
        method: 'POST',
        body: JSON.stringify({
          amountVnd: topUpAmountVnd,
          // FR-008: come back to this client's own result page instead of the
          // configured fallback, so the payer lands on a page that can read the
          // intent back. Absolute, because SePay compares origins.
          returnUrl: new URL(`/${locale}/payment/result`, window.location.origin).toString(),
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        showToast(err.message || ui('couldNotCreateTheTopupRequest'));
        return;
      }

      const intent = await unwrapEnvelope<TopUpIntentCreated>(res);
      // ADR-033 / design B: open the hosted SePay checkout. The IPN settles the
      // intent server-to-server, so this handler must not fabricate a success,
      // and the balance is only ever read back from the server by the poll.
      window.open(intent.paymentUrl, '_blank', 'noopener,noreferrer');
      setIsTopUpModalOpen(false);
      showToast(ui('sepayCheckoutOpenedYourBalanceUpdates'));
      pollTopUp(intent.id);
    } catch (e) {
      console.warn('Top-up failed', e);
      showToast(ui('couldNotTopUpPleaseTry'));
    } finally {
      setIsProcessing(false);
    }
  };

  return <div className="flex min-h-dvh flex-col bg-mist text-ink"><Navbar currentTab="explore" {...(balance ? {balance} : {})}/><main id="main-content" tabIndex={-1} className="workspace-page flex-1"><PageIntro title={t('title')} description={t('description')} actions={<a href={`/${locale}/classes/${id}`} className="workspace-link">← {t('back')}</a>}/>
 {bookingId && <p className="mb-4 break-all text-sm text-ink-soft">{t('bookingRef')}: {bookingId}</p>}
 {toastMessage && <p role="status" className="workspace-feedback bg-neutral-tint mb-6">{toastMessage}</p>}
 {display===null || classDetail===null ? <StatePanel title={loadError ? t('loadError') : t('loading')} tone={loadError?'error':'neutral'}>{loadError || t('loadingBody')}</StatePanel> : <>
 {isSuccessModalOpen && <div className="mb-6"><StatePanel title={t('successTitle')} action={<a href={`/${locale}/bookings`} className="workspace-primary">{t('myClasses')}</a>}>{t('successBody')}</StatePanel></div>}
 <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"><div className="space-y-6"><section className="workspace-panel"><h2 className="text-2xl font-bold tracking-tight">{display.classTitle}</h2><p className="mt-3 text-base text-ink-soft">{display.teacherName}</p><dl className="workspace-profile-fields"><div><dt>{t('schedule')}</dt><dd>{new Date(classDetail.startsAt).toLocaleString(locale)}</dd></div><div><dt>{t('duration')}</dt><dd>{t('minutes',{count:classDetail.durationMinutes})}</dd></div><div><dt>{t('format')}</dt><dd>{classDetail.capacity===1?t('individual'):t('group',{count:classDetail.capacity})}</dd></div><div><dt>{t('location')}</dt><dd>{t('online')}</dd></div></dl></section>
 <section className="workspace-panel"><h2 className="workspace-panel-title">{t('beforeConfirm')}</h2><p className="mt-4 text-base leading-relaxed text-ink-soft">{t('paymentRule')}</p><a href={`/${locale}#trust`} className="workspace-link mt-3">{t('rules')} ↗</a><label className="mt-5 flex items-start gap-3 text-sm leading-relaxed"><input type="checkbox" checked={agreementChecked} onChange={e=>setAgreementChecked(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-campus-emerald-deep"/>{t('agreement')}</label></section></div>
 <aside className="workspace-panel space-y-5 lg:sticky lg:top-32"><h2 className="workspace-panel-title">{t('summary')}</h2><dl className="space-y-4"><div className="flex flex-wrap justify-between gap-3"><dt className="text-ink-soft">{t('price')}</dt><dd className="text-2xl font-bold">{display.priceCredits.toLocaleString(locale)} {t('credits')}</dd></div><div className="flex flex-wrap justify-between gap-3 text-sm"><dt className="text-ink-soft">{t('equivalent')}</dt><dd>{(display.priceCredits*1000).toLocaleString(locale)} VND</dd></div><div className="flex flex-wrap justify-between gap-3 text-sm"><dt className="text-ink-soft">{t('balance')}</dt><dd>{display.currentCredits.toLocaleString(locale)} {t('credits')}</dd></div></dl>
 {classDetail.ownBooking?.expiresAt && <p className="text-sm leading-relaxed text-ink-soft">{t('holdExpires',{time:new Date(classDetail.ownBooking.expiresAt).toLocaleString(locale)})}</p>}
 <button type="button" onClick={handleConfirmBooking} disabled={isProcessing || settlement==='settled' || !affordable || !agreementChecked} className="workspace-primary w-full">{isProcessing?t('confirming'):settlement==='settled'?t('confirmed'):t('confirm')}</button>
 {settlement && settlement!=='settled' && <div role="status" className="rounded-xl bg-neutral-tint p-4"><p className="text-sm leading-relaxed">{t(`settlement.${settlement}`)}</p><button type="button" onClick={handleRecheckSettlement} disabled={isProcessing} className="workspace-secondary mt-3">{t('recheck')}</button></div>}
 {!affordable && <div className="rounded-xl bg-warning-tint p-4"><p className="text-sm leading-relaxed text-warning-ink">{t('shortfall',{count:shortfallCredits})}</p><button type="button" className="workspace-secondary mt-3" onClick={()=>setIsTopUpModalOpen(open=>!open)} aria-expanded={isTopUpModalOpen}>{t('topUp')}</button></div>}
 {isTopUpModalOpen && <section className="rounded-xl bg-mist p-4"><h3 className="font-semibold">{t('topUpTitle')}</h3><p className="my-3 text-sm leading-relaxed text-ink-soft">{t('topUpBody',{amount:topUpAmountVnd.toLocaleString(locale)})}</p><button type="button" onClick={handleConfirmTopUp} disabled={isProcessing} className="workspace-primary">{t('openSePay')}</button></section>}
 {topUpSettled && <p role="status" className="workspace-feedback workspace-feedback-success">{t('topUpSettled')}</p>}
 </aside></div></>}
 </main><WorkspaceFooter/></div>;
}
