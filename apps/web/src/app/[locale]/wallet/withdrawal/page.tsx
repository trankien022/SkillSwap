'use client';

import { useState } from 'react';

export default function WithdrawalPage() {
  const [amount, setAmount] = useState(1000);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value) || 0;
    if (val > 1260) val = 1260;
    setAmount(val);
  };

  const setQuickAmount = (val: number) => {
    setAmount(val);
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
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
              <a href="/vi/instructor" className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">Studio Giảng dạy</a>
              <a href="/vi/wallet" className="text-emerald-700 bg-emerald-50 font-semibold px-3.5 py-1.5 rounded-lg text-sm transition-colors">Ví &amp; Tín dụng</a>
              <a href="#" className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">Xác minh</a>
            </nav>
          </div>
          <div className="flex items-center gap-3.5">
            <div className="flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-semibold text-slate-900">
              <span className="material-symbols-outlined text-[17px] text-emerald-600">monetization_on</span>
              <span>150 Credits</span>
              <button type="button" className="w-5 h-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors text-xs font-bold leading-none">+</button>
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
                <span className="text-xs font-semibold text-slate-900 leading-tight">Minh Nguyễn</span>
                <span className="text-[11px] text-slate-500">RMIT</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full pt-16 flex-1">
        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-8">
          
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-600 mb-2">
            <a href="#" className="hover:text-emerald-600 transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">school</span>
              Studio Giảng dạy
            </a>
            <span className="text-slate-300">/</span>
            <a href="#" className="hover:text-emerald-600 transition-colors">Ví giảng viên</a>
            <span className="text-slate-300">/</span>
            <span aria-current="page" className="text-slate-900 font-semibold">Yêu cầu rút tiền</span>
          </nav>

          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-2">
                <span className="material-symbols-outlined text-[16px]">verified_user</span>
                Đối soát sinh viên định danh (eKYC Verified)
              </div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Yêu cầu Rút thu nhập Giảng dạy</h1>
              <p className="text-base text-slate-600 max-w-2xl mt-2">
                Rút tiền trực tiếp từ số dư khả dụng về tài khoản ngân hàng chính chủ sinh viên với quy trình đối soát tự động Napas 24/7.
              </p>
            </div>
            {/* Instructor Quick Info Snapshot */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-900 text-base font-bold">
                LA
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-semibold text-slate-900">ThS. Lan Anh</span>
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                </div>
                <span className="text-xs text-slate-600">Kinh tế số · RMIT K20</span>
              </div>
            </div>
          </div>

          {/* Main Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              
              {/* 1. Balance Partition Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between pb-2 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-slate-900">account_balance_wallet</span>
                    <h2 className="text-base font-semibold text-slate-900">Phân tách Số dư Ví Giảng viên</h2>
                  </div>
                  <span className="text-xs text-slate-600">Tỷ giá: 1 CR = 1.000 VNĐ (BR-027)</span>
                </div>
                
                {/* Academic Skill Ledger Mini Visualizer */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1.5 text-xs">
                    <span className="text-slate-600">Cơ cấu tín dụng tổng cộng: <strong className="text-slate-900">1.530 Credits</strong></span>
                    <span className="text-emerald-600 font-semibold">Khả dụng: 82.3%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-600 h-full rounded-l-full" style={{ width: '82.35%' }} title="Khả dụng (1.260)"></div>
                    <div className="bg-amber-400 h-full" style={{ width: '17.65%' }} title="Tạm giữ (270)"></div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Khả dụng rút
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span> Escrow lớp học (Pending)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-300"></span> Đang xử lý (Hold)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-emerald-600 mb-1">
                      <span className="text-xs font-semibold">Khả dụng rút</span>
                      <span className="material-symbols-outlined text-[16px]">lock_open</span>
                    </div>
                    <div>
                      <p className="text-xl text-slate-900 font-bold leading-tight">1.260 <span className="text-xs font-normal text-slate-600">CR</span></p>
                      <p className="text-[11px] text-slate-600 mt-0.5">~ 1.260.000 VNĐ</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-600 mb-1">
                      <span className="text-xs font-semibold">Đang tạm giữ</span>
                      <span className="material-symbols-outlined text-[16px]">lock_clock</span>
                    </div>
                    <div>
                      <p className="text-xl text-slate-900 font-bold leading-tight">270 <span className="text-xs font-normal text-slate-600">CR</span></p>
                      <p className="text-[11px] text-slate-600 mt-0.5">Đang trong lớp học</p>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between opacity-80">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="text-xs font-semibold">Đang xử lý rút</span>
                      <span className="material-symbols-outlined text-[16px]">hourglass_empty</span>
                    </div>
                    <div>
                      <p className="text-xl text-slate-900 font-bold leading-tight">0 <span className="text-xs font-normal text-slate-600">CR</span></p>
                      <p className="text-[11px] text-slate-600 mt-0.5">Payout Hold (BR-062)</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Withdrawal Amount Input */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <label htmlFor="creditAmount" className="text-base text-slate-900 font-semibold flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">1</span>
                    Số Credit muốn rút
                  </label>
                  <span className="text-xs text-slate-600">Tối thiểu: 200 CR (200.000 VNĐ)</span>
                </div>
                
                <div className="relative">
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-emerald-600 focus-within:border-emerald-600 transition-all">
                    <span className="material-symbols-outlined text-slate-400 mr-3 text-[22px]">toll</span>
                    <input 
                      id="creditAmount" 
                      type="number" 
                      min="200" 
                      max="1260" 
                      value={amount}
                      onChange={handleAmountChange}
                      className="w-full bg-transparent text-2xl text-slate-900 font-bold tracking-tight focus:outline-none placeholder-slate-400" 
                    />
                    <div className="text-right flex flex-col items-end flex-shrink-0 pl-3">
                      <span className="text-base font-bold text-slate-900">Credits</span>
                      <span className="text-[11px] text-slate-600 font-medium">Quy đổi: {(amount * 1000).toLocaleString('vi-VN')} VNĐ</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-slate-600 mr-1">Chọn nhanh:</span>
                  <button onClick={() => setQuickAmount(500)} type="button" className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 transition-colors">
                    500 CR
                  </button>
                  <button onClick={() => setQuickAmount(1000)} type="button" className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 transition-colors">
                    1.000 CR
                  </button>
                  <button onClick={() => setQuickAmount(1260)} type="button" className="px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors">
                    Tất cả (1.260)
                  </button>
                </div>
                
                <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between text-xs border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="material-symbols-outlined text-[18px]">savings</span>
                    <span>Phí rút tiền qua cổng Napas 247:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 line-through">11.000 VNĐ</span>
                    <span className="font-semibold text-emerald-600">0 VNĐ (SkillSwap tài trợ)</span>
                  </div>
                </div>
              </div>

              {/* 3. Designated Bank Account */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-base text-slate-900 font-semibold flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">2</span>
                    Tài khoản Ngân hàng Thụ hưởng
                  </label>
                  <span className="text-xs text-emerald-700 font-medium flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-full">
                    <span className="material-symbols-outlined text-[14px]">shield</span>
                    Chính chủ sinh viên
                  </span>
                </div>
                
                <div className="relative rounded-xl border-2 border-emerald-600 p-4 bg-emerald-50/30 flex items-start justify-between cursor-pointer shadow-sm">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-900 text-base font-bold">
                      VCB
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-slate-900">Vietcombank</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold">Mặc định</span>
                      </div>
                      <p className="text-base text-slate-900 font-mono tracking-wider font-semibold">1049 281 772</p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                        <span>Chủ TK: <strong className="text-slate-900">NGUYEN THI LAN ANH</strong></span>
                        <span>•</span>
                        <span>CN Tân Định (TP.HCM)</span>
                      </div>
                      <div className="flex items-center gap-1.5 pt-1 text-emerald-700 text-xs font-medium">
                        <span className="material-symbols-outlined text-[15px]">verified</span>
                        Đã đối soát trùng khớp 100% thẻ Sinh viên &amp; CCCD
                      </div>
                    </div>
                  </div>
                  <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-white flex-shrink-0 mt-1">
                    <span className="material-symbols-outlined text-[14px]">check</span>
                  </div>
                </div>
                
                <button type="button" className="w-full py-3 px-4 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  Thêm tài khoản ngân hàng liên kết Napas 247 mới
                </button>
              </div>

              {/* 4. Step-up Authentication */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-base text-slate-900 font-semibold flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">3</span>
                    Xác thực Bổ sung (Step-up Auth)
                  </label>
                  <span className="text-xs text-slate-500">Mã gửi đến 098****419</span>
                </div>
                <p className="text-sm text-slate-600">
                  Vui lòng nhập mã bảo mật 6 số được gửi qua SMS / Ứng dụng xác thực để ký lệnh rút tiền an toàn.
                </p>
                <div className="flex items-center justify-between max-w-sm mx-auto sm:mx-0 gap-2">
                  <div className="w-12 h-14 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-xl font-bold text-slate-900">8</div>
                  <div className="w-12 h-14 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-xl font-bold text-slate-900">4</div>
                  <div className="w-12 h-14 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-xl font-bold text-slate-900">9</div>
                  <div className="w-12 h-14 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-xl font-bold text-slate-900">2</div>
                  <div className="w-12 h-14 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-xl font-bold text-slate-900">1</div>
                  <div className="w-12 h-14 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-xl font-bold text-slate-900">0</div>
                </div>
                <div className="flex items-center justify-between text-slate-600 pt-1 text-xs">
                  <span>Hiệu lực trong <strong className="text-slate-900 font-semibold">01:48s</strong></span>
                  <button type="button" className="text-slate-900 font-semibold hover:underline">Gửi lại mã OTP</button>
                </div>
              </div>

              {/* 5. Primary Action */}
              <div className="space-y-3 pt-2">
                <button type="button" className="w-full py-4 px-6 rounded-full bg-emerald-600 text-white text-base font-bold hover:bg-emerald-700 active:scale-[0.99] transition-all flex items-center justify-center gap-3">
                  <span className="material-symbols-outlined text-[20px]">payments</span>
                  Xác nhận Yêu cầu Rút {(amount * 1000).toLocaleString('vi-VN')} VNĐ
                </button>
                <div className="p-3.5 bg-slate-100 rounded-xl flex items-start gap-3 border border-slate-200">
                  <span className="material-symbols-outlined text-slate-500 text-[20px] flex-shrink-0 mt-0.5">info</span>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-900 font-semibold leading-snug">
                      Quy tắc nghiệp vụ Payout &amp; Bảo vệ Escrow (BR-058, BR-062):
                    </p>
                    <p className="text-[13px] text-slate-600 leading-relaxed">
                      Số tiền rút không được vượt quá số dư khả dụng (1.260 Credits). Ngay khi bạn gửi yêu cầu, {amount} Credits sẽ được tự động chuyển sang trạng thái 
                      <span className="font-mono text-emerald-700 font-semibold mx-1">payout_hold</span> để khóa an toàn trong khi đối soát Napas. Nếu ngân hàng từ chối, khoản này sẽ hoàn trả ngay về ví.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Processing Timeline */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-3 text-slate-900">
                  <span className="material-symbols-outlined text-[20px] text-slate-600">pace</span>
                  <h3 className="text-base font-semibold">Thời gian Xử lý Giải ngân</h3>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  Hệ thống thanh toán bù trừ tự động Napas 24/7 đối soát lệnh liên tục. Tiền về tài khoản cá nhân thông thường trong:
                </p>
                <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl mb-3">
                  <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-emerald-600 flex-shrink-0">
                    <span className="material-symbols-outlined text-[20px]">bolt</span>
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-900 leading-tight">5 – 15 phút</p>
                    <p className="text-[11px] text-slate-500">Hoạt động 24/7 cả thứ Bảy, Chủ Nhật và ngày Lễ</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-500 text-xs">
                  <span className="material-symbols-outlined text-[16px]">security</span>
                  <span>Giao dịch có mã tra soát Napas FT/CIT đối chứng.</span>
                </div>
              </div>

              {/* Lifecycle History */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-slate-900">history_toggle_off</span>
                    <h3 className="text-base font-semibold text-slate-900">Vòng đời Lệnh rút gần đây</h3>
                  </div>
                  <a href="#" className="text-sm text-emerald-600 hover:underline font-semibold">Tất cả (8)</a>
                </div>
                
                <div className="space-y-4">
                  {/* Processing */}
                  <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-sm">#WD-9941</span>
                        <span className="text-[11px] text-slate-500">10:14 Hôm nay</span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 text-[11px] font-semibold">
                        <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse"></span>
                        Đang xử lý
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <div className="text-sm font-bold text-slate-900">1.000 Credits</div>
                        <div className="text-[11px] text-slate-600">1.000.000 VNĐ • VCB (..1772)</div>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-slate-700 font-medium block">Payout Hold Locked</span>
                        <span className="text-[11px] text-slate-500">Đang gửi Napas 247</span>
                      </div>
                    </div>
                  </div>

                  {/* Completed */}
                  <div className="p-3.5 bg-white border border-emerald-100 rounded-xl shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-sm">#WD-8820</span>
                        <span className="text-[11px] text-slate-500">14:20 20/10/2025</span>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        Thành công
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <div className="text-sm font-bold text-slate-900">800 Credits</div>
                        <div className="text-[11px] text-slate-600">800.000 VNĐ • VCB (..1772)</div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-[11px] text-slate-500 block">FT25102014209</span>
                        <span className="text-[11px] text-emerald-700 font-medium">Đã tất toán</span>
                      </div>
                    </div>
                  </div>

                  {/* Failed */}
                  <div className="p-3.5 bg-white border border-red-100 rounded-xl shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-sm">#WD-7411</span>
                        <span className="text-[11px] text-slate-500">09:15 15/10/2025</span>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold">
                        <span className="material-symbols-outlined text-[13px]">cancel</span>
                        Thất bại
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <div className="text-sm font-bold text-slate-900">500 Credits</div>
                        <div className="text-[11px] text-slate-600">500.000 VNĐ • BIDV (..4901)</div>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-red-600 font-semibold block flex items-center justify-end gap-1">
                          <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                          Đã hoàn 500 CR
                        </span>
                        <span className="text-[11px] text-red-700">Sai tên chi nhánh</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 flex items-center justify-between text-slate-600 text-xs border-t border-slate-100">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">headset_mic</span>
                    Cần tra soát lệnh?
                  </span>
                  <a href="#" className="text-emerald-600 hover:underline font-semibold">Liên hệ Hỗ trợ 24/7</a>
                </div>
              </div>

              {/* Tax Note */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5 text-slate-600 text-[13px]">
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                  <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                  Chứng từ &amp; Thuế TNCN
                </div>
                <p className="leading-relaxed">
                  Theo chính sách hoạt động SkillSwap, các khoản thu nhập trợ giảng/gia sư dưới 2.000.000 VNĐ/lần thanh toán không phải khấu trừ tạm tính thuế TNCN 10%. Sao kê chi tiết có sẵn trong mục Báo cáo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[13px] text-slate-500 text-center sm:text-left">
            © 2026 SkillSwap Vietnam. Nền tảng học hỏi kỹ năng ngang hàng sinh viên.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[13px] text-slate-600">
            <a href="#" className="hover:text-emerald-600 transition-colors">Trợ giúp</a>
            <span className="text-slate-300">•</span>
            <a href="#" className="hover:text-emerald-600 transition-colors">Quy định &amp; Chính sách</a>
            <span className="text-slate-300">•</span>
            <a href="#" className="hover:text-emerald-600 transition-colors">Bảo mật Escrow</a>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1 text-slate-900 font-medium">
              <span className="material-symbols-outlined text-[16px]">language</span>
              Tiếng Việt (VN)
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
