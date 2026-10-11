'use client';

import { useState, useEffect } from 'react';
import type { WalletBalanceView, MeResponse } from '@skillswap/contracts';
import { callApi, getTokens, getStoredUser, logout, type UserProfile } from '../lib/api-client';

export type NavbarTab = 'explore' | 'classes' | 'instructor' | 'wallet' | 'verification' | 'notifications';

export interface NavbarProps {
  currentTab?: NavbarTab;
  balance?: WalletBalanceView | null;
  me?: MeResponse | null;
  unreadNotificationsCount?: number;
}

export function Navbar({
  currentTab,
  balance: propBalance,
  me: propMe,
  unreadNotificationsCount = 3,
}: NavbarProps) {
  const [internalBalance, setInternalBalance] = useState<WalletBalanceView | null>(null);
  const [internalMe, setInternalMe] = useState<MeResponse | null>(null);
  const [hasTokens, setHasTokens] = useState<boolean>(false);
  const [storedUser, setStoredUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    setHasTokens(Boolean(getTokens()));
    setStoredUser(getStoredUser());
    // Only fetch if not supplied via props
    if (propBalance === undefined || propMe === undefined) {
      const load = async () => {
        try {
          const [balRes, meRes] = await Promise.all([
            propBalance === undefined ? callApi('/wallet/balance') : Promise.resolve(null),
            propMe === undefined ? callApi('/auth/me') : Promise.resolve(null),
          ]);
          if (balRes && balRes.ok) {
            setInternalBalance(await balRes.json());
          }
          if (meRes && meRes.ok) {
            const meData = await meRes.json();
            setInternalMe(meData);
            setStoredUser(meData);
          }
        } catch (e) {
          console.warn('Navbar failed to load auth/wallet summary', e);
        }
      };
      load();
    }
  }, [propBalance, propMe]);

  const balance = propBalance !== undefined ? propBalance : internalBalance;
  const me = propMe !== undefined ? propMe : internalMe;

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const locale = pathname.startsWith('/en') ? 'en' : 'vi';

  const navLinks: { id: NavbarTab; label: string; href: string }[] = [
    { id: 'explore', label: locale === 'vi' ? 'Khám phá' : 'Explore', href: `/${locale}/classes` },
    { id: 'classes', label: locale === 'vi' ? 'Lớp học của tôi' : 'My Bookings', href: `/${locale}/bookings` },
    { id: 'instructor', label: locale === 'vi' ? 'Studio Giảng dạy' : 'Teaching Studio', href: `/${locale}/instructor` },
    { id: 'wallet', label: locale === 'vi' ? 'Ví & Tín dụng' : 'Wallet & Credits', href: `/${locale}/wallet` },
    { id: 'verification', label: locale === 'vi' ? 'Quản trị & Xác minh' : 'Verification', href: `/${locale}/status` },
  ];

  const availableCredits = balance ? balance.availableCredits : 0;
  const displayName = me?.displayName || storedUser?.displayName || (storedUser?.email ? storedUser.email.split('@')[0] : (hasTokens ? (locale === 'vi' ? 'Học viên' : 'Learner') : ''));
  const initials = displayName
    ? displayName
        .split(' ')
        .filter(Boolean)
        .slice(-2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : 'SS';
  const isVerified = me?.studentVerification?.status === 'approved' || storedUser?.studentVerificationStatus === 'approved';

  return (
    <header className="sticky top-0 bg-white border-b border-slate-200 z-50 h-16 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        {/* Brand Logo & Main Nav */}
        <div className="flex items-center gap-4 xl:gap-8 min-w-0">
          <a href={`/${locale}/classes`} className="flex items-center gap-2.5 group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-lg transition-transform group-hover:scale-105 shrink-0">
              S
            </div>
            <div className="flex flex-col shrink-0">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-bold text-xl text-slate-900 tracking-tight leading-none whitespace-nowrap">SkillSwap</span>
                <span className="whitespace-nowrap text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold leading-none border border-emerald-100">
                  Sinh viên
                </span>
              </div>
            </div>
          </a>

          <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5 shrink-0">
            {navLinks.map((link) => {
              const isActive = currentTab === link.id;
              return (
                <a
                  key={link.id}
                  href={link.href}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm transition-colors shrink-0 ${
                    isActive
                      ? 'text-emerald-700 bg-emerald-50 font-semibold'
                      : 'font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>
        </div>

        {/* Right Section: Balance, Notification Bell, User profile */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Credit balance badge */}
          <div className="flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-semibold text-slate-900 shrink-0 whitespace-nowrap">
            <span className="material-symbols-outlined text-[17px] text-emerald-600">toll</span>
            <span className="whitespace-nowrap">{availableCredits.toLocaleString('vi-VN')} Credits</span>
            <a
              href={`/${locale}/wallet`}
              title="Nạp thêm Credits"
              className="w-5 h-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors text-xs font-bold leading-none shrink-0"
            >
              +
            </a>
          </div>

          {/* Notification Center Bell Link */}
          <a
            href={`/${locale}/notifications`}
            title="Trung tâm Thông báo"
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors relative shrink-0 ${
              currentTab === 'notifications'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-600 ring-2 ring-white"></span>
            )}
          </a>

          <div className="h-5 w-px bg-slate-200 hidden sm:block shrink-0"></div>

          {/* User profile or Sign In */}
          {hasTokens || me ? (
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`/${locale}/status`}
                className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0"
                title="Hồ sơ & Trạng thái xác minh"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center ring-2 ring-emerald-50 text-emerald-800 font-semibold text-xs shrink-0">
                  {initials}
                </div>
                <div className="hidden sm:flex flex-col text-left min-w-0">
                  <span
                    className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[120px] sm:max-w-[140px] block"
                    title={displayName}
                  >
                    {displayName}
                  </span>
                  <span className="text-[11px] text-slate-500 whitespace-nowrap">
                    {isVerified ? (locale === 'vi' ? 'SV đã xác minh' : 'Verified Student') : (locale === 'vi' ? 'Học viên' : 'Learner')}
                  </span>
                </div>
              </a>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  window.location.href = `/${locale}/auth?tab=login`;
                }}
                title={locale === 'vi' ? 'Đăng xuất' : 'Sign Out'}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          ) : (
            <a
              href={`/${locale}/auth?tab=login`}
              className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-all active:scale-95 shrink-0 whitespace-nowrap"
            >
              {locale === 'vi' ? 'Đăng nhập' : 'Sign In'}
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
