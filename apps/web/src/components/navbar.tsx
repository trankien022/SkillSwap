'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { BrandMark } from './BrandMark';
import type { WalletBalanceView, MeResponse } from '@skillswap/contracts';
import {
  callApi,
  getTokens,
  getStoredUser,
  logout,
  unwrapEnvelope,
  WALLET_BALANCE_EVENT,
  type UserProfile,
} from '../lib/api-client';

export type NavbarTab =
  | 'explore'
  | 'classes'
  | 'instructor'
  | 'wallet'
  | 'verification'
  | 'skills'
  | 'notifications'
  | 'verifier'
  | 'admin';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [internalBalance, setInternalBalance] = useState<WalletBalanceView | null>(null);
  const [internalMe, setInternalMe] = useState<MeResponse | null>(null);
  const [hasTokens, setHasTokens] = useState<boolean>(false);
  const [storedUser, setStoredUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const tokens = getTokens();
    setHasTokens(Boolean(tokens));
    setStoredUser(getStoredUser());

    // Listen for in-page balance updates (e.g. after a top-up or booking) so the
    // badge reflects the change without a refetch.
    const handleBalanceEvent = (e: Event) => {
      const customEvent = e as CustomEvent<WalletBalanceView>;
      if (customEvent.detail) {
        setInternalBalance(customEvent.detail);
      }
    };
    window.addEventListener(WALLET_BALANCE_EVENT, handleBalanceEvent);

    // Signed out there is nothing to fetch: `/wallet/balance` and `/auth/me`
    // both answer 401, which is what produced the unauthenticated requests (and
    // console noise) on the auth page. The nav renders its guest shape instead.
    if (!tokens && propBalance === undefined && propMe === undefined) {
      return () => {
        window.removeEventListener(WALLET_BALANCE_EVENT, handleBalanceEvent);
      };
    }

    // Only fetch if not supplied via props
    if (propBalance === undefined || propMe === undefined) {
      const load = async () => {
        try {
          const [balRes, meRes] = await Promise.all([
            propBalance === undefined ? callApi('/wallet/balance') : Promise.resolve(null),
            propMe === undefined ? callApi('/auth/me') : Promise.resolve(null),
          ]);
          if (balRes && balRes.ok) {
            // The server is the single source of truth for the balance.
            setInternalBalance(await unwrapEnvelope<WalletBalanceView>(balRes));
          }
          if (meRes && meRes.ok) {
            const meData = await unwrapEnvelope<MeResponse>(meRes);
            setInternalMe(meData);
            setStoredUser({
              id: meData.id,
              email: meData.email,
              displayName: meData.displayName,
              role: meData.role,
              studentVerificationStatus: meData.studentVerification?.status,
            });
          }
        } catch (e) {
          console.warn('Navbar failed to load auth/wallet summary', e);
        }
      };
      load();
    }

    return () => {
      window.removeEventListener(WALLET_BALANCE_EVENT, handleBalanceEvent);
    };
  }, [propBalance, propMe]);

  const balance = propBalance !== undefined ? propBalance : internalBalance;
  const me = propMe !== undefined ? propMe : internalMe;

  // The locale comes from next-intl, which resolves it identically on the server
  // and the client. This previously read `window.location.pathname`, falling back
  // to 'vi' whenever `window` was undefined — so the server rendered Vietnamese
  // hrefs/labels while the client rendered English ones and every page with this
  // navbar failed hydration on the /en tree.
  const locale = useLocale();

  // Post-auth the nav is role-aware (ADR-029 / ADR-030): a guest sees only the
  // public entry points, and the Verifier queue is offered only to a Verifier.
  // The guest shape must be identical on the server and the client — it is
  // derived from `hasTokens`/`me`, both of which resolve after mount, so the
  // first paint is the guest shape on both sides and there is no mismatch.
  //
  // A `balance`/`me` supplied as a prop is itself proof of a session (the
  // dashboards fetch those server-side), so it counts even before the token
  // read lands on the client.
  const signedIn = hasTokens || me !== null || propMe !== undefined || propBalance !== undefined;
  const isVerifier = me?.role === 'verifier' || storedUser?.role === 'verifier';
  const isAdmin = me?.role === 'admin' || storedUser?.role === 'admin';

  const navLinks: { id: NavbarTab; label: string; tooltip?: string; href: string }[] = [
    { id: 'explore', label: locale === 'vi' ? 'Khám phá' : 'Explore', href: `/${locale}/classes` },
    ...(signedIn
      ? ([
          {
            id: 'classes',
            label: locale === 'vi' ? 'Lớp học của tôi' : 'My Bookings',
            href: `/${locale}/bookings`,
          },
          {
            id: 'instructor',
            label: locale === 'vi' ? 'Giảng dạy' : 'Teaching',
            tooltip: locale === 'vi' ? 'Studio Giảng dạy' : 'Teaching Studio',
            href: `/${locale}/instructor`,
          },
          {
            id: 'wallet',
            label: locale === 'vi' ? 'Ví & Tín dụng' : 'Wallet & Credits',
            href: `/${locale}/wallet`,
          },
        ] as const)
      : []),
    {
      id: 'skills',
      label: locale === 'vi' ? 'Kỹ năng' : 'Skills',
      tooltip: locale === 'vi' ? 'Kỹ năng & Bằng chứng' : 'Skills & Evidence',
      href: `/${locale}/skills`,
    },
    {
      id: 'verification',
      label: locale === 'vi' ? 'Xác minh' : 'Verification',
      tooltip: locale === 'vi' ? 'Trung tâm Thẩm định & Xác minh' : 'Verification Center',
      href: `/${locale}/verification`,
    },
    // The admin landing exists as a route now; without this entry an admin
    // had no way back to their own screens after signing in.
    ...(isAdmin
      ? ([
          {
            id: 'admin',
            label: locale === 'vi' ? 'Quản trị' : 'Admin',
            tooltip: locale === 'vi' ? 'Trang quản trị' : 'Admin home',
            href: `/${locale}/admin`,
          },
        ] as const)
      : []),
    // Only a Verifier can use the queue (`GET /verifiers/me/queue` is
    // role-guarded), so offering the link to everyone was a dead end.
    ...(isVerifier
      ? ([
          {
            id: 'verifier',
            label: locale === 'vi' ? 'Hàng đợi duyệt' : 'Verifier Queue',
            tooltip: locale === 'vi' ? 'Hàng đợi duyệt kỹ năng' : 'Skill verification queue',
            href: `/${locale}/verifier`,
          },
        ] as const)
      : []),
  ];

  const availableCredits = balance ? balance.availableCredits : 0;
  const displayName =
    me?.displayName ||
    storedUser?.displayName ||
    (storedUser?.email
      ? storedUser.email.split('@')[0]
      : hasTokens
        ? locale === 'vi'
          ? 'Học viên'
          : 'Learner'
        : '');
  const initials = displayName
    ? displayName
        .split(' ')
        .filter(Boolean)
        .slice(-2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : 'SS';
  const isVerified =
    me?.studentVerification?.status === 'approved' ||
    storedUser?.studentVerificationStatus === 'approved';

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 xl:px-8 min-h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand Logo & Main Nav */}
        <div className="flex items-center gap-3 xl:gap-8 min-w-0">
          <a href={`/${locale}/classes`} className="flex items-center gap-2.5 group shrink-0">
            <BrandMark />
            <span className="whitespace-nowrap text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold leading-none border border-emerald-100 hidden sm:inline-block">
              {locale === 'vi' ? 'Sinh viên' : 'Students'}
            </span>
          </a>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="product-navigation"
          className="ml-auto inline-flex min-h-11 items-center px-2 text-sm font-medium text-ink md:hidden"
        >
          {locale === 'vi' ? 'Menu' : 'Menu'}
        </button>
        {/* Account controls */}
        <div className="flex items-center gap-2 sm:gap-2.5 xl:gap-3 shrink-0">
          {/* Credit balance badge — only once a session exists. A guest has no
              wallet, so showing a hardcoded 0 was both noise and a dead link. */}
          {signedIn && (
            <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 pl-2 sm:pl-2.5 pr-1.5 py-1 rounded-lg bg-mist border border-border text-xs font-semibold text-slate-900 shrink-0 whitespace-nowrap">
              <span className="material-symbols-outlined text-[17px] text-emerald-600">toll</span>
              <span className="whitespace-nowrap" data-testid="navbar-credits">
                {availableCredits.toLocaleString('vi-VN')} Credits
              </span>
              <a
                href={`/${locale}/wallet`}
                title={locale === 'vi' ? 'Nạp credit' : 'Top up credits'}
                className="w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors text-xs font-bold leading-none shrink-0"
              >
                +
              </a>
            </div>
          )}

          {/* Notification Center Bell Link — notifications require a session. */}
          {signedIn && (
            <a
              href={`/${locale}/notifications`}
              title={locale === 'vi' ? 'Thông báo' : 'Notifications'}
              className={`w-11 h-11 rounded-lg flex items-center justify-center transition-colors relative shrink-0 ${
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
          )}

          <div className="h-5 w-px bg-slate-200 hidden sm:block shrink-0"></div>

          {/* User profile or Sign In */}
          {signedIn ? (
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`/${locale}/status`}
                className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0"
                title={locale === 'vi' ? 'Hồ sơ và xác minh' : 'Profile and verification'}
              >
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center ring-2 ring-emerald-50 text-emerald-800 font-semibold text-xs shrink-0">
                  {initials}
                </div>
                <div className="hidden sm:flex flex-col text-left min-w-0 max-w-[72px] md:max-w-[85px] lg:max-w-[95px] xl:max-w-[130px]">
                  <span
                    className="text-xs font-semibold text-slate-900 leading-tight truncate block"
                    title={displayName}
                  >
                    {displayName}
                  </span>
                  <span
                    className="text-[11px] text-slate-500 leading-tight truncate block"
                    title={
                      isVerified
                        ? locale === 'vi'
                          ? 'SV đã xác minh'
                          : 'Verified Student'
                        : locale === 'vi'
                          ? 'Học viên'
                          : 'Learner'
                    }
                  >
                    {isVerified
                      ? locale === 'vi'
                        ? 'SV đã xác minh'
                        : 'Verified Student'
                      : locale === 'vi'
                        ? 'Học viên'
                        : 'Learner'}
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
                className="min-h-11 min-w-11 p-2 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          ) : (
            <a
              href={`/${locale}/auth?tab=login`}
              className="rounded-full bg-emerald-600 inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors shrink-0 whitespace-nowrap"
            >
              {locale === 'vi' ? 'Đăng nhập' : 'Sign In'}
            </a>
          )}
        </div>
      </div>
      <nav
        id="product-navigation"
        aria-label={locale === 'vi' ? 'Điều hướng chính' : 'Main navigation'}
        className={`mx-auto max-w-7xl gap-x-5 px-4 sm:px-6 xl:px-8 md:flex ${menuOpen ? 'grid grid-cols-2' : 'hidden'}`}
      >
        {navLinks.map((link) => {
          const isActive = currentTab === link.id;
          return (
            <a
              key={link.id}
              href={link.href}
              title={link.tooltip || link.label}
              aria-current={isActive ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center border-b-2 text-sm transition-colors ${
                isActive
                  ? 'border-ink text-ink font-semibold'
                  : 'border-transparent font-medium text-ink-soft hover:text-ink'
              }`}
            >
              {link.label}
            </a>
          );
        })}
      </nav>
    </header>
  );
}
