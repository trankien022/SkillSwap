'use client';

import { useState } from 'react';

export default function InstructorDashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [skillSelect, setSkillSelect] = useState('IELTS Speaking');
  const [classTitle, setClassTitle] = useState('');

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const openNewSkillModal = () => {
    showToast('Mở biểu mẫu xác minh kỹ năng mới...');
  };

  const openClassChat = (clsCode: string) => {
    showToast(`Đang mở cuộc trò chuyện với học viên lớp ${clsCode}...`);
  };

  const showClassDetails = (clsCode: string) => {
    showToast(`Đang tải danh sách học viên đăng ký lớp ${clsCode}...`);
  };

  const copyShareLink = (clsCode: string) => {
    navigator.clipboard?.writeText(window.location.origin + '/lop-hoc/' + clsCode);
    showToast(`Đã sao chép link lớp ${clsCode}!`);
  };

  const showClassReview = (clsCode: string) => {
    showToast(`Đánh giá cho lớp ${clsCode}: 5/5 sao - Tuyệt vời!`);
  };

  const prefillCreateClass = (skillName: string) => {
    setSkillSelect(skillName);
    setClassTitle('Chuyên đề: ' + skillName);
    setIsModalOpen(true);
  };

  const handleCreateClassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalOpen(false);
    showToast(`Đã xuất bản lớp học "${classTitle}" thành công!`);
    setClassTitle('');
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 relative">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-slate-200 z-50 h-16 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-8">
            <a href="#" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-lg transition-colors">
                S
              </div>
              <span className="font-bold text-xl text-slate-900 tracking-tight">SkillSwap</span>
            </a>
            <nav className="hidden md:flex items-center gap-1.5">
              <a href="#" className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">Khám phá</a>
              <a href="#" className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">Lớp học của tôi</a>
              <a href="/vi/instructor" className="text-emerald-700 bg-emerald-50 font-semibold px-3.5 py-1.5 rounded-lg text-sm transition-colors">Studio Giảng dạy</a>
              <a href="/vi/wallet" className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">Ví &amp; Tín dụng</a>
              <a href="#" className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">Xác minh</a>
            </nav>
          </div>
          <div className="flex items-center gap-3.5">
            <div className="flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-semibold text-slate-900">
              <span className="material-symbols-outlined text-[17px] text-emerald-600">monetization_on</span>
              <span>1.260 Credits</span>
              <a href="/vi/wallet" className="w-5 h-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors text-xs font-bold leading-none">+</a>
            </div>
            <button type="button" className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors relative">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-600 ring-2 ring-white"></span>
            </button>
            <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>
            <div className="flex items-center gap-2.5 cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center ring-2 ring-slate-100">
                <span className="material-symbols-outlined text-[18px] text-slate-600">person</span>
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-900 leading-tight">Lan Anh</span>
                <span className="text-[11px] text-slate-500">RMIT Mentor</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full">
          
          {/* 1. Header: Profile Summary */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-200">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-slate-200 shadow-sm ring-1 ring-slate-200 flex items-center justify-center text-slate-600 font-bold text-2xl">
                  LA
                </div>
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center ring-2 ring-white">
                  <span className="material-symbols-outlined text-[12px]">verified</span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-2xl text-slate-900 tracking-tight">Lan Anh</h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Giảng viên đã xác minh
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-0.5 font-normal">
                  Khoa Ngôn Ngữ Anh • Đại học Quốc Gia Hà Nội • Mã SV: <span className="font-semibold text-slate-900">VNU-2021-0988</span>
                </p>
              </div>
            </div>
            
            {/* Primary Action */}
            <div className="flex items-center gap-3">
              <a href="/vi/wallet" className="px-4 py-2.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-all shadow-sm">
                Lịch sử giao dịch
              </a>
              <button onClick={() => setIsModalOpen(true)} type="button" className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold text-sm px-5 py-2.5 rounded-full shadow-sm transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-[19px]">add</span>
                Tạo lớp mới
              </button>
            </div>
          </div>

          {/* 2. KPI Summary (4 Metric Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-8">
            {/* Metric 1 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-600 text-xs font-medium mb-2">
                  <span>Doanh thu khả dụng</span>
                  <span className="material-symbols-outlined text-slate-400 text-[18px]">account_balance_wallet</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-2xl text-slate-900">1.260</span>
                  <span className="text-xs font-semibold text-slate-600">Credit</span>
                </div>
                <span className="text-xs text-slate-500 font-normal">≈ 1.260.000 VNĐ</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <a href="/vi/wallet/withdrawal" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1">
                  Rút về ngân hàng <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </a>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-600 text-xs font-medium mb-2">
                  <span>Tạm giữ theo lớp</span>
                  <span className="material-symbols-outlined text-slate-400 text-[18px]">lock_clock</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-2xl text-slate-900">270</span>
                  <span className="text-xs font-semibold text-slate-600">Credit</span>
                </div>
                <span className="text-xs text-slate-500 font-normal">Từ 3 booking đang diễn ra</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Giải ngân sau khi kết thúc buổi dạy
                </span>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-600 text-xs font-medium mb-2">
                  <span>Đã hoàn thành</span>
                  <span className="material-symbols-outlined text-slate-400 text-[18px]">school</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-2xl text-slate-900">35</span>
                  <span className="text-xs font-semibold text-slate-600">buổi học</span>
                </div>
                <span className="text-xs text-emerald-700 font-medium">100% hoàn thành đúng giờ</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-600">Không có tranh chấp hoặc khiếu nại</span>
              </div>
            </div>

            {/* Metric 4 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-600 text-xs font-medium mb-2">
                  <span>Đánh giá trung bình</span>
                  <span className="material-symbols-outlined text-amber-500 text-[18px]">star</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-2xl text-slate-900">4.9</span>
                  <span className="text-xs font-semibold text-slate-600">/ 5.0</span>
                </div>
                <span className="text-xs text-slate-500 font-normal">Dựa trên 31 nhận xét học viên</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">thumb_up</span> 98% học viên hài lòng tuyệt đối
                </span>
              </div>
            </div>
          </div>

          {/* 3. Approved Skills Section */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-lg text-slate-900">Kỹ năng được duyệt giảng dạy</h2>
                <p className="text-xs text-slate-600">Các chủ đề bạn đã hoàn tất kiểm định và có thể mở lớp bất kỳ lúc nào</p>
              </div>
              <button onClick={openNewSkillModal} type="button" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">add</span> Thêm kỹ năng mới
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Skill 1 */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      <span className="material-symbols-outlined text-[12px]">verified</span> Đã duyệt
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">C1 Advanced</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">IELTS Speaking</h3>
                  <p className="text-xs text-slate-600 line-clamp-2 mb-3">Phát âm IPA, phản xạ Part 1-3 và mở rộng từ vựng chủ đề học thuật.</p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Được duyệt bởi Thầy Hùng (8.5)</span>
                  <button onClick={() => prefillCreateClass('IELTS Speaking')} type="button" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                    Mở lớp →
                  </button>
                </div>
              </div>
              
              {/* Skill 2 */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      <span className="material-symbols-outlined text-[12px]">verified</span> Đã duyệt
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">Intermediate</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">Tiếng Anh Giao Tiếp Doanh Nghiệp</h3>
                  <p className="text-xs text-slate-600 line-clamp-2 mb-3">Soạn email chuyên nghiệp, thuyết trình số liệu và giao tiếp văn phòng.</p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Chứng chỉ TOEIC 920</span>
                  <button onClick={() => prefillCreateClass('Tiếng Anh Giao Tiếp Doanh Nghiệp')} type="button" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                    Mở lớp →
                  </button>
                </div>
              </div>
              
              {/* Skill 3 */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-300 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                      <span className="material-symbols-outlined text-[12px]">schedule</span> Đang xét duyệt
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">Professional</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">Dịch thuật Anh – Việt</h3>
                  <p className="text-xs text-slate-600 line-clamp-2 mb-3">Biên dịch văn bản tài chính &amp; thương mại, đối chiếu ngữ nghĩa.</p>
                </div>
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Đã nộp hôm qua • Kết quả trong 24h</span>
                  <span className="text-xs text-slate-500 italic">Chờ duyệt</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Upcoming Classes & Schedule */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-bold text-lg text-slate-900">Lịch giảng dạy &amp; Lớp học</h2>
                <p className="text-xs text-slate-600">Các buổi học sắp diễn ra và danh sách lớp đã công bố</p>
              </div>
              <div className="inline-flex items-center p-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold">
                <button type="button" className="px-3 py-1.5 rounded-lg bg-slate-900 text-white shadow-sm">Tất cả (3)</button>
                <button type="button" className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition-colors">Sắp diễn ra (1)</button>
                <button type="button" className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition-colors">Đang mở (1)</button>
                <button type="button" className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition-colors">Đã xong (1)</button>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Item 1 */}
              <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm hover:border-emerald-300 transition-all">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Sắp diễn ra
                      </span>
                      <span className="text-xs text-slate-500 font-medium">1:1 Session</span>
                      <span className="text-xs text-slate-300">•</span>
                      <span className="text-xs text-slate-600 font-medium">IELTS Speaking</span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-base">Luyện Speaking IELTS 6.5+ (Mock Test &amp; Phản hồi chi tiết)</h3>
                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600">
                      <span className="flex items-center gap-1 text-slate-900 font-medium">
                        <span className="material-symbols-outlined text-[16px] text-emerald-600">calendar_today</span> 19:30 – 20:30 ngày mai (Thứ Năm, 24/10)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-slate-500">person</span> Học viên: Nguyễn Bảo Long (NEU)
                      </span>
                      <span className="flex items-center gap-1 text-slate-900 font-semibold">
                        <span className="material-symbols-outlined text-[16px] text-emerald-600">payments</span> 90 Credit (Đã tạm giữ an toàn)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 pt-2 lg:pt-0">
                    <button onClick={() => openClassChat('CLS-8821')} type="button" className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-all flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-slate-500">chat</span> Chat với học viên
                    </button>
                    <a href="#" className="px-4 py-2 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">video_call</span> Vào phòng Jitsi
                    </a>
                  </div>
                </div>
              </div>

              {/* Item 2 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        Đang mở đăng ký
                      </span>
                      <span className="text-xs text-slate-500 font-medium">Lớp nhóm (Max 5)</span>
                      <span className="text-xs text-slate-300">•</span>
                      <span className="text-xs text-slate-600 font-medium">Chiến lược IELTS</span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-base">Chiến lược làm bài Reading &amp; Listening 7.0+</h3>
                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600">
                      <span className="flex items-center gap-1 text-slate-900 font-medium">
                        <span className="material-symbols-outlined text-[16px] text-slate-600">calendar_today</span> 20:00 Thứ Sáu (25/10) • 90 phút
                      </span>
                      <span className="flex items-center gap-1 font-medium text-emerald-700">
                        <span className="material-symbols-outlined text-[16px]">group</span> 4/5 học viên đã đăng ký (Còn 1 chỗ)
                      </span>
                      <span className="flex items-center gap-1 text-slate-900 font-semibold">
                        <span className="material-symbols-outlined text-[16px] text-emerald-600">payments</span> 45 Credit / học viên
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 pt-2 lg:pt-0">
                    <button onClick={() => copyShareLink('CLS-9014')} type="button" className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-all flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-slate-500">share</span> Chia sẻ
                    </button>
                    <button onClick={() => showClassDetails('CLS-9014')} type="button" className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all flex items-center gap-1.5">
                      Quản lý lớp
                    </button>
                  </div>
                </div>
              </div>

              {/* Item 3 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm opacity-90 hover:opacity-100 transition-all">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                        Đã hoàn thành
                      </span>
                      <span className="text-xs text-slate-500 font-medium">Phát âm &amp; Ngữ điệu</span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-base">Pronunciation Workshop: Intonation in British Accent</h3>
                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-slate-400">check_circle</span> Hoàn tất tối qua (19:30 – 20:30)
                      </span>
                      <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                        <span className="material-symbols-outlined text-[16px]">payments</span> +81 Credit đã nhận vào ví
                      </span>
                      <span className="flex items-center gap-1 text-amber-600 font-medium">
                        <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span> 5.0 (Học viên đánh giá 5 sao)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 pt-2 lg:pt-0">
                    <button onClick={() => showClassReview('CLS-8742')} type="button" className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-all">
                      Xem đánh giá
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 bg-white py-6 mt-12">
        <div className="max-w-6xl mx-auto px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div>© 2026 SkillSwap Vietnam. Trao đổi tri thức, kết nối sinh viên.</div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-slate-900 transition-colors">Trợ giúp</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Quy định &amp; Điều khoản</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Bảo mật</a>
            <span className="text-slate-300">|</span>
            <button type="button" className="flex items-center gap-1 hover:text-slate-900 font-medium transition-colors">
              <span className="material-symbols-outlined text-[15px]">language</span> Tiếng Việt
            </button>
          </div>
        </div>
      </footer>

      {/* Modal Create Class */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Tạo lớp học mới</h3>
                <p className="text-xs text-slate-600">Thiết lập thời gian và học phí cho buổi dạy</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} type="button" className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateClassSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="skill-select">Kỹ năng giảng dạy *</label>
                <select 
                  id="skill-select" 
                  value={skillSelect}
                  onChange={(e) => setSkillSelect(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600" required>
                  <option value="IELTS Speaking">IELTS Speaking (Đã xác minh • C1 Advanced)</option>
                  <option value="Tiếng Anh Giao Tiếp Doanh Nghiệp">Tiếng Anh Giao Tiếp Doanh Nghiệp (Đã xác minh)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="class-title">Tiêu đề buổi học *</label>
                <input 
                  id="class-title" 
                  value={classTitle}
                  onChange={(e) => setClassTitle(e.target.value)}
                  type="text" 
                  placeholder="VD: Luyện phản xạ IELTS Speaking Part 2" 
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="class-duration">Thời lượng (phút) *</label>
                  <input id="class-duration" type="number" min="30" max="180" step="15" defaultValue="60" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="class-capacity">Số học viên tối đa *</label>
                  <input id="class-capacity" type="number" min="1" max="10" defaultValue="1" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="class-price">Credit / Học viên *</label>
                  <input id="class-price" type="number" min="10" step="5" defaultValue="90" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="class-datetime">Thời gian bắt đầu *</label>
                  <input id="class-datetime" type="datetime-local" required className="w-full h-10 px-3 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600" />
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 flex items-start gap-2 border border-slate-200">
                <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0">info</span>
                <span>Phòng học Jitsi mã hóa bảo mật sẽ được tự động tạo và gửi cho học viên đã đăng ký.</span>
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button onClick={() => setIsModalOpen(false)} type="button" className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100">Hủy</button>
                <button type="submit" className="px-4 py-2 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">Xuất bản lớp học</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      <div className={`fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 transition-all duration-300 ${toastMessage ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
        <span className="material-symbols-outlined text-[18px] text-emerald-400">check_circle</span>
        <span className="text-xs font-medium">{toastMessage}</span>
      </div>
    </div>
  );
}
