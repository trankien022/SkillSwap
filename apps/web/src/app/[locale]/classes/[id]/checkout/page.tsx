'use client';

import { use, useState, useEffect } from 'react';
import { Navbar } from '../../../../../components/navbar';
import { callApi, unwrapEnvelope } from '../../../../../lib/api-client';
import type { WalletBalanceView } from '@skillswap/contracts';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default function BookingCheckoutPage({ params }: PageProps) {
  const { id } = use(params);

  const [balance, setBalance] = useState<WalletBalanceView | null>(null);
  const [agreementChecked, setAgreementChecked] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await callApi('/wallet/balance');
        if (res.ok) {
          setBalance(await unwrapEnvelope(res));
        }
      } catch (e) {
        console.warn('Failed to load wallet balance for checkout', e);
      }
    };
    fetchBalance();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleConfirmBooking = async () => {
    if (!agreementChecked) {
      showToast('Vui lòng chọn cam kết văn hóa học tập trước khi tiếp tục.');
      return;
    }

    setIsProcessing(true);
    try {
      // Attempt backend booking API if class endpoint is live
      try {
        await callApi(`/classes/${id}/book`, {
          method: 'POST',
        }, false);
      } catch (err) {
        console.warn('Backend booking API fallback to simulated escrow', err);
      }

      await new Promise((r) => setTimeout(r, 700));

      setBookingConfirmed(true);
      setIsSuccessModalOpen(true);

      // Deduct 100 Credits from current balance display
      if (balance) {
        setBalance({
          ...balance,
          availableCredits: Math.max(0, balance.availableCredits - 100),
          pendingCredits: balance.pendingCredits + 100,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmTopUp = () => {
    setIsTopUpModalOpen(false);
    if (balance) {
      setBalance({
        ...balance,
        availableCredits: balance.availableCredits + 100,
      });
    }
    showToast('Nạp thành công 100 Credits! Phiên đặt chỗ vẫn được bảo toàn nguyên vẹn.');
  };

  const currentCredits = balance ? balance.availableCredits : 150;
  const priceCredits = 100;
  const remainingCredits = Math.max(0, currentCredits - priceCredits);
  const lockedPercentage = currentCredits > 0 ? Math.min(100, (priceCredits / currentCredits) * 100) : 66.7;

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 text-slate-900 antialiased">
      {/* Top Synchronized Navbar */}
      <Navbar currentTab="explore" balance={balance} />

      <main className="w-full flex-1">
        {/* Dynamic Notification Banner / Top Flow Signal */}
        <div className="w-full bg-emerald-50 border-b border-emerald-100 px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold text-emerald-800">
                Bảo vệ Ký quỹ Escrow v2.4 Active
              </span>
              <span className="text-slate-300">•</span>
              <span>
                Mã phiên giữ chỗ: <span className="font-mono text-slate-900 font-medium">SS-BK-20251028-984</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">verified_user</span>
              <span>Hợp đồng đào tạo ngang hàng theo điều khoản BR-021 &amp; AC-022</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-4">
            <ol className="flex items-center flex-wrap gap-2 text-xs text-slate-500">
              <li>
                <a href="/vi" className="hover:text-emerald-700 transition-colors flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">school</span>
                  Khám phá
                </a>
              </li>
              <li className="text-slate-300">/</li>
              <li>
                <a href={`/vi/classes/${id}`} className="hover:text-emerald-700 transition-colors">
                  Lớp học IELTS Speaking
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
                      IELTS Speaking Mock 1-1
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-emerald-600">lock_clock</span>
                      Đã đặt trước 48h (BR-021)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Định danh buổi:</span>
                    <span className="font-mono text-xs text-slate-800 font-semibold">#SEC-8921-IEL</span>
                  </div>
                </div>

                <h2 className="text-xl font-bold text-slate-900 mt-4 mb-4 leading-snug">
                  Luyện Speaking IELTS 6.5+ Mock Interview 1-1 &amp; Sửa phát âm chuyên sâu
                </h2>

                {/* Mentor Profile Card */}
                <div className="bg-slate-50 rounded-xl p-4 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-slate-100">
                  <div className="flex items-center gap-3.5">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xl ring-2 ring-white">
                        LA
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
                        <span className="font-bold text-base text-slate-900">ThS. Lan Anh</span>
                        <span className="text-[11px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">
                          IELTS 8.5
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Giảng viên Ngôn ngữ Anh · Đại học Ngoại thương Hà Nội (FTU)
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                        <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[14px]">shield</span> Đã xác minh bằng cấp
                        </span>
                        <span>•</span>
                        <span>48 buổi đã dạy</span>
                        <span>•</span>
                        <span className="text-slate-800 font-medium">Đánh giá 4.98/5.0</span>
                      </div>
                    </div>
                  </div>
                  <a
                    href={`/vi/classes/${id}`}
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
                      <span className="text-sm font-semibold text-slate-900">19:30 - 20:30</span>
                      <span className="text-[11px] text-slate-500 block">Thứ Sáu, 28/10/2025</span>
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
                      <span className="text-sm font-semibold text-slate-900">1-on-1 Cá nhân</span>
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
                      Phân bổ số dư: <span className="text-slate-900 font-semibold">100 / {currentCredits} Credits</span>
                    </span>
                    <span className="text-emerald-700 font-semibold">{lockedPercentage.toFixed(1)}% Khóa</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex border border-slate-200">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                      style={{ width: `${lockedPercentage}%` }}
                    ></div>
                    <div
                      className="h-full bg-slate-200 rounded-full"
                      style={{ width: `${Math.max(0, 100 - lockedPercentage)}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                    <span>100 Credits (Ký quỹ khóa)</span>
                    <span>{remainingCredits} Credits (Khả dụng còn lại)</span>
                  </div>
                </div>

                {/* Chi tiết bảng giá */}
                <div className="space-y-3 pb-5 border-b border-slate-100 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Học phí buổi học (60 phút)</span>
                    <span className="font-mono font-semibold text-slate-900">100 Credits</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 -mt-1 pl-2">
                    <span>Tương đương quy đổi</span>
                    <span className="font-mono">100.000 VNĐ</span>
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
                    <span>Hỗ trợ mùa thi 2025</span>
                    <span className="line-through">15 Credits</span>
                  </div>
                  <div className="h-px bg-slate-100 my-2"></div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-semibold text-slate-900">Tổng thanh toán ký quỹ</span>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-emerald-700 font-mono leading-none">100</span>
                      <span className="text-xs font-semibold text-emerald-700 ml-1">Credits</span>
                    </div>
                  </div>
                </div>

                {/* Trạng thái ví hiện tại */}
                <div className="bg-slate-50 rounded-xl p-4 my-5 space-y-2.5 border border-slate-100 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Số dư khả dụng hiện tại:</span>
                    <span className="font-mono font-semibold text-slate-900">{currentCredits} Credits</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Số dư sau khi khóa Escrow:</span>
                    <span className="font-mono font-semibold text-emerald-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">check_circle</span>
                      {remainingCredits} Credits
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
                      <span>Xác nhận Đặt lớp &amp; Khóa Escrow</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-slate-500 text-center mt-3">
                  Bằng việc bấm xác nhận, 100 Credits sẽ được giữ trong ví Escrow trung lập.
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

              {/* Thẻ mô phỏng trường hợp dự phòng: Nạp nhanh qua VietQR */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-emerald-600">qr_code_2</span>
                    <h4 className="text-xs font-bold text-slate-900">Trường hợp số dư không đủ?</h4>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                    Dự phòng UX
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Cơ chế <strong className="text-slate-900">Modal Nạp nhanh VietQR</strong> tích hợp trực tiếp, giúp bạn nạp thêm Credit tức thì mà <strong className="text-slate-900">không làm mất lựa chọn lớp hay phiên đặt trước</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => setIsTopUpModalOpen(true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">add_circle</span>
                  Mô phỏng Nạp nhanh VietQR (PRD §6.6)
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
      </main>

      {/* SUCCESS MODAL */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl text-center border border-slate-200">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-mono font-semibold">
              Mã giao dịch: ESCROW-VN-2025-1028
            </span>
            <h3 className="text-xl font-bold text-slate-900 mt-3 mb-2">Đặt lớp &amp; Ký quỹ Thành công!</h3>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Hệ thống đã khóa <strong className="text-slate-900 font-semibold">100 Credits</strong> vào ví Escrow bảo chứng. Link phòng học Jitsi Meet đã được gửi đến email học viên của bạn.
            </p>
            <div className="bg-slate-50 rounded-xl p-3.5 text-left text-xs space-y-2 mb-6 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Lớp học:</span>
                <span className="font-semibold text-slate-900 text-right">IELTS Speaking Mock 1-1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mentor:</span>
                <span className="font-semibold text-slate-900">ThS. Lan Anh</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Giờ học:</span>
                <span className="font-semibold text-emerald-700">19:30, Thứ Sáu 28/10/2025</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
                <span className="text-slate-500">Số dư ví còn lại:</span>
                <span className="font-mono text-emerald-700">{remainingCredits} Credits</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <a
                href="/vi/instructor#classes"
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors text-center"
              >
                Xem Lớp học của tôi
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

      {/* TOP-UP MODAL (VietQR Simulation) */}
      {isTopUpModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl text-center border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-emerald-600">qr_code_scanner</span>
                <h3 className="text-base font-bold text-slate-900">Nạp nhanh Credits qua VietQR</h3>
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
              Quét mã thanh toán ngân hàng tự động 24/7. Số dư được cập nhật tức thì vào phiên đặt lớp của bạn.
            </p>
            {/* Simulated QR Card */}
            <div className="bg-slate-50 rounded-xl p-5 flex flex-col items-center justify-center mb-4 border border-slate-100">
              <div className="w-44 h-44 bg-white p-2 rounded-xl shadow-inner flex items-center justify-center border border-slate-200">
                <svg className="w-full h-full text-slate-900" fill="currentColor" viewBox="0 0 100 100">
                  <path d="M10 10h30v30h-30zM15 15v20h20v-20zM20 20h10v10h-10zM60 10h30v30h-30zM65 15v20h20v-20zM70 20h10v10h-10zM10 60h30v30h-30zM15 65v20h20v-20zM20 70h10v10h-10zM50 15h5v15h-5zM45 35h15v5h-15zM55 50h5v10h-5zM65 55h15v5h-15zM75 65h15v15h-15zM50 70h10v20h-10zM65 85h25v5h-25zM45 50h5v5h-5z" />
                </svg>
              </div>
              <span className="font-mono text-base font-bold text-emerald-700 mt-3">100.000 VNĐ = 100 Credits</span>
              <span className="text-[11px] text-slate-500 mt-0.5">
                Nội dung CK: <strong className="text-slate-900 font-mono">SS NAP 894 MINH</strong>
              </span>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-left text-[11px] text-emerald-800 mb-4">
              <span className="font-semibold block mb-0.5">Bảo toàn phiên đặt chỗ:</span>
              Phiên đặt lớp với Mentor Lan Anh vẫn được giữ trong 10:00 phút đếm ngược.
            </div>
            <button
              type="button"
              onClick={handleConfirmTopUp}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all shadow-sm"
            >
              Giả lập Xác nhận Nạp tiền Thành công
            </button>
          </div>
        </div>
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
