'use client';

import { useState } from 'react';

interface NotificationItem {
  id: string;
  category: 'booking' | 'finance' | 'verify';
  unread: boolean;
  dateGroup: 'today' | 'yesterday' | 'earlier';
  title: string;
  badge: string;
  badgeColor: string;
  timeText: string;
  tag?: string;
  content: string;
  highlightText?: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  barColor: string;
  metaLeft?: string;
  metaIcon?: string;
  actionPrimary?: { label: string; action: () => void; icon?: string };
  actionSecondary?: { label: string; href?: string; action?: () => void; icon?: string };
  linkText?: string;
  rating?: number;
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread' | 'booking' | 'finance' | 'verify'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('minh.nguyen@rmit.edu.vn');
  const [frequency, setFrequency] = useState<'instant' | 'daily' | 'weekly'>('instant');

  const [items, setItems] = useState<NotificationItem[]>([
    {
      id: 'notif-1',
      category: 'booking',
      unread: true,
      dateGroup: 'today',
      title: 'Booking Xác nhận',
      badge: 'Escrow Protected',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      timeText: '15 phút trước',
      content: 'Bạn đã đặt thành công lớp "Luyện Speaking IELTS 6.5+" vào 19:30 tối mai. 100 Credits đã được khóa an toàn vào hợp đồng Escrow.',
      highlightText: '100 Credits đã khóa',
      icon: 'event_available',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-700',
      barColor: 'bg-emerald-600',
      metaLeft: 'Mã Escrow: #ESC-94827 · Hoàn tiền tự động nếu hủy trước 6h',
      metaIcon: 'lock',
      actionSecondary: {
        label: 'Xem chi tiết lớp',
        href: '/vi/instructor#classes',
        icon: 'open_in_new',
      },
      actionPrimary: {
        label: 'Thêm vào Google Calendar',
        icon: 'calendar_add_on',
        action: () => showToast('Đã tạo liên kết sự kiện Google Calendar!'),
      },
    },
    {
      id: 'notif-2',
      category: 'booking',
      unread: true,
      dateGroup: 'today',
      title: 'Nhắc nhở giờ học',
      badge: 'Bắt đầu sau 30 phút',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
      timeText: '28 phút trước',
      content: 'Lớp học "Lập trình Python cơ bản" sẽ bắt đầu sau 30 phút. Nút vào phòng học Jitsi mã hóa E2E đã được kích hoạt!',
      icon: 'video_camera_front',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-700',
      barColor: 'bg-amber-500',
      metaLeft: 'Host: Hoàng Nam · Jitsi Room ID: swap-py-402',
      metaIcon: 'sensors',
      actionPrimary: {
        label: 'Vào phòng học ngay',
        icon: 'login',
        action: () => showToast('Đang kết nối vào phòng Jitsi Meet: swap-py-402...'),
      },
    },
    {
      id: 'notif-3',
      category: 'finance',
      unread: true,
      dateGroup: 'today',
      title: 'Biến động số dư',
      badge: '+200 Credits',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      timeText: '2 giờ trước',
      content: 'Bạn vừa nạp thành công 200 Credits qua VietQR Napas 24/7. Số dư khả dụng hiện tại: 150 Credits (đã trừ 100 Credits đang giữ trong Escrow).',
      icon: 'account_balance_wallet',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      barColor: 'bg-emerald-600',
      metaLeft: 'Giao dịch #NAPAS-8392193 · Phí: 0đ',
      linkText: 'Chi tiết Ví Tín dụng →',
      actionSecondary: {
        label: 'Chi tiết Ví Tín dụng',
        href: '/vi/wallet',
      },
    },
    {
      id: 'notif-4',
      category: 'verify',
      unread: false,
      dateGroup: 'yesterday',
      title: 'Xác minh năng lực Teacher',
      badge: 'Verified Tutor C1',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      timeText: 'Hôm qua, 16:42',
      content: 'Chúc mừng! Hồ sơ năng lực Kỹ năng IELTS Speaking (Level: C1/8.0+) của bạn đã được Verifier Thầy Hùng phê duyệt thành công với điểm tín nhiệm cao.',
      icon: 'verified_user',
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-700',
      barColor: 'bg-indigo-600',
      metaLeft: 'Huy hiệu: Verified Tutor C1 · Tối đa 5 slot/tuần',
      actionPrimary: {
        label: 'Công bố lớp học ngay',
        icon: 'add_circle',
        action: () => {
          window.location.href = '/vi/instructor';
        },
      },
    },
    {
      id: 'notif-5',
      category: 'finance',
      unread: false,
      dateGroup: 'yesterday',
      title: 'Rút tiền thành công',
      badge: 'Hoàn tất',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      timeText: 'Hôm qua, 10:15',
      content: 'Yêu cầu rút 800.000 VNĐ mã #WD-8820 đã được chuyển khoản thành công vào tài khoản Vietcombank (*9823).',
      icon: 'payments',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      barColor: 'bg-emerald-600',
      metaLeft: 'Mã giao dịch: #WD-8820 · Vietcombank',
      linkText: 'Tải biên lai PDF',
      actionSecondary: {
        label: 'Tải biên lai PDF',
        action: () => showToast('Đang tải biên lai xác nhận giao dịch...'),
      },
    },
    {
      id: 'notif-6',
      category: 'booking',
      unread: false,
      dateGroup: 'earlier',
      title: 'Đánh giá & Nghiệm thu',
      badge: '5.0 Sao',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      timeText: '3 ngày trước',
      content: 'Học viên Minh Nguyễn vừa gửi đánh giá 5 sao cho buổi học "UI/UX Figma căn bản" kèm lời khen: "Hướng dẫn rất tận tình, bài tập thực tế bổ ích."',
      icon: 'star',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      barColor: 'bg-amber-500',
      rating: 5,
      linkText: 'Gửi lời cảm ơn →',
      actionSecondary: {
        label: 'Gửi lời cảm ơn →',
        action: () => showToast('Đã gửi tin nhắn cảm ơn đến học viên!'),
      },
    },
    {
      id: 'notif-7',
      category: 'verify',
      unread: false,
      dateGroup: 'earlier',
      title: 'Cảnh báo hệ thống & Bảo mật Escrow',
      badge: 'Bảo mật',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-100',
      timeText: '4 ngày trước',
      content: 'Nhắc nhở an toàn: Không chia sẻ thông tin Zalo, tài khoản ngân hàng cá nhân hoặc nhận thanh toán ngoài hệ thống để bảo đảm quyền lợi bảo vệ hoàn tiền 100% của cơ chế SkillSwap Escrow.',
      icon: 'shield_with_heart',
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      barColor: 'bg-rose-500',
      metaLeft: 'Chính sách hoàn tiền bảo vệ người học và giảng viên',
      linkText: 'Xem quy chế giao dịch →',
      actionSecondary: {
        label: 'Xem quy chế giao dịch →',
        action: () => showToast('Mở tài liệu: Quy chế Escrow SkillSwap'),
      },
    },
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleMarkAllRead = () => {
    setItems((prev) => prev.map((item) => ({ ...item, unread: false })));
    showToast('Đã đánh dấu tất cả thông báo là đã đọc!');
  };

  const handleMarkSingleRead = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unread: false } : item)),
    );
    showToast('Đã đánh dấu thông báo là đã đọc.');
  };

  const unreadCount = items.filter((i) => i.unread).length;
  const bookingCount = items.filter((i) => i.category === 'booking').length;
  const financeCount = items.filter((i) => i.category === 'finance').length;
  const verifyCount = items.filter((i) => i.category === 'verify').length;

  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return item.unread;
    return item.category === filter;
  });

  const todayItems = filteredItems.filter((i) => i.dateGroup === 'today');
  const yesterdayItems = filteredItems.filter((i) => i.dateGroup === 'yesterday');
  const earlierItems = filteredItems.filter((i) => i.dateGroup === 'earlier');

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 text-slate-900 antialiased">
      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Top Action / Context Row */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold px-2 py-0.5 rounded bg-emerald-50 border border-emerald-100">
                  PRD §6.8 · Realtime Event Stream
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                <span className="text-xs font-medium text-slate-500">FR-016 Notification Center</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Trung tâm Thông báo
              </h1>
              <p className="text-sm text-slate-600 max-w-2xl">
                Theo dõi trạng thái hợp đồng Escrow tín dụng, phiên học Jitsi bảo mật, phê duyệt năng lực bởi hội đồng kiểm định và biến động tài khoản.
              </p>
            </div>

            {/* Quick Action Utilities */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-slate-600">done_all</span>
                <span>Đánh dấu đã đọc tất cả</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">tune</span>
                <span>Cài đặt thông báo qua Email</span>
              </button>
            </div>
          </div>

          {/* Main Grid: Feed List (Col 8) + Sidebar Widgets (Col 4) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Primary Column: Tabs Filter + Feed */}
            <div className="lg:col-span-8 flex flex-col space-y-4">
              {/* Filter Tabs Bar */}
              <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm overflow-x-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    filter === 'all'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span>Tất cả</span>
                  <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${filter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {items.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('unread')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    filter === 'unread'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span>Chưa đọc</span>
                  <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${filter === 'unread' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600'}`}>
                    {unreadCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('booking')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    filter === 'booking'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span>Lớp học &amp; Booking</span>
                  <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${filter === 'booking' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {bookingCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('finance')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    filter === 'finance'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span>Tài chính &amp; Ví</span>
                  <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${filter === 'finance' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {financeCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('verify')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    filter === 'verify'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span>Xác minh &amp; Hồ sơ</span>
                  <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${filter === 'verify' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {verifyCount}
                  </span>
                </button>
              </div>

              {/* Empty State */}
              {filteredItems.length === 0 && (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
                  <span className="material-symbols-outlined text-[40px] text-slate-400">notifications_off</span>
                  <h3 className="font-bold text-base text-slate-900">Không có thông báo nào</h3>
                  <p className="text-xs text-slate-500">Mục này hiện tại chưa có thông báo mới.</p>
                </div>
              )}

              {/* Feed: Today */}
              {todayItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">Hôm nay</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">
                        {todayItems.length} cập nhật
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">07/04/2025</span>
                  </div>

                  {todayItems.map((item) => (
                    <NotificationCard
                      key={item.id}
                      item={item}
                      onMarkRead={() => handleMarkSingleRead(item.id)}
                    />
                  ))}
                </div>
              )}

              {/* Feed: Yesterday */}
              {yesterdayItems.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">Hôm qua</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                        {yesterdayItems.length} thông báo
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">06/04/2025</span>
                  </div>

                  {yesterdayItems.map((item) => (
                    <NotificationCard
                      key={item.id}
                      item={item}
                      onMarkRead={() => handleMarkSingleRead(item.id)}
                    />
                  ))}
                </div>
              )}

              {/* Feed: Earlier */}
              {earlierItems.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">Trước đó</span>
                      <span className="text-xs text-slate-500">Tuần này</span>
                    </div>
                    <span className="text-xs text-slate-400">04/04/2025</span>
                  </div>

                  {earlierItems.map((item) => (
                    <NotificationCard
                      key={item.id}
                      item={item}
                      onMarkRead={() => handleMarkSingleRead(item.id)}
                    />
                  ))}
                </div>
              )}

              {/* Pagination Bar */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-slate-600 text-xs">
                  <span>Hiển thị</span>
                  <select className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium focus:ring-0">
                    <option>10 thông báo / trang</option>
                    <option>20 thông báo / trang</option>
                  </select>
                  <span>trong tổng số {items.length} thông báo</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    disabled
                    type="button"
                    className="p-1.5 rounded-lg bg-slate-100 text-slate-400 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <button
                    type="button"
                    className="w-7 h-7 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center"
                  >
                    1
                  </button>
                  <button
                    type="button"
                    className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center transition-colors"
                  >
                    2
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Secondary Column: Right Side Controls & Status Panel (Col 4) */}
            <aside className="lg:col-span-4 flex flex-col space-y-6">
              {/* Live Escrow & Active Swap Status Widget */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-slate-900">Tình trạng Tín dụng</span>
                  <span className="material-symbols-outlined text-emerald-600 text-[20px]">
                    sync_saved_locally
                  </span>
                </div>

                {/* Academic Skill Ledger Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-slate-600">
                    <span>
                      Đang khóa trong Escrow: <strong className="text-slate-900 font-semibold">100 Cr</strong>
                    </span>
                    <span>
                      Khả dụng: <strong className="text-emerald-700 font-semibold">150 Cr</strong>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex border border-slate-200">
                    <div
                      className="bg-amber-500 h-full"
                      style={{ width: '40%' }}
                      title="Đang giao dịch (Escrow)"
                    ></div>
                    <div
                      className="bg-emerald-600 h-full"
                      style={{ width: '60%' }}
                      title="Số dư khả dụng"
                    ></div>
                  </div>
                  <div className="flex items-center gap-3 text-xs pt-1 text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span> 40% Đang khóa
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span> 60% Sẵn sàng
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px] flex-shrink-0 mt-0.5">
                    verified
                  </span>
                  <div className="text-xs text-slate-700 leading-snug">
                    Bạn có 1 buổi học đang diễn ra trong hôm nay. Phòng Jitsi sẽ mở tự động 15 phút trước giờ hẹn.
                  </div>
                </div>
              </div>

              {/* Frequency & Notification Preference Settings Panel */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">Tần suất &amp; Kênh gửi</h3>
                    <p className="text-xs text-slate-500">Cấu hình thời gian nhận bản tin</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 text-[20px]">
                    notifications_active
                  </span>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    showToast('Đã lưu cài đặt tần suất gửi thông báo thành công!');
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-900 block">
                      Tần suất gửi Email tổng hợp
                    </label>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-200">
                        <input
                          type="radio"
                          name="frequency"
                          value="instant"
                          checked={frequency === 'instant'}
                          onChange={() => setFrequency('instant')}
                          className="w-4 h-4 text-emerald-600 accent-emerald-600"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-slate-900 leading-tight">
                            Thời gian thực (Tức thì)
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Phù hợp cho lịch học &amp; biến động số dư
                          </span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-200">
                        <input
                          type="radio"
                          name="frequency"
                          value="daily"
                          checked={frequency === 'daily'}
                          onChange={() => setFrequency('daily')}
                          className="w-4 h-4 text-emerald-600 accent-emerald-600"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-slate-900 leading-tight">
                            Bản tin tóm tắt hàng ngày
                          </span>
                          <span className="text-[11px] text-slate-500">Gửi lúc 19:00 hàng ngày</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-200">
                        <input
                          type="radio"
                          name="frequency"
                          value="weekly"
                          checked={frequency === 'weekly'}
                          onChange={() => setFrequency('weekly')}
                          className="w-4 h-4 text-emerald-600 accent-emerald-600"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-slate-900 leading-tight">
                            Tóm lược tuần
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Chỉ nhận các báo cáo tuần &amp; mẹo học
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    <label className="text-xs font-semibold text-slate-900 block">
                      Phân loại kích hoạt
                    </label>
                    <label className="flex items-center justify-between p-2 rounded-lg bg-slate-50 cursor-pointer border border-slate-200 text-xs text-slate-800">
                      <span>Lớp học &amp; Phòng Jitsi</span>
                      <input
                        defaultChecked
                        type="checkbox"
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                    </label>
                    <label className="flex items-center justify-between p-2 rounded-lg bg-slate-50 cursor-pointer border border-slate-200 text-xs text-slate-800">
                      <span>Escrow &amp; Rút tiền Napas</span>
                      <input
                        defaultChecked
                        type="checkbox"
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                    </label>
                    <label className="flex items-center justify-between p-2 rounded-lg bg-slate-50 cursor-pointer border border-slate-200 text-xs text-slate-800">
                      <span>Phê duyệt năng lực &amp; Verifier</span>
                      <input
                        defaultChecked
                        type="checkbox"
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">check</span>
                    <span>Lưu tùy chọn nhận tin</span>
                  </button>
                </form>
              </div>

              {/* System Status Mini Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-900">
                      WebSocket Gateway: Live
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Đồng bộ hóa 0.04s với RMIT Hub
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 font-mono font-medium">v2.4.1</span>
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* Email Settings Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden p-6 space-y-5 border border-slate-200">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">
                  Cài đặt Thông báo qua Email
                </h3>
                <p className="text-xs text-slate-600">
                  Tùy biến địa chỉ nhận thông báo và bộ lọc email khẩn cấp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1">
                  Email nhận thông báo chính thức
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:border-emerald-600 focus:outline-none transition-all"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Email edu đã xác minh thông qua SSO RMIT Vietnam.
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-900">
                  Tự động gửi thông báo khi:
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input defaultChecked type="checkbox" className="w-4 h-4 accent-emerald-600 rounded" />
                  <span>Có học viên đăng ký hoặc hủy lớp trong vòng 24h</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input defaultChecked type="checkbox" className="w-4 h-4 accent-emerald-600 rounded" />
                  <span>Tiền giải ngân từ Escrow vào tài khoản thành công</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input defaultChecked type="checkbox" className="w-4 h-4 accent-emerald-600 rounded" />
                  <span>Verifier yêu cầu bổ sung chứng chỉ kỹ năng</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEmailModalOpen(false);
                  showToast('Đã lưu cấu hình email nhận thông báo thành công!');
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all shadow-sm"
              >
                Áp dụng thay đổi
              </button>
            </div>
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

function NotificationCard({
  item,
  onMarkRead,
}: {
  item: NotificationItem;
  onMarkRead: () => void;
}) {
  return (
    <article
      className={`bg-white p-5 rounded-2xl border transition-all space-y-3 relative overflow-hidden shadow-sm hover:shadow ${
        item.unread ? 'border-slate-300' : 'border-slate-200 opacity-90 hover:opacity-100'
      }`}
    >
      {/* Left indicator bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 ${
          item.unread ? 'w-1' : 'w-0.5 opacity-40'
        } ${item.barColor}`}
      ></div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl ${item.iconBg} flex items-center justify-center flex-shrink-0 ${item.iconColor}`}
          >
            <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                {item.title}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
              <span className="text-[11px] text-slate-500">{item.timeText}</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${item.badgeColor}`}
              >
                {item.badge}
              </span>
            </div>
            <p className="text-sm text-slate-700 leading-snug">{item.content}</p>
          </div>
        </div>

        {/* Mark as read button */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {item.unread ? (
            <button
              type="button"
              onClick={onMarkRead}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              title="Đánh dấu đã đọc"
            >
              <span className="material-symbols-outlined text-[18px]">drafts</span>
            </button>
          ) : (
            <span className="material-symbols-outlined text-[18px] text-slate-300" title="Đã đọc">
              done
            </span>
          )}
        </div>
      </div>

      {/* Contextual Meta & Buttons Footer */}
      {(item.metaLeft || item.actionPrimary || item.actionSecondary || item.rating) && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            {item.metaIcon && (
              <span className="material-symbols-outlined text-[16px] text-slate-400">
                {item.metaIcon}
              </span>
            )}
            {item.metaLeft && <span>{item.metaLeft}</span>}
            {item.rating && (
              <div className="flex items-center gap-0.5 text-amber-500">
                {[...Array(item.rating)].map((_, i) => (
                  <span
                    key={i}
                    className="material-symbols-outlined text-[16px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    star
                  </span>
                ))}
                <span className="text-slate-800 font-semibold ml-1.5">{item.rating}.0 / 5.0</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {item.actionSecondary && (
              <>
                {item.actionSecondary.href ? (
                  <a
                    href={item.actionSecondary.href}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors"
                  >
                    {item.actionSecondary.icon && (
                      <span className="material-symbols-outlined text-[16px] text-slate-500">
                        {item.actionSecondary.icon}
                      </span>
                    )}
                    <span>{item.actionSecondary.label}</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={item.actionSecondary.action}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    {item.actionSecondary.label}
                  </button>
                )}
              </>
            )}

            {item.actionPrimary && (
              <button
                type="button"
                onClick={item.actionPrimary.action}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-all"
              >
                {item.actionPrimary.icon && (
                  <span className="material-symbols-outlined text-[16px]">
                    {item.actionPrimary.icon}
                  </span>
                )}
                <span>{item.actionPrimary.label}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
