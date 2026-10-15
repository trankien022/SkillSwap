'use client';

import { use, useState, useEffect, useRef, useCallback } from 'react';
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
  const { id, locale } = use(params);

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
              ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
              : e instanceof Error
                ? e.message
                : 'Không tải được số dư ví.',
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
          setLoadError('Không tìm thấy lớp học này. Có thể lớp đã bị hủy hoặc đường dẫn không đúng.');
        }
      } catch (e) {
        if (isMounted) {
          setLoadError(e instanceof Error ? e.message : 'Không tải được thông tin lớp học.');
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
      ? buildDisplayModel(classDetail, balance)
      : null;

  const balanceUnavailable = balance === null;

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
      showToast('Vui lòng chọn cam kết văn hóa học tập trước khi tiếp tục.');
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
          showToast('Đã đặt lớp, nhưng chưa đọc lại được số dư ví. Vui lòng tải lại trang để xem số dư mới nhất.');
        });
        return;
      }

      if (status === 'unconfirmed' && confirmError !== null) {
        showToast(
          confirmError instanceof BookingError
            ? confirmError.message
            : confirmError instanceof Error
              ? confirmError.message
              : 'Không thể hoàn tất đặt lớp.',
        );
        return;
      }

      // Still settling, or the outcome could not be read: neither is a success,
      // and the state stays on screen with a way to check again.
      showToast(
        status === 'settling'
          ? 'Hệ thống đang ghi nhận giao dịch. Bấm kiểm tra lại sau giây lát.'
          : status === 'unknown'
            ? 'Chưa đọc được kết quả mới nhất. Bấm kiểm tra lại để thử lại.'
            : 'Giao dịch chưa được xác nhận.',
      );
    } catch (err) {
      // A rejection explains itself (the class filled up, the window closed, the
      // balance moved); an unexpected error keeps its own message. Both are
      // failures, and neither is a booking.
      showToast(
        err instanceof BookingError
          ? err.message
          : 'Lỗi: ' + (err instanceof Error ? err.message : 'Không thể hoàn tất đặt lớp.'),
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
          ? 'Hệ thống vẫn đang ghi nhận giao dịch.'
          : status === 'unknown'
            ? 'Chưa đọc được kết quả mới nhất. Vui lòng thử lại.'
            : 'Không tìm thấy chỗ đã giữ cho lớp này. Hãy đặt lại từ trang lớp học.',
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
        showToast(err.message || 'Không thể tạo yêu cầu nạp tiền.');
        return;
      }

      const intent = await unwrapEnvelope<TopUpIntentCreated>(res);
      // ADR-033 / design B: open the hosted SePay checkout. The IPN settles the
      // intent server-to-server, so this handler must not fabricate a success,
      // and the balance is only ever read back from the server by the poll.
      window.open(intent.paymentUrl, '_blank', 'noopener,noreferrer');
      setIsTopUpModalOpen(false);
      showToast('Đã mở trang thanh toán SePay. Số dư sẽ cập nhật ngay khi SePay xác nhận.');
      pollTopUp(intent.id);
    } catch (e) {
      console.warn('Top-up failed', e);
      showToast('Không thể nạp tiền. Vui lòng thử lại.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 text-slate-900 antialiased">
      {/* Top Synchronized Navbar */}
      <Navbar currentTab="explore" balance={balance} />

      <main id="main-content" tabIndex={-1} className="workspace-checkout w-full flex-1">
        {display === null ? (
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 py-24 text-center">
            <h1 className="text-lg font-bold text-slate-900">
              {loadError !== null
                ? balanceUnavailable
                  ? 'Chưa đọc được số dư ví'
                  : 'Không tải được thông tin lớp học'
                : 'Đang tải thông tin lớp học…'}
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-slate-600">
              {loadError ??
                'Hệ thống đang đọc lớp học và số dư ví từ máy chủ. Thao tác đặt lớp chỉ khả dụng khi có đủ dữ liệu.'}
            </p>
            {loadError !== null && (
              <a
                href={`/${locale}/classes`}
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-campus-emerald-deep px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink"
              >
                Về trang khám phá lớp
              </a>
            )}
          </div>
        ) : (
          <>
        {/* Dynamic Notification Banner / Top Flow Signal */}
        <div className="w-full bg-emerald-50 border-b border-emerald-100 px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold text-emerald-800">
                Bạn đang ở bước nạp credit
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">verified_user</span>
              <span>Credits chỉ chuyển cho giảng viên sau khi buổi học hoàn tất</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-4">
            <ol className="flex items-center flex-wrap gap-2 text-sm text-slate-500">
              <li>
                <a href={`/${locale}/classes`} className="hover:text-emerald-700 transition-colors flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">school</span>
                  Khám phá
                </a>
              </li>
              <li className="text-slate-300">/</li>
              <li>
                <a href={`/${locale}/classes/${id}`} className="hover:text-emerald-700 transition-colors">
                  {display.skillBadge}
                </a>
              </li>
              <li className="text-slate-300">/</li>
              <li aria-current="page" className="text-slate-900 font-semibold">
                Xác nhận &amp; Thanh toán
              </li>
            </ol>
          </nav>

          {/* Page Header & Process Steps Tracker */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <p className="text-sm text-emerald-700 uppercase tracking-wider font-semibold mb-1">
                Bước cuối để hoàn tất đặt lớp
              </p>
              <h1 className="workspace-title">
                Xác nhận &amp; Thanh toán
              </h1>
            </div>
            <div className="flex items-center gap-2 self-start md:self-auto bg-white border border-slate-200 px-3.5 py-1.5 rounded-full text-sm">
              <span className="w-5 h-5 rounded-full bg-campus-emerald-deep text-white flex items-center justify-center font-bold text-sm">
                1
              </span>
              <span className="font-semibold text-emerald-700">Xem lại &amp; xác nhận</span>
              <span className="text-slate-300">—</span>
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-semibold text-sm">
                2
              </span>
              <span className="text-slate-500 font-medium">Vào phòng Jitsi</span>
            </div>
          </div>

          {/* Main Content Layout (65% / 35%) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-6">
            {/* Cột trái (8 cols): Thông tin lớp, giảng viên, quyền lợi & Cam kết */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* Card 1: Thẻ tóm tắt lớp học */}
              <section className="workspace-panel">
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-sm font-semibold border border-emerald-100">
                      {display.skillBadge}
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-sm font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-emerald-600">lock_clock</span>
                      Giữ chỗ trong 15 phút
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-slate-400 block">Định danh buổi:</span>
                    <span className="font-mono text-sm text-slate-800 font-semibold">#SEC-{id.slice(-4).toUpperCase()}</span>
                  </div>
                </div>

                <h2 className="text-xl font-bold text-slate-900 mt-4 mb-4 leading-snug">
                  {display.classTitle}
                </h2>

                {/* Mentor Profile Card */}
                <div className="bg-slate-50 rounded-xl p-4 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-slate-100">
                  <div className="flex items-center gap-3.5">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xl ring-2 ring-white">
                        {display.teacherInitials}
                      </div>
                      <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-white flex items-center justify-center">
                        <span
                          className="material-symbols-outlined text-[14px] text-emerald-600"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          verified
                        </span>
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-base text-slate-900">{display.teacherName}</span>
                        {display.skillBadge !== null && (
                          <span className="text-sm px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">
                            {display.skillBadge}
                          </span>
                        )}
                      </div>
                      {display.schoolName !== null && (
                        <p className="text-sm text-slate-600">
                          {display.schoolName}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5 text-sm text-slate-500">
                        {/* The credential claim appears only when the API
                            actually asserts it; no such flag on this route. */}
                        {display.credentialsVerified && (
                          <>
                            <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[14px]">shield</span> Đã xác minh bằng cấp
                            </span>
                            <span>•</span>
                          </>
                        )}
                        {display.hoursTaught !== null && (
                          <>
                            <span>{display.hoursTaught} buổi đã dạy</span>
                            <span>•</span>
                          </>
                        )}
                        {display.ratingAvg === null ? (
                          <span>Chưa có đánh giá</span>
                        ) : (
                          <span className="text-slate-800 font-medium">Đánh giá {display.ratingAvg}/5.0</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <a
                    href={`/${locale}/classes/${id}`}
                    className="px-3.5 py-1.5 rounded-lg bg-white text-slate-700 text-sm font-semibold hover:bg-slate-100 transition-colors border border-slate-200 self-stretch sm:self-auto text-center"
                  >
                    Xem chi tiết lớp
                  </a>
                </div>

                {/* Chi tiết lịch & Định dạng phòng */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3.5 flex items-start gap-3 border border-slate-100">
                    <div className="p-2 rounded-lg bg-white text-emerald-600 border border-slate-100">
                      <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                    </div>
                    <div>
                      <span className="text-sm text-slate-500 block">Thời gian học</span>
                      <span className="text-sm font-semibold text-slate-900">{display.timeFormatted}</span>
                      <span className="text-sm text-slate-500 block">{display.dateFormatted}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3.5 flex items-start gap-3 border border-slate-100">
                    <div className="p-2 rounded-lg bg-white text-emerald-600 border border-slate-100">
                      <span className="material-symbols-outlined text-[20px]">videocam</span>
                    </div>
                    <div>
                      <span className="text-sm text-slate-500 block">Hình thức học</span>
                      <span className="text-sm font-semibold text-slate-900">Jitsi Meet Nội bộ</span>
                      <span className="text-sm text-emerald-700 font-semibold block">Mã hóa phòng E2E</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3.5 flex items-start gap-3 sm:col-span-2 md:col-span-1 border border-slate-100">
                    <div className="p-2 rounded-lg bg-white text-emerald-600 border border-slate-100">
                      <span className="material-symbols-outlined text-[20px]">groups</span>
                    </div>
                    <div>
                      <span className="text-sm text-slate-500 block">Quy mô lớp</span>
                      <span className="text-sm font-semibold text-slate-900">{display.formatText}</span>
                      <span className="text-sm text-slate-500 block">Dành riêng cho bạn</span>
                    </div>
                  </div>
                </div>

                {/* Quy chuẩn thời gian: derived from the class's real start
                    time, not a fixed "38 giờ 15 phút" string. */}
                <div className="mt-4 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between gap-2 text-slate-700 text-sm">
                  <span className="flex items-center gap-1.5 text-emerald-800 font-medium">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                    {display.leadTimeText}
                  </span>
                </div>
              </section>

              {/* Card 2: protection & refund terms, stated in the product's own
                  words. The previous version was a marketing diagram with an
                  invented step-1 amount ("Khóa 100 Credits"), a "100% refund"
                  promise and internal requirement IDs, none of which described
                  what the system actually does. */}
              <section className="workspace-panel">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">lock</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">
                      Quyền lợi người học &amp; chính sách hoàn
                    </h3>
                    <p className="text-sm text-slate-500">
                      Credits chỉ chuyển cho giảng viên sau khi buổi học hoàn tất.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="material-symbols-outlined text-[20px] text-emerald-600 mt-0.5">
                      account_balance_wallet
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Credits được giữ lại khi bạn đặt lớp</h4>
                      <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">
                        Học phí của buổi học được ghi nhận vào sổ cái và{' '}
                        <span className="font-semibold text-slate-800">chỉ chuyển cho giảng viên</span> sau khi buổi học
                        hoàn tất.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="material-symbols-outlined text-[20px] text-emerald-600 mt-0.5">
                      history
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Hoàn credits khi giảng viên vắng mặt</h4>
                      <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">
                        Nếu giảng viên vắng mặt hoặc hủy trước giờ học,{' '}
                        <span className="font-semibold text-slate-800">toàn bộ credits</span> được hệ thống tự động
                        hoàn về số dư khả dụng của bạn.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="material-symbols-outlined text-[20px] text-slate-500 mt-0.5">
                      info
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">Hủy đặt chỗ sau khi đã xác nhận</h4>
                        <span className="text-xs px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-semibold">
                          Quy định hiện hành
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">
                        Nhằm bảo vệ thời gian chuẩn bị giáo trình của giảng viên,{' '}
                        <span className="font-semibold text-slate-800">
                          hiện chưa hỗ trợ học viên tự hủy booking sau khi đã xác nhận
                        </span>
                        . Xin vui lòng sắp xếp thời gian chắc chắn trước khi bấm hoàn tất.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Card 3: Cam kết văn hóa học tập */}
              <section className="workspace-panel">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[22px] text-emerald-600">diversity_3</span>
                    <h3 className="font-bold text-base text-slate-900">
                      Cam kết Văn hóa Học thuật Sinh viên SkillSwap
                    </h3>
                  </div>
                  <span className="text-sm text-slate-400">Bộ quy tắc sinh viên 2025</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <span className="material-symbols-outlined text-[22px] text-emerald-600 mb-1">timer</span>
                    <p className="text-sm font-semibold text-slate-900">Đúng giờ chuẩn mực</p>
                    <p className="text-sm text-slate-500 mt-0.5">Vào phòng Jitsi trước 3-5 phút kiểm tra mic</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <span className="material-symbols-outlined text-[22px] text-indigo-600 mb-1">psychology</span>
                    <p className="text-sm font-semibold text-slate-900">Tôn trọng tri thức</p>
                    <p className="text-sm text-slate-500 mt-0.5">Chuẩn bị sẵn bài luyện nói &amp; thắc mắc</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <span className="material-symbols-outlined text-[22px] text-amber-600 mb-1">handshake</span>
                    <p className="text-sm font-semibold text-slate-900">Đánh giá trung thực</p>
                    <p className="text-sm text-slate-500 mt-0.5">Để lại feedback chân thực giúp xây dựng cộng đồng</p>
                  </div>
                </div>

                {/* Interactive Agreement Checkbox */}
                <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreementChecked}
                    onChange={(e) => setAgreementChecked(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-emerald-600 accent-emerald-600 cursor-pointer"
                  />
                  <span className="text-sm text-slate-700 leading-relaxed">
                    Tôi xác nhận đã đọc, hiểu rõ chính sách giữ chỗ và cam kết tham gia lớp học đúng giờ, tôn trọng giảng viên {display.teacherName}.
                  </span>
                </label>
              </section>
            </div>

            {/* Cột phải (4 cols, sticky): Financial Ledger, Balance & CTA */}
            <div className="lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-20">
              {/* Card Ledger Tài chính */}
              <div className="workspace-panel">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-base text-slate-900">Chi tiết thanh toán</h3>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-sm border border-emerald-100">
                    Credits
                  </span>
                </div>

                {/* Chi tiết bảng giá */}
                <div className="space-y-3 pb-5 border-b border-slate-100 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Học phí buổi học ({display.durationMin} phút)</span>
                    <span className="font-mono font-semibold text-slate-900">{display.priceCredits} Credits</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-400 -mt-1 pl-2">
                    <span>Tương đương quy đổi</span>
                    <span className="font-mono">{(display.priceCredits * 1000).toLocaleString('vi-VN')} VNĐ</span>
                  </div>
                  <div className="h-px bg-slate-100 my-2"></div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-semibold text-slate-900">Tổng thanh toán</span>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-emerald-700 font-mono leading-none">{display.priceCredits}</span>
                      <span className="text-sm font-semibold text-emerald-700 ml-1">Credits</span>
                    </div>
                  </div>
                </div>

                {/* Số dư hiện tại, as read from the wallet. The page deliberately
                    does not project a "balance after the hold": the hold and the
                    debit are the server's to apply, and a locally subtracted
                    number would sit next to a real one and look equally true. */}
                <div className="bg-slate-50 rounded-xl p-4 my-5 space-y-2.5 border border-slate-100 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Số dư khả dụng hiện tại:</span>
                    <span className="font-mono font-semibold text-slate-900">{display.currentCredits} Credits</span>
                  </div>
                  {affordable ? (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Còn lại sau khi trả học phí:</span>
                      <span className="font-mono font-semibold text-emerald-700 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">check_circle</span>
                        {display.currentCredits - display.priceCredits} Credits
                      </span>
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-white border border-amber-200 text-amber-800 text-sm flex items-center gap-1.5 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      Còn thiếu {shortfallCredits} Credits để thanh toán lớp này.
                    </div>
                  )}
                </div>

                {/* Primary Confirmation Button. It is disabled while the
                    learner cannot afford the class: pressing it would only ask
                    the server to debit credits that are not there, and the
                    `Nạp thêm credit` card below is the path that actually works.
                    A live hold from the class detail also lands here, and its
                    countdown is shown next to the button. */}
                <button
                  type="button"
                  disabled={isProcessing || settlement === 'settled' || !affordable}
                  onClick={handleConfirmBooking}
                  className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 group cursor-pointer ${
                    settlement === 'settled'
                      ? 'bg-campus-emerald-deep text-white cursor-default'
                      : !affordable
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-campus-emerald-deep hover:bg-ink text-white'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                      <span>Đang xác nhận…</span>
                    </>
                  ) : settlement === 'settled' ? (
                    <>
                      <span className="material-symbols-outlined text-[20px]">check_circle</span>
                      <span>Đã xác nhận đặt lớp</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px] group-hover:rotate-12 transition-transform">
                        lock
                      </span>
                      <span>Xác nhận &amp; Thanh toán ({display.priceCredits} Credits)</span>
                    </>
                  )}
                </button>

                {/* Settlement states that are neither success nor failure. They
                    are shown instead of a claim, with the read-back behind the
                    `check again` action. */}
                {settlement !== null && settlement !== 'settled' && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">
                      {settlement === 'settling'
                        ? 'Đang chờ hệ thống ghi nhận'
                        : settlement === 'unknown'
                          ? 'Chưa kiểm tra được kết quả'
                          : 'Giao dịch chưa được xác nhận'}
                    </p>
                    <p className="mt-0.5 text-slate-600">
                      {settlement === 'settling'
                        ? 'Giao dịch chưa ghi nhận xong. Kiểm tra lại sau giây lát.'
                        : settlement === 'unknown'
                          ? 'Không đọc được trạng thái mới nhất. Hãy kiểm tra lại.'
                          : 'Hệ thống chưa ghi nhận chỗ ngồi cho bạn. Kiểm tra lại hoặc đặt lại từ trang lớp học.'}
                    </p>
                    <button
                      type="button"
                      onClick={handleRecheckSettlement}
                      disabled={isProcessing}
                      className="mt-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-800 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Kiểm tra lại
                    </button>
                  </div>
                )}

                <p className="text-sm text-slate-500 text-center mt-3">
                  {affordable
                    ? `Bằng việc bấm xác nhận, ${display.priceCredits} Credits sẽ được trừ theo cơ chế bảo chứng của SkillSwap.`
                    : `Bạn còn thiếu ${shortfallCredits} Credits cho lớp này. Hãy nạp thêm rồi xác nhận.`}
                </p>
              </div>

              {/* Số dư không đủ. This card is the reason the page exists, and it
                  states the real shortfall — never an invented amount. */}
              {!affordable && (
                <div className="bg-white rounded-2xl p-5 border border-amber-200 bg-amber-50/40 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] text-amber-600">add_card</span>
                      <h4 className="text-sm font-bold text-slate-900">Số dư không đủ?</h4>
                    </div>
                    <span className="text-xs px-1.5 py-0.2 rounded bg-white text-slate-600 font-mono border border-slate-200">
                      SePay
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Bạn cần thêm <strong className="text-slate-900">{shortfallCredits} Credits</strong> để xác nhận lớp này.
                    Nạp qua <strong className="text-slate-900">cổng thanh toán SePay</strong> và số dư sẽ cập nhật ngay khi SePay xác nhận.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsTopUpModalOpen(true)}
                    className="w-full py-2.5 px-3 rounded-xl bg-campus-emerald-deep text-white hover:bg-ink transition-colors text-sm font-semibold flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                    Nạp thêm credit
                  </button>
                </div>
              )}

              {/* Trợ giúp & Khiếu nại 24/7 */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">support_agent</span>
                  <span>Cần đổi giờ học với Mentor?</span>
                </div>
                <button
                  type="button"
                  onClick={() => showToast('Đang kết nối trung tâm hỗ trợ SkillSwap...')}
                  className="text-emerald-700 font-semibold hover:underline"
                >
                  Liên hệ Admin
                </button>
              </div>
            </div>
          </div>
        </div>
          </>
        )}
      </main>

      {/* Success / top-up modals read derived values from `classDetail` and
          `balance`, so they render only once both are loaded. */}
      {display !== null && (
        <>
          {/* SUCCESS MODAL */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40  flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl text-center border border-slate-200">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            </div>
            {bookingId !== null && (
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-mono font-semibold">
                Mã giữ chỗ: {bookingId}
              </span>
            )}
            <h3 className="text-xl font-bold text-slate-900 mt-3 mb-2">Đặt lớp thành công!</h3>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">
              Hệ thống đã xác nhận <strong className="text-slate-900 font-semibold">{display.priceCredits} Credits</strong> cho buổi học này. Bạn có thể vào phòng học khi lớp mở.
            </p>
            <div className="bg-slate-50 rounded-xl p-3.5 text-left text-sm space-y-2 mb-6 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Lớp học:</span>
                <span className="font-semibold text-slate-900 text-right">{display.skillBadge}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mentor:</span>
                <span className="font-semibold text-slate-900">{display.teacherName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Giờ học:</span>
                <span className="font-semibold text-emerald-700">{display.timeFormatted}, {display.dateFormatted}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
                <span className="text-slate-500">Số dư ví còn lại:</span>
                <span className="font-mono text-emerald-700">{display.currentCredits} Credits</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              {bookingId !== null && (
                <a
                  href={`/${locale}/bookings/${bookingId}/live`}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-campus-emerald-deep text-white text-sm font-semibold hover:bg-ink transition-colors text-center flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">videocam</span>
                  Vào phòng học ngay
                </a>
              )}
              <a
                href={`/${locale}/bookings`}
                className="py-2.5 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors text-center"
              >
                Lịch học của tôi
              </a>
              <button
                type="button"
                onClick={() => setIsSuccessModalOpen(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP-UP MODAL — real SePay hosted checkout (ADR-033) */}
      {isTopUpModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40  flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl text-center border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-emerald-600">credit_card</span>
                <h3 className="text-base font-bold text-slate-900">Nạp credit qua SePay</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTopUpModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <p className="text-sm text-slate-600 text-left my-3 leading-relaxed">
              Bạn sẽ được chuyển sang <strong>trang thanh toán của SePay</strong> trong một tab mới để
              chọn phương thức thanh toán và hoàn tất giao dịch. Số dư được cộng ngay khi SePay xác
              nhận, không cần quét mã thủ công.
            </p>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-left space-y-2 mb-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Số tiền nạp:</span>
                <span className="font-bold text-emerald-700">
                  {topUpAmountVnd.toLocaleString('vi-VN')} VNĐ
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Quy đổi:</span>
                <span className="font-bold text-slate-900">{topUpAmountVnd / 1_000} Credit</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Cổng thanh toán:</span>
                <span className="font-medium text-slate-900">SePay Payment Gateway</span>
              </div>
            </div>
            {topUpSettled && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-left text-sm text-emerald-800 mb-4">
                <span className="font-semibold block mb-0.5">Đã cộng vào ví.</span>
                Số dư đã được cập nhật. Giờ bạn có thể tiếp tục xác nhận đặt lớp.
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleConfirmTopUp()}
              disabled={isProcessing}
              className="w-full py-3 rounded-xl bg-campus-emerald-deep hover:bg-ink disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              {isProcessing ? 'Đang xử lý…' : 'Mở trang thanh toán SePay'}
            </button>
          </div>
        </div>
      )}
        </>
      )}

      {/* Floating Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-sm font-medium border border-slate-800 animate-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-[18px] text-emerald-400">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full bg-white border-t border-slate-200 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500 text-center sm:text-left">
            © 2025 SkillSwap Vietnam. Nền tảng học hỏi kỹ năng ngang hàng sinh viên.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
            <a className="hover:text-emerald-700 transition-colors" href="#">Trợ giúp</a>
            <span>•</span>
            <a className="hover:text-emerald-700 transition-colors" href="#">Quy định &amp; Chính sách</a>
            <span>•</span>
            <a className="hover:text-emerald-700 transition-colors" href="#">Quy định bảo vệ người học</a>
            <span>•</span>
            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">language</span>
              Tiếng Việt (VN)
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Derived display values for the checkout screen.
 *
 * Takes the resolved class and wallet (not nullable there) and computes every
 * figure the UI shows, so the JSX never reaches for a fallback constant. The
 * previous version read `classDetail?.priceCredits ?? 90`,
 * `teacherName ?? 'ThS. Lan Anh'`, `ratingAvg ?? 4.98` and similar, which meant
 * a class that failed to load still rendered a plausible-looking checkout page
 * with someone else's name and an invented rating on it.
 */
function buildDisplayModel(classDetail: ClassDetailView, balance: WalletBalanceView) {
  const currentCredits = balance.availableCredits;
  const priceCredits = classDetail.priceCredits;
  // The affordability verdict is deliberately **not** computed here: the gate
  // (`decideGate`) owns it, so the page cannot show a "shortfall" that disagrees
  // with what the booking action decided. A "balance after the hold" figure is
  // likewise not computed — the hold and later debit are the server's to decide,
  // and a locally subtracted number sat next to a real one and looked equally
  // true.

  const teacherName = classDetail.teacherName;
  const teacherInitials =
    teacherName
      .split(' ')
      .filter(Boolean)
      .slice(-2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'GV';

  const startsAtDate = new Date(classDetail.startsAt);

  return {
    currentCredits,
    priceCredits,
    classTitle: classDetail.description || classDetail.skillName || '',
    skillBadge: classDetail.skillName,
    teacherName,
    teacherInitials,
    schoolName: classDetail.schoolName,
    // Null when the teacher has no ratings; the view says so instead of "5.00".
    ratingAvg: classDetail.ratingAvg === null ? null : classDetail.ratingAvg.toFixed(2),
    hoursTaught: classDetail.teacherStats?.hoursTaught ?? null,
    // The API sends no credential flag on this route; only an explicit `true`
    // may be shown as verified.
    credentialsVerified: classDetail.verified === true,
    timeFormatted: `${startsAtDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(startsAtDate.getTime() + classDetail.durationMinutes * 60000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
    dateFormatted: startsAtDate.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    durationMin: classDetail.durationMinutes,
    // The 24-hour booking rule is stated from the class's real start time. The
    // page used to print a fixed "còn lại 38 giờ 15 phút" for every class.
    leadTimeText:
      startsAtDate.getTime() - Date.now() >= 24 * 60 * 60 * 1000
        ? 'Thoả mãn quy tắc đặt trước tối thiểu 24 giờ'
        : 'Lớp sắp diễn ra trong vòng 24 giờ tới',
    formatText:
      classDetail.format === 'one-on-one'
        ? '1-on-1 Cá nhân'
        : classDetail.capacity > 1
          ? `Nhóm nhỏ (${classDetail.capacity} học viên)`
          : '1-on-1 Cá nhân',
  };
}
