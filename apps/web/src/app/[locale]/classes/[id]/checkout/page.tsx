'use client';

import { use, useState, useEffect, useRef, useCallback } from 'react';
import { Navbar } from '../../../../../components/navbar';
import { callApi, callApiOk, unwrapEnvelope, dispatchWalletBalanceUpdate, UNAUTHORIZED_CODE, type ApiResponseError } from '../../../../../lib/api-client';
import { ClassDetailApiGateway } from '../../../../../lib/marketplace/api-class-detail';
import type { ClassDetailView } from '../../../../../lib/marketplace/types';
import type { WalletBalanceView, TopUpIntentCreated, TopUpIntentStatusView } from '@skillswap/contracts';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

/** Terminal states: once reached, the intent can no longer change. */
const TERMINAL_TOP_UP_STATUSES = new Set(['settled', 'failed', 'reversed']);
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 120_000;

export default function BookingCheckoutPage({ params }: PageProps) {
  const { id, locale } = use(params);

  const [balance, setBalance] = useState<WalletBalanceView | null>(null);
  const [classDetail, setClassDetail] = useState<ClassDetailView | null>(null);
  const [agreementChecked, setAgreementChecked] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
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

  const handleConfirmBooking = async () => {
    if (!agreementChecked) {
      showToast('Vui lòng chọn cam kết văn hóa học tập trước khi tiếp tục.');
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Hold booking via POST /api/classes/:id/bookings
      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `idemp-${Date.now()}`;

      const res = await callApi(
        `/classes/${id}/bookings`,
        {
          method: 'POST',
          body: JSON.stringify({ idempotencyKey }),
        },
        false,
      );

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        showToast(err.message || 'Không thể giữ chỗ cho lớp này. Vui lòng thử lại.');
        return;
      }

      const bookResult = await unwrapEnvelope<{
        booking: { bookingId: string; priceCredits: number };
        created: boolean;
      }>(res);
      const finalBookingId = bookResult.booking.bookingId;
      setBookingId(finalBookingId);

      // 2. Settle payment via POST /api/classes/bookings/:bookingId/confirm
      const confirmRes = await callApi(
        `/classes/bookings/${finalBookingId}/confirm`,
        {
          method: 'POST',
        },
        false,
      );

      if (!confirmRes.ok) {
        const err = (await confirmRes.json().catch(() => ({}))) as { message?: string };
        showToast(err.message || 'Số dư ví không đủ để thanh toán giữ chỗ.');
        return;
      }

      // Both calls succeeded, so the booking and the escrow hold are real.
      setBookingConfirmed(true);
      setIsSuccessModalOpen(true);

      // The confirm call settled the escrow on the server, so the balance is
      // refetched rather than calculated. Subtracting the price locally would
      // ignore the escrow hold vs. debit distinction and any server-side fee,
      // and would persist that guess across reloads.
      try {
        const balRes = await callApiOk('/wallet/balance');
        const remote = await unwrapEnvelope<WalletBalanceView>(balRes);
        setBalance(remote);
        dispatchWalletBalanceUpdate(remote);
      } catch (e) {
        // The booking already succeeded, so this is only a stale badge; the
        // success modal's balance line reads `display.currentCredits`, which was
        // derived from the pre-settlement read, so say so rather than silently
        // showing a number that no longer matches the ledger.
        console.warn('Failed to refresh balance after settlement', e);
        showToast('Đã đặt lớp, nhưng chưa đọc lại được số dư ví. Vui lòng tải lại trang để xem số dư mới nhất.');
      }
    } catch (err) {
      // The previous version caught this and fell through to a "simulated
      // escrow" success, so a booking that never happened still showed the
      // confirmation modal. Failures are now surfaced instead.
      showToast('Lỗi: ' + (err instanceof Error ? err.message : 'Không thể hoàn tất đặt lớp.'));
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
      // Real top-up: create the intent, then let the SePay IPN settle it. The
      // previous version added 100 credits to local state and reported success
      // without contacting the API at all.
      const res = await callApi('/wallet/top-ups', {
        method: 'POST',
        body: JSON.stringify({ amountVnd: 100_000 }),
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

      <main className="w-full flex-1">
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
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700"
              >
                Về trang khám phá lớp
              </a>
            )}
          </div>
        ) : (
          <>
        {/* Dynamic Notification Banner / Top Flow Signal */}
        <div className="w-full bg-emerald-50 border-b border-emerald-100 px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold text-emerald-800">
                Bảo vệ Ký quỹ Escrow
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">verified_user</span>
              <span>Khoản thanh toán được giữ trong ví ký quỹ đến khi buổi học hoàn tất</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-4">
            <ol className="flex items-center flex-wrap gap-2 text-xs text-slate-500">
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
                Xác nhận đặt lớp &amp; Ký quỹ
              </li>
            </ol>
          </nav>

          {/* Page Header & Process Steps Tracker */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <p className="text-[11px] text-emerald-700 uppercase tracking-wider font-semibold mb-1">
                Quy trình Đặt chỗ &amp; Giao dịch An toàn
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Xác nhận Đặt lớp &amp; Thanh toán Ký quỹ
              </h1>
            </div>
            <div className="flex items-center gap-2 self-start md:self-auto bg-white border border-slate-200 px-3.5 py-1.5 rounded-full shadow-sm text-xs">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[11px]">
                1
              </span>
              <span className="font-semibold text-emerald-700">Xem xét &amp; Khóa ký quỹ</span>
              <span className="text-slate-300">—</span>
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-semibold text-[11px]">
                2
              </span>
              <span className="text-slate-500 font-medium">Vào phòng Jitsi</span>
            </div>
          </div>

          {/* Main Content Layout (65% / 35%) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-6">
            {/* Cột trái (8 cols): Thông tin đặt chỗ, giảng viên, Escrow & Cam kết */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* Card 1: Thẻ tóm tắt lớp học */}
              <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100">
                      {display.skillBadge}
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-emerald-600">lock_clock</span>
                      Bảo vệ Escrow (BR-021)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Định danh buổi:</span>
                    <span className="font-mono text-xs text-slate-800 font-semibold">#SEC-{id.slice(-4).toUpperCase()}</span>
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
                          <span className="text-[11px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">
                            {display.skillBadge}
                          </span>
                        )}
                      </div>
                      {display.schoolName !== null && (
                        <p className="text-xs text-slate-600">
                          {display.schoolName}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
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
                    className="px-3.5 py-1.5 rounded-lg bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors border border-slate-200 shadow-sm self-stretch sm:self-auto text-center"
                  >
                    Xem chi tiết lớp
                  </a>
                </div>

                {/* Chi tiết lịch & Định dạng phòng */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3.5 flex items-start gap-3 border border-slate-100">
                    <div className="p-2 rounded-lg bg-white text-emerald-600 shadow-sm border border-slate-100">
                      <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Thời gian học</span>
                      <span className="text-sm font-semibold text-slate-900">{display.timeFormatted}</span>
                      <span className="text-[11px] text-slate-500 block">{display.dateFormatted}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3.5 flex items-start gap-3 border border-slate-100">
                    <div className="p-2 rounded-lg bg-white text-emerald-600 shadow-sm border border-slate-100">
                      <span className="material-symbols-outlined text-[20px]">videocam</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Hình thức học</span>
                      <span className="text-sm font-semibold text-slate-900">Jitsi Meet Nội bộ</span>
                      <span className="text-[11px] text-emerald-700 font-semibold block">Mã hóa phòng E2E</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3.5 flex items-start gap-3 sm:col-span-2 md:col-span-1 border border-slate-100">
                    <div className="p-2 rounded-lg bg-white text-emerald-600 shadow-sm border border-slate-100">
                      <span className="material-symbols-outlined text-[20px]">groups</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Quy mô lớp</span>
                      <span className="text-sm font-semibold text-slate-900">{display.formatText}</span>
                      <span className="text-[11px] text-slate-500 block">Dành riêng cho bạn</span>
                    </div>
                  </div>
                </div>

                {/* Quy chuẩn thời gian BR-021 */}
                <div className="mt-4 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between gap-2 text-slate-700 text-xs">
                  <span className="flex items-center gap-1.5 text-emerald-800 font-medium">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                    Thỏa mãn quy tắc đặt chỗ trước &gt; 24 giờ (BR-021): Thời gian còn lại 38 giờ 15 phút.
                  </span>
                  <span className="font-mono text-slate-400 text-[11px]">ISO-8601-VN</span>
                </div>
              </section>

              {/* Card 2: Atomic Escrow Protection & Chính sách hủy */}
              <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">lock</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">
                      Bảo vệ Ký quỹ Escrow &amp; Quyền lợi Người học
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tuân thủ nghiêm ngặt chuẩn kỹ thuật AC-004, AC-022 &amp; BR-046
                    </p>
                  </div>
                </div>

                {/* Escrow Step Diagram Visual */}
                <div className="bg-slate-50 rounded-xl p-4 mb-5 border border-slate-100">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-center sm:text-left">
                    <div className="flex-1 bg-white p-3.5 rounded-lg shadow-sm border border-slate-100">
                      <span className="text-[11px] text-slate-400 block">Bước 1: Ngay bây giờ</span>
                      <p className="text-xs font-semibold text-emerald-700">Khóa 100 Credits trong Ví Ký quỹ</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Tiền chưa chuyển cho Mentor</p>
                    </div>
                    <div className="hidden sm:flex items-center justify-center text-slate-300">
                      <span className="material-symbols-outlined text-[20px]">trending_flat</span>
                    </div>
                    <div className="flex-1 bg-white p-3.5 rounded-lg shadow-sm border border-slate-100">
                      <span className="text-[11px] text-slate-400 block">Bước 2: Trong buổi học</span>
                      <p className="text-xs font-semibold text-slate-900">Giám sát Check-in 15 phút</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Tự động kích hoạt phòng học</p>
                    </div>
                    <div className="hidden sm:flex items-center justify-center text-slate-300">
                      <span className="material-symbols-outlined text-[20px]">trending_flat</span>
                    </div>
                    <div className="flex-1 bg-white p-3.5 rounded-lg shadow-sm border border-slate-100">
                      <span className="text-[11px] text-slate-400 block">Bước 3: Sau kết thúc</span>
                      <p className="text-xs font-semibold text-emerald-700">Giải ngân an toàn cho Mentor</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Sau khi học viên xác nhận</p>
                    </div>
                  </div>
                </div>

                {/* Feature Clauses Grid */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="material-symbols-outlined text-[20px] text-emerald-600 mt-0.5">
                      account_balance_wallet
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Cơ chế Ký quỹ Nguyên tử (Atomic Escrow Protection)
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Học phí được tạm giữ an toàn trong ví Escrow trung lập và{' '}
                        <span className="font-semibold text-slate-800">chỉ được giải ngân</span> cho Mentor sau khi buổi học hoàn tất và bạn bấm xác nhận hài lòng hoặc qua 24h không có khiếu nại.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="material-symbols-outlined text-[20px] text-emerald-600 mt-0.5">
                      history
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Cam kết Hoàn tiền 100% tự động (AC-022, AC-024)
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Nếu Mentor hủy lịch hoặc vắng mặt trong 15 phút đầu tiên, toàn bộ{' '}
                        <span className="font-semibold text-slate-800">100% Credits</span> sẽ được hệ thống Ledger tự động giải phóng và hoàn trả lại số dư khả dụng của bạn ngay lập tức.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="material-symbols-outlined text-[20px] text-slate-500 mt-0.5">
                      info
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900">Chính sách MVP về Hủy đặt chỗ (BR-046)</h4>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-semibold">
                          Quy định MVP
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Nhằm bảo vệ thời gian chuẩn bị giáo trình của Mentor,{' '}
                        <span className="font-semibold text-slate-800">MVP hiện không áp dụng tính năng tự hủy booking từ phía học viên sau khi đã xác nhận</span>. Xin vui lòng sắp xếp thời gian chắc chắn trước khi bấm hoàn tất.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Card 3: Cam kết văn hóa học tập */}
              <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[22px] text-emerald-600">diversity_3</span>
                    <h3 className="font-bold text-base text-slate-900">
                      Cam kết Văn hóa Học thuật Sinh viên SkillSwap
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">Bộ quy tắc sinh viên 2025</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <span className="material-symbols-outlined text-[22px] text-emerald-600 mb-1">timer</span>
                    <p className="text-xs font-semibold text-slate-900">Đúng giờ chuẩn mực</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Vào phòng Jitsi trước 3-5 phút kiểm tra mic</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <span className="material-symbols-outlined text-[22px] text-indigo-600 mb-1">psychology</span>
                    <p className="text-xs font-semibold text-slate-900">Tôn trọng tri thức</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Chuẩn bị sẵn bài luyện nói &amp; thắc mắc</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <span className="material-symbols-outlined text-[22px] text-amber-600 mb-1">handshake</span>
                    <p className="text-xs font-semibold text-slate-900">Đánh giá trung thực</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Để lại feedback chân thực giúp xây dựng cộng đồng</p>
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
                  <span className="text-xs text-slate-700 leading-relaxed">
                    Tôi xác nhận đã đọc, hiểu rõ chính sách Escrow giữ chỗ và cam kết tham gia lớp học đúng giờ, tôn trọng giảng viên ThS. Lan Anh.
                  </span>
                </label>
              </section>
            </div>

            {/* Cột phải (4 cols, sticky): Financial Ledger, Balance & CTA */}
            <div className="lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-20">
              {/* Card Ledger Tài chính */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-base text-slate-900">Chi tiết Bút toán Ký quỹ</h3>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[11px] border border-emerald-100">
                    Ledger v2
                  </span>
                </div>

                {/* Academic Ledger Distribution Bar */}
                <div className="mb-5">
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                    <span>
                      Phân bổ số dư: <span className="text-slate-900 font-semibold">{display.priceCredits} / {display.currentCredits} Credits</span>
                    </span>
                    <span className="text-emerald-700 font-semibold">{display.lockedPercentage.toFixed(1)}% Khóa</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex border border-slate-200">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                      style={{ width: `${display.lockedPercentage}%` }}
                    ></div>
                    <div
                      className="h-full bg-slate-200 rounded-full"
                      style={{ width: `${Math.max(0, 100 - display.lockedPercentage)}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                    <span>{display.priceCredits} Credits (Ký quỹ khóa)</span>
                    <span>{display.remainingCredits} Credits (Khả dụng còn lại)</span>
                  </div>
                </div>

                {/* Chi tiết bảng giá */}
                <div className="space-y-3 pb-5 border-b border-slate-100 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Học phí buổi học ({display.durationMin} phút)</span>
                    <span className="font-mono font-semibold text-slate-900">{display.priceCredits} Credits</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 -mt-1 pl-2">
                    <span>Tương đương quy đổi</span>
                    <span className="font-mono">{(display.priceCredits * 1000).toLocaleString('vi-VN')} VNĐ</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600">Phí nền tảng SkillSwap</span>
                      <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                        Miễn phí
                      </span>
                    </div>
                    <span className="font-mono font-semibold text-emerald-700">0 Credits</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pl-2 -mt-1">
                    <span>Hỗ trợ sinh viên 2025</span>
                    <span className="line-through">15 Credits</span>
                  </div>
                  <div className="h-px bg-slate-100 my-2"></div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-semibold text-slate-900">Tổng thanh toán ký quỹ</span>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-emerald-700 font-mono leading-none">{display.priceCredits}</span>
                      <span className="text-xs font-semibold text-emerald-700 ml-1">Credits</span>
                    </div>
                  </div>
                </div>

                {/* Trạng thái ví hiện tại */}
                <div className="bg-slate-50 rounded-xl p-4 my-5 space-y-2.5 border border-slate-100 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Số dư khả dụng hiện tại:</span>
                    <span className="font-mono font-semibold text-slate-900">{display.currentCredits} Credits</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Số dư sau khi khóa Escrow:</span>
                    <span className="font-mono font-semibold text-emerald-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">check_circle</span>
                      {display.remainingCredits} Credits
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200 text-emerald-800 text-[11px] flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    Ví đủ điều kiện thanh toán ngay không cần nạp bổ sung.
                  </div>
                </div>

                {/* Primary Confirmation Button */}
                <button
                  type="button"
                  disabled={isProcessing || bookingConfirmed}
                  onClick={handleConfirmBooking}
                  className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 group cursor-pointer ${
                    bookingConfirmed
                      ? 'bg-emerald-600 text-white cursor-default'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.99]'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                      <span>Đang khóa bút toán Escrow...</span>
                    </>
                  ) : bookingConfirmed ? (
                    <>
                      <span className="material-symbols-outlined text-[20px]">check_circle</span>
                      <span>Đã đặt chỗ &amp; Khóa Escrow thành công</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px] group-hover:rotate-12 transition-transform">
                        lock
                      </span>
                      <span>Xác nhận Đặt lớp &amp; Khóa Escrow ({display.priceCredits} Credits)</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-slate-500 text-center mt-3">
                  Bằng việc bấm xác nhận, {display.priceCredits} Credits sẽ được giữ trong ví Escrow trung lập.
                </p>

                {/* Security Badges Footer */}
                <div className="mt-5 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2.5 text-[11px] text-slate-600">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600 mt-0.5">verified</span>
                  <div>
                    <span className="font-semibold text-slate-800">Bút toán nguyên tử (Atomic LedgerPosting):</span>{' '}
                    Giao dịch ghi nhận trạng thái đồng bộ hai chiều, ngăn chặn hoàn toàn rủi ro trừ kép số dư.
                  </div>
                </div>
              </div>

              {/* Không đủ số dư → nạp qua cổng thanh toán SePay */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-emerald-600">add_card</span>
                    <h4 className="text-xs font-bold text-slate-900">Trường hợp số dư không đủ?</h4>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                    SePay
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Nạp thêm Credit qua <strong className="text-slate-900">cổng thanh toán SePay</strong> ngay tại đây mà <strong className="text-slate-900">không làm mất lựa chọn lớp hay phiên đặt trước</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => setIsTopUpModalOpen(true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">add_circle</span>
                  Nạp thêm Credit
                </button>
              </div>

              {/* Trợ giúp & Khiếu nại 24/7 */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 text-xs text-slate-600 shadow-sm">
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl text-center border border-slate-200">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            </div>
            {bookingId !== null && (
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-mono font-semibold">
                Mã giữ chỗ: {bookingId}
              </span>
            )}
            <h3 className="text-xl font-bold text-slate-900 mt-3 mb-2">Đặt lớp &amp; Ký quỹ Thành công!</h3>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Hệ thống đã khóa <strong className="text-slate-900 font-semibold">{display.priceCredits} Credits</strong> vào ví Escrow bảo chứng. Bạn có thể vào phòng học trực tuyến ngay khi mở cửa lớp học.
            </p>
            <div className="bg-slate-50 rounded-xl p-3.5 text-left text-xs space-y-2 mb-6 border border-slate-100">
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
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors text-center flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">videocam</span>
                  Vào phòng học ngay
                </a>
              )}
              <a
                href={`/${locale}/bookings`}
                className="py-2.5 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors text-center"
              >
                Lịch học của tôi
              </a>
              <button
                type="button"
                onClick={() => setIsSuccessModalOpen(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP-UP MODAL — real SePay hosted checkout (ADR-033) */}
      {isTopUpModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl text-center border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-emerald-600">credit_card</span>
                <h3 className="text-base font-bold text-slate-900">Nạp 100.000 VNĐ qua SePay</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTopUpModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <p className="text-xs text-slate-600 text-left my-3 leading-relaxed">
              Bạn sẽ được chuyển sang <strong>trang thanh toán của SePay</strong> trong một tab mới để
              chọn phương thức thanh toán và hoàn tất giao dịch. Số dư được cộng ngay khi SePay xác
              nhận, không cần quét mã thủ công.
            </p>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-left space-y-2 mb-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Số tiền nạp:</span>
                <span className="font-bold text-emerald-700">100.000 VNĐ</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Quy đổi:</span>
                <span className="font-bold text-slate-900">100 Credit</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Cổng thanh toán:</span>
                <span className="font-medium text-slate-900">SePay Payment Gateway</span>
              </div>
            </div>
            {topUpSettled && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-left text-[11px] text-emerald-800 mb-4">
                <span className="font-semibold block mb-0.5">Đã cộng vào ví.</span>
                Số dư đã được cập nhật. Giờ bạn có thể tiếp tục xác nhận đặt lớp.
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleConfirmTopUp()}
              disabled={isProcessing}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold transition-all shadow-sm"
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
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium border border-slate-800 animate-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-[18px] text-emerald-400">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full bg-white border-t border-slate-200 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500 text-center sm:text-left">
            © 2025 SkillSwap Vietnam. Nền tảng học hỏi kỹ năng ngang hàng sinh viên.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
            <a className="hover:text-emerald-700 transition-colors" href="#">Trợ giúp</a>
            <span>•</span>
            <a className="hover:text-emerald-700 transition-colors" href="#">Quy định &amp; Chính sách</a>
            <span>•</span>
            <a className="hover:text-emerald-700 transition-colors" href="#">Bảo mật Escrow</a>
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
  const remainingCredits = Math.max(0, currentCredits - priceCredits);
  const lockedPercentage =
    currentCredits > 0 ? Math.min(100, (priceCredits / currentCredits) * 100) : 100;

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
    remainingCredits,
    lockedPercentage,
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
    formatText:
      classDetail.format === 'one-on-one'
        ? '1-on-1 Cá nhân'
        : classDetail.capacity > 1
          ? `Nhóm nhỏ (${classDetail.capacity} học viên)`
          : '1-on-1 Cá nhân',
  };
}
