'use client';

import { useState, useEffect } from 'react';
import { callApi, unwrapEnvelope, dispatchWalletBalanceUpdate } from '../../../lib/api-client';
import { Navbar } from '../../../components/navbar';
import type { WalletBalanceView, WalletHistoryItemView, MeResponse, TopUpIntentView } from '@skillswap/contracts';

function getCombinedHistory(serverItems: WalletHistoryItemView[]): WalletHistoryItemView[] {
  // The server ledger is the only source of wallet history. An earlier version
  // merged in entries parsed from a `skillswap_user_bookings` localStorage key,
  // inventing a debit (`amountCredits: 90` when the stored value was missing)
  // for each cached booking. That key has no writers left, and a synthesised
  // ledger entry is indistinguishable from a real one to the learner.
  return serverItems;
}

export default function WalletPage() {
  const [balance, setBalance] = useState<WalletBalanceView | null>(null);
  const [history, setHistory] = useState<WalletHistoryItemView[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);

  const [amount, setAmount] = useState(100);
  const [bank, setBank] = useState('VCB');
  const [filter, setFilter] = useState('all');
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setHistory(getCombinedHistory([]));

    const fetchWallet = async () => {
      try {
        const [balRes, histRes, meRes] = await Promise.all([
          callApi('/wallet/balance'),
          callApi('/wallet/history'),
          callApi('/auth/me'),
        ]);

        if (balRes.ok) {
          // Read the balance straight from the server; it is never cached.
          setBalance(await unwrapEnvelope<WalletBalanceView>(balRes));
        } else {
          console.warn('Wallet balance not found or error');
        }

        if (histRes.ok) {
          const data = await unwrapEnvelope<{ items: WalletHistoryItemView[] }>(histRes);
          setHistory(getCombinedHistory(data.items || []));
        } else {
          setHistory(getCombinedHistory([]));
        }

        if (meRes.ok) {
          setMe(await unwrapEnvelope(meRes));
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchWallet();
  }, []);

  const filteredHistory = history.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'deposit') return item.direction === 'credit';
    if (filter === 'pay') return item.direction === 'debit';
    if (filter === 'escrow') return item.type.toLowerCase().includes('escrow') || item.status === 'reversed';
    return true;
  });

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

  const handleTopUp = async () => {
    if (amount <= 0) {
      alert('Số tiền nạp tối thiểu là 10 Credit (10.000 VNĐ)');
      return;
    }
    try {
      setIsPending(true);
      // 1. Create top up intent via authenticated API
      const res = await callApi('/wallet/top-ups', {
        method: 'POST',
        body: JSON.stringify({ amountVnd: amount * 1000 }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          alert('Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập. Vui lòng đăng nhập lại!');
          return;
        }
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        alert(`Không thể tạo yêu cầu nạp tiền: ${err.message || 'Lỗi hệ thống'}`);
        return;
      }

      const intent = await unwrapEnvelope<TopUpIntentView>(res);

      // 2. ADR-030 / design B: the API already submitted the signed checkout
      // form to SePay and returned the hosted payment URL. Hand the user off to
      // SePay; settlement arrives server-to-server as an IPN, never from here.
      const paymentUrl = intent.paymentUrl;
      if (!paymentUrl) {
        alert('Không nhận được đường dẫn thanh toán từ cổng thanh toán. Vui lòng thử lại.');
        return;
      }

      window.open(paymentUrl, '_blank', 'noopener,noreferrer');
      alert(
        'Đã mở trang thanh toán SePay trong tab mới. Sau khi thanh toán xong, quay lại đây và bấm "Tôi đã thanh toán" để cập nhật số dư.',
      );
    } catch (e: unknown) {
      console.error(e);
      const errMsg = e instanceof Error ? e.message : 'Vui lòng thử lại sau.';
      alert(`Không thể hoàn tất nạp tiền: ${errMsg}`);
    } finally {
      setIsPending(false);
    }
  };

  // ADR-030: the IPN settles the intent out of band, so the UI only refreshes
  // the server's own numbers. It never computes the new balance locally.
  const handleRefreshBalance = async () => {
    try {
      const [balRes, histRes] = await Promise.all([
        callApi('/wallet/balance'),
        callApi('/wallet/history'),
      ]);

      if (balRes.ok) {
        const newBal = await unwrapEnvelope<WalletBalanceView>(balRes);
        setBalance(newBal);
        dispatchWalletBalanceUpdate(newBal);
      } else {
        alert('Chưa đọc được số dư mới. Vui lòng tải lại trang.');
      }

      if (histRes.ok) {
        const data = await unwrapEnvelope<{ items: WalletHistoryItemView[] }>(histRes);
        setHistory(getCombinedHistory(data.items || []));
      }
    } catch (e: unknown) {
      console.error(e);
      alert('Không thể cập nhật số dư. Vui lòng tải lại trang.');
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
      <Navbar currentTab="wallet" balance={balance} me={me} />

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
                <span className="text-3xl font-bold text-slate-900 tracking-tight">{balance ? balance.availableCredits : 0}</span>
                <span className="text-sm font-semibold text-emerald-600">Credit</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">≈ {(balance ? balance.availableCredits : 0) * 1000} VNĐ (Tỷ giá 1:1.000đ)</p>
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
                <span className="text-3xl font-bold text-amber-700 tracking-tight">{balance ? balance.pendingCredits : 0}</span>
                <span className="text-sm font-semibold text-amber-700">Credit</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">≈ {(balance ? balance.pendingCredits : 0) * 1000} VNĐ đang khóa an toàn</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-[11px] leading-relaxed text-slate-600 flex items-start gap-1">
                <span className="material-symbols-outlined text-[14px] text-amber-700 shrink-0 mt-0.5">info</span>
                <span>
                  {(balance?.pendingCredits ?? 0) > 0
                    ? `Đang bảo chứng an toàn ${balance?.pendingCredits} Credit cho lớp học đã đăng ký, giải ngân sau buổi học.`
                    : 'Không có khoản tín dụng nào đang bị tạm giữ.'}
                </span>
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
                <span className="text-3xl font-bold text-slate-900 tracking-tight">
                  {history.filter((h) => h.direction === 'debit').reduce((acc, h) => acc + h.amountCredits, 0)}
                </span>
                <span className="text-sm font-semibold text-slate-600">Credit</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                ≈ {(history.filter((h) => h.direction === 'debit').reduce((acc, h) => acc + h.amountCredits, 0) * 1000).toLocaleString('vi-VN')} VNĐ đã sử dụng
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Lớp đã đặt chỗ</span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                  {history.filter((h) => h.direction === 'debit').length} buổi học
                </span>
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
              <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded mt-1.5 ${me?.studentVerification?.status === 'approved' ? 'text-emerald-700 bg-emerald-50' : (me?.studentVerification?.status === 'pending' ? 'text-amber-700 bg-amber-50' : 'text-slate-600 bg-slate-100')}`}>
                {me?.studentVerification?.status === 'approved'
                  ? 'Sinh viên đã xác minh'
                  : me?.studentVerification?.status === 'pending'
                  ? 'Đang chờ duyệt xác minh'
                  : 'Chưa xác minh sinh viên'}
              </span>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-[11px] leading-relaxed text-slate-600 flex items-start gap-1">
                <span className="material-symbols-outlined text-[14px] text-emerald-700 shrink-0 mt-0.5">check_circle</span>
                <span>{me?.studentVerification?.status === 'approved' ? 'Bảo đảm 100% hoàn tín dụng nếu có sự cố.' : 'Xác minh thẻ sinh viên để mở khóa đầy đủ tính năng.'}</span>
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

              <button disabled={isPending} onClick={handleTopUp} className="w-full mt-4 py-2.5 px-4 rounded-full bg-slate-900 hover:bg-slate-800 disabled:opacity-70 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2">
                <span className={`material-symbols-outlined text-[16px] ${isPending ? 'animate-spin' : ''}`}>sync</span>
                {isPending ? 'Đang tạo thanh toán...' : 'Nạp tiền qua SePay'}
              </button>
              <button onClick={handleRefreshBalance} className="w-full mt-2 py-2.5 px-4 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Tôi đã thanh toán - Cập nhật số dư
              </button>
              <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-emerald-600">verified</span>
                Thanh toán an toàn qua cổng SePay • Ví cập nhật ngay khi SePay xác nhận
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
                {filteredHistory.length > 0 ? filteredHistory.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.direction === 'credit' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                          <span className="material-symbols-outlined text-[18px]">
                            {item.direction === 'credit' ? 'add_card' : 'payment'}
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">Giao dịch {item.type}</p>
                          <p className="text-[11px] text-slate-600">Ref: {item.reference || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-3 text-slate-600 font-medium">
                      <div>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</div>
                      <div className="text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleTimeString('vi-VN')}</div>
                    </td>
                    <td className="py-4 px-3">
                      <span className="font-mono font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">#{item.id.slice(0, 8).toUpperCase()}</span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">Hệ thống ghi nhận</span>
                    </td>
                    <td className="py-4 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${item.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                        {item.status === 'completed' ? (
                          <><span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>Thành công</>
                        ) : (
                          <><span className="material-symbols-outlined text-[12px]">undo</span>Đã hoàn</>
                        )}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-right">
                      <span className={`text-sm font-bold ${item.direction === 'credit' ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {item.direction === 'credit' ? '+' : '-'}{item.amountCredits} Credit
                      </span>
                      <span className="block text-[11px] text-slate-500 font-medium">
                        {item.direction === 'credit' ? '+' : '-'}{(item.amountCredits * 1000).toLocaleString('vi-VN')} VNĐ
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Chưa có giao dịch nào
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
