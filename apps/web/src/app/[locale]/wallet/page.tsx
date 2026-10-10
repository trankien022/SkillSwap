'use client';

import { useState } from 'react';
import { createTopUpIntent } from './actions';

export default function WalletPage() {
  const [amount, setAmount] = useState(100);
  const [bank, setBank] = useState('VCB');
  const [filter, setFilter] = useState('all');
  const [isPending, setIsPending] = useState(false);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    setAmount(val);
  };

  const setQuickAmount = (val: number) => {
    setAmount(val);
  };

  const scrollToDeposit = () => {
    const el = document.getElementById('deposit-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleVerify = async () => {
    try {
      setIsPending(true);
      const data = await createTopUpIntent(amount * 1000);
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        alert('Tạo yêu cầu nạp tiền thành công!');
      }
    } catch (e) {
      console.error(e);
      alert('Không thể kết nối đến cổng thanh toán lúc này. Vui lòng thử lại sau.');
    } finally {
      setIsPending(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Đã sao chép: ' + text);
    }).catch(() => {
      alert('Sao chép: ' + text);
    });
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
              <a href="#" className="text-emerald-700 bg-emerald-50 font-semibold px-3.5 py-1.5 rounded-lg text-sm transition-colors">Ví &amp; Tín dụng</a>
              <a href="#" className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">Xác minh</a>
            </nav>
          </div>
          <div className="flex items-center gap-3.5">
            <div className="flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-semibold text-slate-900">
              <span className="material-symbols-outlined text-[17px] text-emerald-600">monetization_on</span>
              <span>150 Credits</span>
              <button onClick={scrollToDeposit} className="w-5 h-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors text-xs font-bold leading-none">+</button>
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
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold mb-2">
                <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>
                SkillSwap Wallet • Hệ thống Tín dụng Sinh viên
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Ví &amp; Quản lý Tín dụng học tập</h1>
              <p className="text-sm text-slate-600 mt-1">Quản lý số dư, nạp credit học tập và theo dõi dòng tiền minh bạch được bảo vệ bởi Escrow</p>
            </div>
            <div className="flex items-center gap-2.5">
              <button className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-slate-500">picture_as_pdf</span>
                Xuất hóa đơn
              </button>
              <button onClick={scrollToDeposit} className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">add_card</span>
                Nạp Credit ngay
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {/* Card 1: Balance */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-600 tracking-wide">Số dư khả dụng</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900 tracking-tight">150</span>
                <span className="text-sm font-semibold text-emerald-600">Credit</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">≈ 150.000 VNĐ (Tỷ giá 1:1.000đ)</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button onClick={scrollToDeposit} className="w-full py-2 px-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-[15px]">add</span>
                Nạp thêm Credit
              </button>
            </div>
          </div>

          {/* Card 2: Escrow */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-600 tracking-wide">Đang tạm giữ (Escrow)</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">lock_clock</span>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-amber-700 tracking-tight">90</span>
                <span className="text-sm font-semibold text-amber-700">Credit</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">≈ 90.000 VNĐ đang khóa an toàn</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-[11px] leading-relaxed text-slate-600 flex items-start gap-1">
                <span className="material-symbols-outlined text-[14px] text-amber-700 shrink-0 mt-0.5">info</span>
                <span>Đang bảo chứng cho lớp Speaking IELTS 6.5+, giải ngân sau buổi học.</span>
              </p>
            </div>
          </div>

          {/* Card 3: Spend */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-600 tracking-wide">Tổng chi tiêu tháng</span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">query_stats</span>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900 tracking-tight">350</span>
                <span className="text-sm font-semibold text-slate-600">Credit</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">≈ 350.000 VNĐ đã sử dụng</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Lớp hoàn thành</span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">4 buổi học</span>
              </div>
            </div>
          </div>

          {/* Card 4: Wallet Status */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-600 tracking-wide">Trạng thái ví</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
                <span className="text-base font-bold text-emerald-700">Hoạt động an toàn</span>
              </div>
              <span className="inline-block text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded mt-1.5">Sinh viên RMIT Đã xác minh</span>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-[11px] leading-relaxed text-slate-600 flex items-start gap-1">
                <span className="material-symbols-outlined text-[14px] text-emerald-700 shrink-0 mt-0.5">check_circle</span>
                <span>Bảo đảm 100% hoàn tín dụng nếu có sự cố.</span>
              </p>
            </div>
          </div>
        </div>

        {/* Deposit Section */}
        <div id="deposit-section" className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm mb-8 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 mb-6 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-[20px]">qr_code_2</span>
                <h2 className="text-lg font-bold text-slate-900">Nạp Credit nhanh qua Chuyển khoản QR</h2>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">Chọn gói tín dụng phù hợp, quét mã VietQR tự động cộng số dư chỉ sau 3 giây</p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                <span className="material-symbols-outlined text-[14px]">bolt</span> 0% Phí
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                Napas 247 • VietQR
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Form */}
            <div className="lg:col-span-7 space-y-6">
              
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  1. Các gói credit phổ biến
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button onClick={() => setQuickAmount(50)} className={`p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${amount === 50 ? 'border-emerald-600 bg-emerald-50' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}>
                    <span className={`text-[11px] font-medium ${amount === 50 ? 'text-emerald-700' : 'text-slate-600'}`}>Khởi động</span>
                    <div className="my-2">
                      <span className={`text-xl font-bold ${amount === 50 ? 'text-emerald-800' : 'text-slate-900'}`}>50</span>
                      <span className={`text-xs font-medium ml-1 ${amount === 50 ? 'text-emerald-700' : 'text-slate-500'}`}>CR</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-700">50.000đ</span>
                  </button>
                  
                  <button onClick={() => setQuickAmount(100)} className={`p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between relative ${amount === 100 ? 'border-emerald-600 bg-emerald-50' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}>
                    <span className="absolute -top-2.5 right-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">Phổ biến</span>
                    <span className={`text-[11px] font-semibold ${amount === 100 ? 'text-emerald-700' : 'text-slate-600'}`}>Tiêu chuẩn</span>
                    <div className="my-2">
                      <span className={`text-xl font-bold ${amount === 100 ? 'text-emerald-800' : 'text-slate-900'}`}>100</span>
                      <span className={`text-xs font-semibold ml-1 ${amount === 100 ? 'text-emerald-700' : 'text-slate-500'}`}>CR</span>
                    </div>
                    <span className="text-xs font-bold text-slate-900">100.000đ</span>
                  </button>
                  
                  <button onClick={() => setQuickAmount(200)} className={`p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${amount === 200 ? 'border-emerald-600 bg-emerald-50' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}>
                    <span className={`text-[11px] font-medium ${amount === 200 ? 'text-emerald-700' : 'text-slate-600'}`}>Chăm chỉ</span>
                    <div className="my-2">
                      <span className={`text-xl font-bold ${amount === 200 ? 'text-emerald-800' : 'text-slate-900'}`}>200</span>
                      <span className={`text-xs font-medium ml-1 ${amount === 200 ? 'text-emerald-700' : 'text-slate-500'}`}>CR</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-700">200.000đ</span>
                  </button>

                  <button onClick={() => setQuickAmount(500)} className={`p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between relative ${amount === 500 ? 'border-emerald-600 bg-emerald-50' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}>
                    <span className="absolute -top-2.5 right-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white">+5% Thưởng</span>
                    <span className={`text-[11px] font-medium ${amount === 500 ? 'text-emerald-700' : 'text-slate-600'}`}>Học bá</span>
                    <div className="my-2">
                      <span className={`text-xl font-bold ${amount === 500 ? 'text-emerald-800' : 'text-slate-900'}`}>500</span>
                      <span className={`text-xs font-medium ml-1 ${amount === 500 ? 'text-emerald-700' : 'text-slate-500'}`}>CR</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-700">500.000đ</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Hoặc nhập số credit khác
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative w-full max-w-xs">
                    <input 
                      type="number" 
                      min="10" 
                      step="10" 
                      value={amount}
                      onChange={handleAmountChange}
                      className="w-full h-11 px-3.5 pr-16 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all" 
                    />
                    <span className="absolute right-3.5 top-3 text-xs font-semibold text-slate-500 pointer-events-none">Credit</span>
                  </div>
                  <span className="text-slate-400 text-sm font-medium">=</span>
                  <div className="px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-900 text-sm font-bold">
                    {(amount * 1000).toLocaleString('vi-VN')} VNĐ
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                  2. Kênh đối soát ngân hàng
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <label className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-colors ${bank === 'VCB' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <input type="radio" name="bank" checked={bank === 'VCB'} onChange={() => setBank('VCB')} className="w-4 h-4 text-emerald-600 accent-emerald-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-tight">Vietcombank</p>
                      <p className="text-[11px] text-slate-500">Napas 247 Pro</p>
                    </div>
                  </label>
                  <label className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-colors ${bank === 'MB' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <input type="radio" name="bank" checked={bank === 'MB'} onChange={() => setBank('MB')} className="w-4 h-4 text-emerald-600 accent-emerald-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-tight">MBBank</p>
                      <p className="text-[11px] text-slate-500">Quét tức thì</p>
                    </div>
                  </label>
                  <label className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-colors ${bank === 'MOMO' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'} col-span-2 sm:col-span-1`}>
                    <input type="radio" name="bank" checked={bank === 'MOMO'} onChange={() => setBank('MOMO')} className="w-4 h-4 text-emerald-600 accent-emerald-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-tight">Ví MoMo</p>
                      <p className="text-[11px] text-slate-500">Ví điện tử</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[20px] text-emerald-600">security</span>
                <span>Mỗi mã QR chỉ liên kết với tài khoản sinh viên Minh Nguyễn (ID: SSWAP-3928). Hệ thống webhook tự động mở khóa credit ngay sau khi nhận tiền.</span>
              </div>
            </div>

            {/* Right Column: QR Code */}
            <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col items-center text-center shadow-sm">
              <div className="w-full flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <span className="text-xs font-bold text-slate-900">VietQR Napas 24/7</span>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">VCB • MBBank Auto</span>
              </div>
              
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm max-w-[220px] w-full flex flex-col items-center">
                <div className="relative w-44 h-44 flex items-center justify-center bg-slate-100 rounded-lg">
                  {/* Placeholder QR */}
                  <span className="material-symbols-outlined text-5xl text-slate-300">qr_code_2</span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium mt-2">Quét bằng Mobile Banking bất kỳ</span>
              </div>
              
              <div className="w-full mt-4 bg-white rounded-xl border border-slate-200 p-3.5 text-left text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Ngân hàng:</span>
                  <span className="font-bold text-slate-900">Vietcombank CN TP.HCM</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Số tài khoản:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-bold text-slate-900">1049281772</span>
                    <button onClick={() => handleCopy('1049281772')} className="text-emerald-600 hover:text-emerald-800 p-0.5">
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Số tiền nạp:</span>
                  <span className="font-bold text-emerald-600 text-sm">{(amount * 1000).toLocaleString('vi-VN')} VNĐ</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                  <span className="text-slate-600">Nội dung CK:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">SSWAP 3928</span>
                    <button onClick={() => handleCopy('SSWAP 3928')} className="text-emerald-600 hover:text-emerald-800 p-0.5">
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    </button>
                  </div>
                </div>
              </div>
              
              <button disabled={isPending} onClick={handleVerify} className="w-full mt-4 py-2.5 px-4 rounded-full bg-slate-900 hover:bg-slate-800 disabled:opacity-70 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2">
                <span className={`material-symbols-outlined text-[16px] ${isPending ? 'animate-spin' : ''}`}>sync</span>
                {isPending ? 'Đang tạo thanh toán...' : 'Đã chuyển khoản - Kiểm tra tức thì'}
              </button>
              <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-emerald-600">verified</span>
                Bảo mật SSL 256-bit • Tiền vào ví sau 3s
              </p>
            </div>
          </div>
        </div>

        {/* Ledger & Transactions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-slate-100 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-900 text-[20px]">receipt_long</span>
                <h2 className="text-lg font-bold text-slate-900">Lịch sử giao dịch &amp; Bút toán Ledger</h2>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">Sổ cái phân tán minh bạch, kiểm tra đầy đủ mã GD, chứng từ và trạng thái giải ngân</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex p-1 bg-slate-50 rounded-xl text-xs font-medium border border-slate-200">
                <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg transition-all ${filter === 'all' ? 'bg-white text-slate-900 font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Tất cả</button>
                <button onClick={() => setFilter('deposit')} className={`px-3 py-1.5 rounded-lg transition-all ${filter === 'deposit' ? 'bg-white text-slate-900 font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Nạp credit</button>
                <button onClick={() => setFilter('pay')} className={`px-3 py-1.5 rounded-lg transition-all ${filter === 'pay' ? 'bg-white text-slate-900 font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Thanh toán lớp</button>
                <button onClick={() => setFilter('escrow')} className={`px-3 py-1.5 rounded-lg transition-all ${filter === 'escrow' ? 'bg-white text-slate-900 font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Hoàn tiền Escrow</button>
              </div>
              <button className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm">
                <span className="material-symbols-outlined text-[16px] text-slate-600">download</span>
                Tải sao kê
              </button>
            </div>
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-3">Nội dung giao dịch</th>
                  <th className="py-3.5 px-3">Thời gian</th>
                  <th className="py-3.5 px-3">Mã GD &amp; Kênh</th>
                  <th className="py-3.5 px-3 text-center">Trạng thái</th>
                  <th className="py-3.5 px-3 text-right">Biến động Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {(filter === 'all' || filter === 'deposit') && (
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[18px]">add_card</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">Nạp credit qua VietQR</p>
                          <p className="text-[11px] text-slate-600">Vietcombank Napas247 • Tự động ghi có</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-3 text-slate-600 font-medium">
                      <div>24/10/2025</div>
                      <div className="text-[11px] text-slate-500">14:32:10</div>
                    </td>
                    <td className="py-4 px-3">
                      <span className="font-mono font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">#TX-883109</span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">Cổng VietQR 24/7</span>
                    </td>
                    <td className="py-4 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Thành công
                      </span>
                    </td>
                    <td className="py-4 px-3 text-right">
                      <span className="text-sm font-bold text-emerald-600">+200 Credit</span>
                      <span className="block text-[11px] text-slate-500 font-medium">+200.000 VNĐ</span>
                    </td>
                  </tr>
                )}
                
                {(filter === 'all' || filter === 'escrow') && (
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[18px]">lock</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">Tạm khóa Escrow cho lớp IELTS</p>
                          <p className="text-[11px] text-slate-600">Lớp với ThS. Lan Anh • 1:1 Mock Interview</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-3 text-slate-600 font-medium">
                      <div>24/10/2025</div>
                      <div className="text-[11px] text-slate-500">09:15:42</div>
                    </td>
                    <td className="py-4 px-3">
                      <span className="font-mono font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">#TX-882901</span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">Escrow Smart Hold</span>
                    </td>
                    <td className="py-4 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span> Đang tạm giữ
                      </span>
                    </td>
                    <td className="py-4 px-3 text-right">
                      <span className="text-sm font-bold text-slate-900">-90 Credit</span>
                      <span className="block text-[11px] text-slate-500 font-medium">-90.000 VNĐ (Escrow)</span>
                    </td>
                  </tr>
                )}

                {(filter === 'all' || filter === 'pay') && (
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[18px]">school</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">Thanh toán hoàn tất: Data Python</p>
                          <p className="text-[11px] text-slate-600">Mentor: Trần Quang Huy • 90 phút</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-3 text-slate-600 font-medium">
                      <div>22/10/2025</div>
                      <div className="text-[11px] text-slate-500">20:45:00</div>
                    </td>
                    <td className="py-4 px-3">
                      <span className="font-mono font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">#TX-879412</span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">Giải ngân tự động</span>
                    </td>
                    <td className="py-4 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Đã hoàn thành
                      </span>
                    </td>
                    <td className="py-4 px-3 text-right">
                      <span className="text-sm font-bold text-slate-900">-110 Credit</span>
                      <span className="block text-[11px] text-slate-500 font-medium">-110.000 VNĐ</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-slate-200 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 gap-4">
          <p className="font-medium">© 2026 SkillSwap Vietnam. Nền tảng học hỏi ngang hàng sinh viên.</p>
          <div className="flex items-center gap-6 font-semibold">
            <a href="#" className="hover:text-emerald-600 transition-colors">Trợ giúp</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">Quy định</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">Bảo mật</a>
            <div className="flex items-center gap-1.5 text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
              <span className="material-symbols-outlined text-[15px]">language</span>
              <span>Tiếng Việt</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
