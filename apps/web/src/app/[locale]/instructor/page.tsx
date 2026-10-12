'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { callApi, unwrapEnvelope } from '../../../lib/api-client';
import { Navbar } from '../../../components/navbar';
import type {
  ProfileSkillView,
  WalletBalanceView,
  MeResponse,
  ListClassesPageView,
} from '@skillswap/contracts';

/**
 * A class in the teacher's own list, mapped from `GET /classes?teacherId=me`.
 *
 * The API describes a class with `description` (there is no separate title
 * column), so `description` is shown as-is rather than being truncated into a
 * synthetic "title" — a truncated string presented as a title is a different
 * claim from the full description.
 */
export interface TeacherClassItem {
  id: string;
  description: string;
  startsAt: string;
  durationMinutes: number;
  priceCredits: number;
  capacity: number;
  confirmedBookingsCount: number;
  availableSeats: number;
  state: string;
}

/** The class lifecycle states that mean "this class is over". */
const COMPLETED_CLASS_STATES = new Set(['completed', 'cancelled']);

export default function InstructorDashboard() {
  const locale = useLocale();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [skills, setSkills] = useState<ProfileSkillView[]>([]);
  const [balance, setBalance] = useState<WalletBalanceView | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [classes, setClasses] = useState<TeacherClassItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<'all' | 'upcoming' | 'open' | 'completed'>('all');

  useEffect(() => {
    let active = true;

    async function loadData() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [skillsRes, balRes, meRes, classesRes] = await Promise.all([
          callApi('/profile-skills/me'),
          callApi('/wallet/balance'),
          callApi('/auth/me'),
          callApi('/classes?teacherId=me'),
        ]);

        if (!active) return;

        if (skillsRes.ok) {
          const data = await unwrapEnvelope<{ items: ProfileSkillView[] }>(skillsRes);
          if (Array.isArray(data.items)) setSkills(data.items);
        }

        if (balRes.ok) {
          setBalance(await unwrapEnvelope<WalletBalanceView>(balRes));
        }

        if (meRes.ok) {
          setMe(await unwrapEnvelope<MeResponse>(meRes));
        }

        if (classesRes.ok) {
          const page = await unwrapEnvelope<ListClassesPageView>(classesRes);
          if (page && Array.isArray(page.items)) {
            // Read straight from the server. There is deliberately no localStorage
            // cache: the list is server-owned, and a local copy is how this screen
            // and the publish screen came to disagree about which classes existed.
            setClasses(
              page.items.map((item) => ({
                id: item.id,
                description: item.description,
                startsAt: item.startsAt,
                durationMinutes: item.durationMinutes,
                priceCredits: item.priceCredits,
                capacity: item.capacity,
                confirmedBookingsCount: item.confirmedBookingsCount,
                availableSeats: item.availableSeats,
                state: item.state,
              })),
            );
          }
        } else if (classesRes.status === 401) {
          setLoadError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        } else {
          setLoadError('Không tải được danh sách lớp giảng dạy.');
        }
      } catch (err) {
        if (active) {
          setLoadError(err instanceof Error ? err.message : 'Không tải được dữ liệu giảng dạy.');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCompleteClass = async (classId: string) => {
    try {
      setIsProcessing(true);
      const res = await callApi(`/classes/${classId}/complete`, { method: 'POST' });
      if (!res.ok) {
        if (res.status === 409) throw new Error('Lớp này đã hoàn thành hoặc chưa đủ điều kiện');
        throw new Error('Lỗi hệ thống');
      }
      showToast('Đã hoàn thành lớp. Doanh thu đã được giải ngân vào ví.');

      // Re-read the wallet and the class list, so the screen shows server truth
      // after the money moved.
      const [balRes, classesRes] = await Promise.all([
        callApi('/wallet/balance'),
        callApi('/classes?teacherId=me'),
      ]);
      if (balRes.ok) setBalance(await unwrapEnvelope<WalletBalanceView>(balRes));
      if (classesRes.ok) {
        const page = await unwrapEnvelope<ListClassesPageView>(classesRes);
        if (Array.isArray(page?.items)) {
          setClasses(
            page.items.map((item) => ({
              id: item.id,
              description: item.description,
              startsAt: item.startsAt,
              durationMinutes: item.durationMinutes,
              priceCredits: item.priceCredits,
              capacity: item.capacity,
              confirmedBookingsCount: item.confirmedBookingsCount,
              availableSeats: item.availableSeats,
              state: item.state,
            })),
          );
        }
      }
    } catch (e) {
      showToast('Lỗi: ' + (e as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const approvedSkills = skills.filter((s) => s.approvedLevel !== null);
  const upcomingCount = classes.filter((c) => !COMPLETED_CLASS_STATES.has(c.state)).length;
  const completedCount = classes.filter((c) => COMPLETED_CLASS_STATES.has(c.state)).length;

  const visibleClasses = classes.filter((c) => {
    if (classFilter === 'all') return true;
    if (classFilter === 'completed') return COMPLETED_CLASS_STATES.has(c.state);
    return !COMPLETED_CLASS_STATES.has(c.state);
  });

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 relative">
      <Navbar currentTab="instructor" balance={balance} me={me} />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full">
          {/* 1. Profile summary — name and avatar come from the session, with a
              neutral placeholder while they load. No invented identity. */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-200">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-slate-200 shadow-sm ring-1 ring-slate-200 flex items-center justify-center text-slate-600 font-bold text-2xl">
                  {(me?.displayName ?? '').slice(0, 2).toUpperCase() || '—'}
                </div>
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center ring-2 ring-white">
                  <span className="material-symbols-outlined text-[12px]">verified</span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-2xl text-slate-900 tracking-tight">
                    {me?.displayName ?? 'Đang tải…'}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{' '}
                    {me?.studentVerification?.status === 'approved'
                      ? 'Giảng viên đã xác minh'
                      : me?.studentVerification?.status === 'pending'
                        ? 'Đang xét duyệt'
                        : 'Chưa xác minh sinh viên'}
                  </span>
                </div>
                {me?.email !== undefined && (
                  <p className="text-sm text-slate-600 mt-0.5 font-normal">{me.email}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={`/${locale}/wallet`}
                className="px-4 py-2.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-all shadow-sm"
              >
                Lịch sử giao dịch
              </a>
              <a
                href={`/${locale}/teach/classes/new`}
                className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold text-sm px-5 py-2.5 rounded-full shadow-sm transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[19px]">add_circle</span>
                Công bố Lớp học mới
              </a>
            </div>
          </div>

          {/* 2. KPI summary. Each tile shows a value the server actually reports.
              The previous version also showed a completion rate, a 4.9/5 rating
              and a review count; those came from nowhere (the schema marks the
              rating fields as provisional) so they are omitted rather than
              made up. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-8">
            <MetricCard
              label="Doanh thu khả dụng"
              icon="account_balance_wallet"
              value={balance ? balance.availableCredits.toLocaleString('vi-VN') : '—'}
              unit="Credit"
              sub={
                balance
                  ? `≈ ${(balance.availableCredits * 1000).toLocaleString('vi-VN')} VNĐ`
                  : undefined
              }
              footer={
                <a
                  href={`/${locale}/wallet/withdrawal`}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
                >
                  Rút về ngân hàng{' '}
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </a>
              }
            />

            <MetricCard
              label="Tạm giữ theo lớp"
              icon="lock_clock"
              value={balance ? balance.pendingCredits.toLocaleString('vi-VN') : '—'}
              unit="Credit"
              sub="Doanh thu Escrow chờ kết thúc lớp"
              footer={
                <span className="text-xs text-slate-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Giải ngân sau
                  khi kết thúc buổi dạy
                </span>
              }
            />

            <MetricCard
              label="Lớp đang mở"
              icon="school"
              value={isLoading ? '—' : String(upcomingCount)}
              unit="lớp"
              sub="Lớp đã công bố và chưa kết thúc"
            />

            <MetricCard
              label="Đã xong"
              icon="task_alt"
              value={isLoading ? '—' : String(completedCount)}
              unit="lớp"
              sub="Lớp đã hoàn thành hoặc đã hủy"
            />
          </div>

          {/* 3. Approved skills — real list, or an honest empty state. The old
              demo fallback cards named a verifier ("Thầy Hùng") who is not in
              the system. */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-lg text-slate-900">Kỹ năng được duyệt giảng dạy</h2>
                <p className="text-xs text-slate-600">
                  Các chủ đề bạn đã hoàn tất kiểm định và có thể mở lớp bất kỳ lúc nào
                </p>
              </div>
              <a
                href={`/${locale}/verification`}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">add</span> Thêm kỹ năng mới
              </a>
            </div>

            {approvedSkills.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {approvedSkills.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md text-emerald-700 bg-emerald-50">
                          <span className="material-symbols-outlined text-[12px]">verified</span>
                          Đã duyệt
                        </span>
                        <span className="text-[11px] font-medium text-slate-500 capitalize">
                          {s.approvedLevel}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm mb-1">{s.skillName}</h3>
                      <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                        Danh mục: {s.category}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">Mã: {s.skillId.slice(0, 8)}</span>
                      <a
                        href={`/${locale}/teach/classes/new`}
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                      >
                        Mở lớp →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white p-6 rounded-2xl border border-dashed border-slate-300 text-center">
                <p className="text-sm font-semibold text-slate-800">
                  Chưa có kỹ năng nào được duyệt
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Theo quy chuẩn kiểm định, bạn chỉ có thể mở lớp cho kỹ năng đã qua hội đồng
                  chuyên môn.
                </p>
                <a
                  href={`/${locale}/verification`}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700"
                >
                  Gửi kỹ năng để xác thực
                </a>
              </div>
            )}
          </div>

          {/* 4. Classes — the teacher's own list, straight from the server. The
              previous version appended three hardcoded demo cards with fake
              booking links. */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-bold text-lg text-slate-900">Lịch giảng dạy &amp; Lớp học</h2>
                <p className="text-xs text-slate-600">
                  Các lớp bạn đã công bố trên hệ thống
                </p>
              </div>
              <div className="inline-flex items-center p-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold">
                <FilterButton
                  active={classFilter === 'all'}
                  onClick={() => setClassFilter('all')}
                  label={`Tất cả (${classes.length})`}
                />
                <FilterButton
                  active={classFilter === 'upcoming'}
                  onClick={() => setClassFilter('upcoming')}
                  label={`Sắp diễn ra (${upcomingCount})`}
                />
                <FilterButton
                  active={classFilter === 'completed'}
                  onClick={() => setClassFilter('completed')}
                  label={`Đã xong (${completedCount})`}
                />
              </div>
            </div>

            {isLoading ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-sm text-slate-500">
                Đang tải danh sách lớp…
              </div>
            ) : loadError !== null ? (
              <div
                role="alert"
                className="bg-white p-8 rounded-2xl border border-rose-200 text-center text-sm font-medium text-rose-700"
              >
                {loadError}
              </div>
            ) : visibleClasses.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center">
                <p className="text-sm font-semibold text-slate-800">Chưa có lớp học nào</p>
                <p className="mt-1 text-xs text-slate-600">
                  Các lớp bạn công bố sẽ xuất hiện ở đây.
                </p>
                <a
                  href={`/${locale}/teach/classes/new`}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700"
                >
                  Công bố lớp học đầu tiên
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                {visibleClasses.map((item) => {
                  const isCompleted = COMPLETED_CLASS_STATES.has(item.state);
                  return (
                    <div
                      key={item.id}
                      className={`bg-white p-5 rounded-2xl border shadow-sm transition-all ${
                        isCompleted
                          ? 'border-slate-200 opacity-90 hover:opacity-100'
                          : 'border-emerald-200 hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                isCompleted
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {isCompleted ? 'Đã kết thúc' : 'Đang mở đăng ký'}
                            </span>
                            <span className="text-xs text-slate-600 font-medium">
                              {item.availableSeats} chỗ trống
                            </span>
                          </div>
                          <h3 className="font-bold text-slate-900 text-base">{item.description}</h3>
                          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600">
                            <span className="flex items-center gap-1 text-slate-900 font-medium">
                              <span className="material-symbols-outlined text-[16px] text-emerald-600">
                                calendar_today
                              </span>{' '}
                              {new Date(item.startsAt).toLocaleDateString('vi-VN')}{' '}
                              {new Date(item.startsAt).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              • {item.durationMinutes} phút
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[16px] text-slate-500">
                                group
                              </span>{' '}
                              {item.confirmedBookingsCount}/{item.capacity} học viên
                            </span>
                            <span className="flex items-center gap-1 text-slate-900 font-semibold">
                              <span className="material-symbols-outlined text-[16px] text-emerald-600">
                                payments
                              </span>{' '}
                              {item.priceCredits} Credit / học viên
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0 pt-2 lg:pt-0">
                          <span className="text-[11px] text-slate-500 font-mono">
                            {item.id.slice(0, 8)}
                          </span>
                          {!isCompleted && (
                            <button
                              onClick={() => handleCompleteClass(item.id)}
                              type="button"
                              className="px-4 py-2 rounded-full text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-60"
                              disabled={isProcessing}
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                check_circle
                              </span>{' '}
                              Hoàn thành
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Toast */}
      <div
        className={`fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 transition-all duration-300 ${
          toastMessage ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
        }`}
      >
        <span className="material-symbols-outlined text-[18px] text-emerald-400">check_circle</span>
        <span className="text-xs font-medium">{toastMessage}</span>
      </div>
    </div>
  );
}

/* --- Small presentational helpers --- */

function MetricCard({
  label,
  icon,
  value,
  unit,
  sub,
  footer,
}: {
  label: string;
  icon: string;
  value: string;
  unit: string;
  sub?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between text-slate-600 text-xs font-medium mb-2">
          <span>{label}</span>
          <span className="material-symbols-outlined text-slate-400 text-[18px]">{icon}</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-bold text-2xl text-slate-900">{value}</span>
          <span className="text-xs font-semibold text-slate-600">{unit}</span>
        </div>
        {sub !== undefined && (
          <span className="text-xs text-slate-500 font-normal">{sub}</span>
        )}
      </div>
      {footer !== undefined && (
        <div className="mt-4 pt-3 border-t border-slate-100">{footer}</div>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg transition-colors ${
        active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );
}
