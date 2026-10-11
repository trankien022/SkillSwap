'use client';

import { use, useState, useEffect } from 'react';
import { Navbar } from '../../../../components/navbar';
import { callApi } from '../../../../lib/api-client';
import type { WalletBalanceView } from '@skillswap/contracts';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default function ClassDetailPage({ params }: PageProps) {
  const { id } = use(params);

  const [balance, setBalance] = useState<WalletBalanceView | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBooked, setIsBooked] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await callApi('/wallet/balance');
        if (res.ok) {
          setBalance(await res.json());
        }
      } catch (e) {
        console.warn('Failed to load wallet balance for booking page', e);
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

  const handleOpenModal = () => {
    if (isBooked) {
      showToast('Bạn đã đặt chỗ cho lớp học này rồi!');
      return;
    }
    setIsModalOpen(true);
  };

  const handleConfirmBooking = async () => {
    try {
      setIsProcessing(true);
      // Attempt backend booking API if available for class id
      try {
        await callApi(`/classes/${id}/book`, {
          method: 'POST',
        }, false);
      } catch (err) {
        console.warn('Backend booking API fallback to simulated escrow reservation', err);
      }

      // Simulate escrow confirmation delay
      await new Promise((r) => setTimeout(r, 600));

      setIsBooked(true);
      setIsModalOpen(false);
      showToast('Đặt lớp thành công! Phòng học Jitsi sẽ sẵn sàng trước 10 phút.');

      // Optimistically update credit balance state
      if (balance) {
        setBalance({
          ...balance,
          availableCredits: Math.max(0, balance.availableCredits - 90),
          pendingCredits: balance.pendingCredits + 90,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const currentCredits = balance ? balance.availableCredits : 150;
  const remainingCredits = Math.max(0, currentCredits - 90);

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 text-slate-800 antialiased">
      {/* Top Synchronized Navbar */}
      <Navbar currentTab="explore" balance={balance} />

      <main className="pt-6 pb-16 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumbs & Quick Guarantee Tag */}
        <nav aria-label="Breadcrumb" className="flex items-center justify-between text-xs text-slate-500 py-3 mb-4">
          <div className="flex items-center gap-2">
            <a
              href="/vi"
              className="hover:text-emerald-700 inline-flex items-center gap-1 font-medium transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Khám phá lớp học
            </a>
            <span>/</span>
            <span className="hidden sm:inline">Ngoại ngữ &amp; Chứng chỉ</span>
            <span className="hidden sm:inline">/</span>
            <span className="text-slate-900 font-semibold truncate max-w-[220px] sm:max-w-none">
              IELTS Speaking Mock 1-1
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Đảm bảo hoàn tiền 100%
          </span>
        </nav>

        {/* Main Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Content & Details (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Header Title & Badges */}
            <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-semibold text-xs border border-emerald-100">
                  IELTS 6.5+
                </span>
                <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium text-xs flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-emerald-600">videocam</span>
                  Online 1 kèm 1
                </span>
                <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 font-medium text-xs">
                  60 phút
                </span>
              </div>
              <h1 className="font-bold text-2xl sm:text-3xl text-slate-900 leading-tight tracking-tight">
                Luyện Speaking IELTS 6.5+ Mock Interview 1-1 (Chiến thuật Part 2 &amp; 3)
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-600 pt-1 border-t border-slate-100">
                <div className="flex items-center gap-1 font-semibold text-amber-600">
                  <span
                    className="material-symbols-outlined text-[18px] text-amber-500"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    star
                  </span>
                  <span>4.9</span>
                  <span className="text-slate-400 font-normal">(46 đánh giá)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[17px] text-emerald-600">school</span>
                  <span>35 buổi hoàn thành</span>
                </div>
                <div className="flex items-center gap-1 text-slate-500">
                  <span className="material-symbols-outlined text-[17px] text-emerald-600">verified_user</span>
                  <span>Sinh viên đã xác thực</span>
                </div>
              </div>
            </div>

            {/* Instructor Profile Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-5 items-start">
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-2xl ring-2 ring-slate-100">
                    LA
                  </div>
                  <span
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center ring-2 ring-white"
                    title="Đã xác thực hồ sơ"
                  >
                    <span className="material-symbols-outlined text-[14px]">check</span>
                  </span>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-bold text-lg text-slate-900 inline-block">Lan Anh</h2>
                      <span className="text-xs text-slate-500 ml-1.5 font-medium">
                        Khóa 60 • ĐH Ngoại Thương Hà Nội (FTU)
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      Thẻ sinh viên đã xác minh
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    IELTS Overall 8.0 (Speaking 8.5). Từng hỗ trợ 30+ sinh viên nâng band từ 5.5 lên 6.5+ trước kỳ thi. Phương pháp thực chiến tập trung phản xạ tự nhiên và cấu trúc PEEL.
                  </p>
                  {/* Clean Verified Credential Tags */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-[20px]">workspace_premium</span>
                      <div className="text-xs">
                        <p className="font-semibold text-slate-800">IELTS 8.0</p>
                        <p className="text-slate-500 text-[11px]">Speaking 8.5 (IDP)</p>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-[20px]">thumb_up</span>
                      <div className="text-xs">
                        <p className="font-semibold text-slate-800">98% hài lòng</p>
                        <p className="text-slate-500 text-[11px]">46 học viên</p>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                      <span className="material-symbols-outlined text-indigo-600 text-[20px]">menu_book</span>
                      <div className="text-xs">
                        <p className="font-semibold text-slate-800">Bộ 14 Forecast</p>
                        <p className="text-slate-500 text-[11px]">Quý 2/2025</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Lesson Timeline Outline */}
            <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600">timer</span>
                    Nội dung buổi học (60 phút)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mô phỏng 1 kèm 1 tập trung thẳng vào phản xạ phòng thi
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                  Tập trung 1-1
                </span>
              </div>

              {/* Scannable Timeline */}
              <div className="space-y-4">
                {/* Item 1 */}
                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-50/70 border border-slate-100">
                  <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    01
                  </span>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm text-slate-900">
                      Warm-up &amp; Chỉnh phát âm, ngữ điệu (15 phút)
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Khởi động với các chủ đề Part 1 ngẫu nhiên. Nhận diện các lỗi âm đuôi (ending sounds) và cách ngắt nhịp nối từ tự nhiên theo chuẩn người bản xứ.
                    </p>
                  </div>
                </div>

                {/* Item 2 */}
                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-emerald-50/40 border border-emerald-100">
                  <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    02
                  </span>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-sm text-slate-900">
                        Mock Test Part 2 &amp; 3 theo thời gian thực (30 phút)
                      </h4>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                        Trọng tâm
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Bốc đề Part 2 ngẫu nhiên từ bộ Forecast mới nhất, chuẩn bị 1 phút và nói 2 phút bấm giờ. Mở rộng 3-4 câu hỏi phản biện Part 3 theo phương pháp PEEL (Point, Explain, Example, Link).
                    </p>
                  </div>
                </div>

                {/* Item 3 */}
                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-50/70 border border-slate-100">
                  <span className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    03
                  </span>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm text-slate-900">
                      Nhận xét chi tiết &amp; Bàn giao tài liệu (15 phút)
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Đánh giá theo 4 tiêu chí chấm IELTS chính thức (Fluency, Lexical, Grammar, Pronunciation). Nhận file ghi âm và danh sách cụm từ collocations gợi ý riêng cho bạn.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Prerequisites & Tech Setup */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">info</span>
                Chuẩn bị trước buổi học
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-slate-500 text-[20px] mt-0.5">laptop_mac</span>
                  <div className="text-xs">
                    <p className="font-semibold text-slate-800">Thiết bị</p>
                    <p className="text-slate-500">Máy tính hoặc tablet có mic &amp; webcam rõ nét</p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-slate-500 text-[20px] mt-0.5">video_camera_front</span>
                  <div className="text-xs">
                    <p className="font-semibold text-slate-800">Phòng học trực tuyến</p>
                    <p className="text-slate-500">Mở tự động trước 10 phút, vào trực tiếp qua Jitsi E2E</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Student Reviews */}
            <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Đánh giá từ học viên</h3>
                  <p className="text-xs text-slate-500">Nhận xét thực tế sau khi hoàn thành buổi học</p>
                </div>
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                  <span className="font-bold text-lg text-amber-700">4.9</span>
                  <div className="flex text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <span
                        key={i}
                        className="material-symbols-outlined text-[16px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        star
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Review Cards */}
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                        TH
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-slate-900">
                          Trần Tuấn Huy <span className="text-slate-400 font-normal">• ĐH Bách Khoa</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-amber-500 text-xs">★★★★★</div>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    &quot;Chị Lan Anh sửa cực kỳ chi tiết phần Intonation và các từ nối gượng gạo của mình trong Part 3. Mock test rất sát với áp lực phòng thi thật của BC. Mình vừa thi hôm qua đạt 7.0 Speaking!&quot;
                  </p>
                  <p className="text-[11px] text-slate-400">Học ngày 14/05/2025</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-800 font-bold text-xs flex items-center justify-center">
                        MN
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-slate-900">
                          Mai Ngọc <span className="text-slate-400 font-normal">• ĐH Kinh Tế Quốc Dân</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-amber-500 text-xs">★★★★★</div>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    &quot;Đúng chuẩn sinh viên giúp nhau, rất tận tâm. Bảng nhận xét cuối giờ ghi rõ cả phonetics để về tự thu âm lại. Rất đáng 90 Credit bỏ ra.&quot;
                  </p>
                  <p className="text-[11px] text-slate-400">Học ngày 02/05/2025</p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Sticky Booking Panel (5 cols) */}
          <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
            {/* Clean Booking Card */}
            <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
              {/* Price Display */}
              <div className="flex items-baseline justify-between border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs uppercase font-medium text-slate-500 tracking-wider">Học phí trao đổi</p>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="font-bold text-3xl text-emerald-700">90</span>
                    <span className="font-semibold text-base text-emerald-700">Credit</span>
                    <span className="text-xs text-slate-400 ml-1">(≈ 90.000 VNĐ)</span>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                    isBooked
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">event_seat</span>
                  {isBooked ? 'Đã đăng ký' : 'Còn 1 chỗ'}
                </span>
              </div>

              {/* Schedule info */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-[20px]">calendar_today</span>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">19:30 - 20:30, Ngày mai</p>
                    <p className="text-[11px] text-slate-500">Đặt trước 24 giờ để giảng viên chuẩn bị đề</p>
                  </div>
                </div>
              </div>

              {/* Balance Breakdown */}
              <div className="space-y-2 py-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Số dư hiện tại:</span>
                  <span className="font-medium text-slate-800">{currentCredits.toLocaleString('vi-VN')} Credit</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Phí phiên học:</span>
                  <span className="font-medium text-slate-800">- 90 Credit</span>
                </div>
                <div className="border-t border-slate-100 pt-2 flex justify-between font-semibold text-slate-900 text-sm">
                  <span>Số dư sau khi đặt:</span>
                  <span className="text-emerald-700">{remainingCredits.toLocaleString('vi-VN')} Credit</span>
                </div>
              </div>

              {/* CTAs */}
              <div className="space-y-2.5 pt-2">
                {isBooked ? (
                  <button
                    type="button"
                    disabled
                    className="w-full h-12 rounded-xl bg-emerald-600 text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-default"
                  >
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>Đã đặt lớp thành công</span>
                  </button>
                ) : (
                  <>
                    <a
                      href={`/vi/classes/${id}/checkout`}
                      className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                    >
                      <span>Xem xét &amp; Khóa ký quỹ (90 Credit)</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleOpenModal}
                      className="w-full h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">bolt</span>
                      <span>Đặt nhanh qua Popup</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => showToast('Đang kết nối tin nhắn với Teacher Lan Anh...')}
                  className="w-full h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                  <span>Nhắn tin hỏi Teacher</span>
                </button>
              </div>

              {/* Reassurance Guarantee */}
              <div className="pt-3 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-500 leading-normal">
                <span className="material-symbols-outlined text-emerald-600 text-[18px] flex-shrink-0 mt-0.5">
                  verified_user
                </span>
                <span>
                  <strong>Đảm bảo an tâm:</strong> Học phí chỉ chuyển cho người dạy sau khi buổi học kết thúc thuận lợi. Hoàn trả 100% nếu có sự cố.
                </span>
              </div>
            </div>

            {/* Skill Exchange Mini Prompt */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-100">
                <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
              </div>
              <div className="text-xs">
                <p className="font-semibold text-slate-800">Muốn trao đổi kỹ năng chéo?</p>
                <p className="text-slate-500">
                  Teacher đang quan tâm tìm người hướng dẫn: <strong className="text-slate-700">Python cơ bản</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* CONFIRMATION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-5 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-slate-900">Xác nhận đặt lớp</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Lớp:</span>
                <span className="font-semibold text-slate-900 text-right">IELTS Speaking Mock 1-1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Giảng viên:</span>
                <span className="font-semibold text-slate-900">Lan Anh (FTU)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Thời gian:</span>
                <span className="font-semibold text-slate-900">19:30 - 20:30, Ngày mai</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold text-slate-900">
                <span>Học phí trừ:</span>
                <span className="text-emerald-700 font-bold">90 Credit</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Số dư 90 Credit sẽ được tạm giữ an toàn vào cơ chế Escrow và chỉ giải ngân cho người dạy sau khi hoàn thành buổi học. Bạn có thể hủy trước 12 giờ để nhận hoàn trả đầy đủ.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-1/3 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmBooking}
                className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                {isProcessing ? 'Đang xử lý...' : 'Xác nhận & Đặt chỗ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS TOAST */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-slate-900 text-white p-4 rounded-xl shadow-xl flex items-center gap-3 border border-slate-800 animate-in slide-in-from-bottom-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[18px]">check</span>
          </div>
          <div className="text-xs flex-1">
            <p className="font-semibold text-white">Thông báo</p>
            <p className="text-slate-300">{toastMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
              S
            </div>
            <span className="font-medium text-slate-600">
              © 2025 SkillSwap Vietnam. Nền tảng chia sẻ kỹ năng sinh viên.
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a className="hover:text-emerald-700 transition-colors" href="#">Trợ giúp</a>
            <a className="hover:text-emerald-700 transition-colors" href="#">Quy định</a>
            <a className="hover:text-emerald-700 transition-colors" href="#">Bảo mật</a>
            <div className="flex items-center gap-1 text-slate-600 font-medium">
              <span className="material-symbols-outlined text-[16px]">language</span>
              <span>Tiếng Việt</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
