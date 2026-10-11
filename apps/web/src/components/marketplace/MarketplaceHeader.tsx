import { getTranslations } from 'next-intl/server';
import { Link } from '../../i18n/routing';

/**
 * Marketplace header (FR-006).
 *
 * Separate from the landing `SiteHeader` because the post-login "browsing
 * learner" state shows more chrome: school-verified pill, full nav
 * (Explore / My bookings / Manage teaching / Wallet), balance widget,
 * notification bell, and a Learner/Teacher role toggle.
 *
 * For the pilot, only the pieces that don't require a real session are
 * rendered (the brand wordmark and the Explore link). Everything else is
 * hidden until auth is wired in a later increment — see the placeholder
 * `currentUser` constant below. This keeps the surface honest: no fake
 * "150 Credits" balance, no fake "Đã xác minh SV Bách Khoa" pill, no
 * notifications dot.
 */
export async function MarketplaceHeader() {
  const t = await getTranslations('Marketplace.nav');

  // In production this becomes: `const me = await getCurrentUser();`
  // For the pilot (no auth yet) we render the unauthenticated subset only.
  const currentUser: { displayName: string; role: 'learner' | 'teacher' } | null =
    null as { displayName: string; role: 'learner' | 'teacher' } | null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-surface/95 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 lg:px-8">
        {/* Brand wordmark + school-verified pill (pill only when authed) */}
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/"
            aria-label="SkillSwap"
            className="flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-campus-emerald/40"
          >
            <SchoolIcon className="text-ink" />
            <span className="text-xl font-bold tracking-tight text-ink">
              SkillSwap
            </span>
          </Link>
          {currentUser && (
            <span className="inline-flex items-center gap-1 rounded-full border border-success-tint bg-success-tint px-2 py-1 text-xs font-semibold text-success-ink">
              <CheckIcon className="h-3.5 w-3.5" />
              <span>{currentUser.displayName}</span>
            </span>
          )}
        </div>

        {/* Primary nav (xl+) — only Explore is real; others are placeholders */}
        <nav
          aria-label="Marketplace"
          className="hidden items-center gap-1 xl:flex"
        >
          <Link
            href="/classes"
            className="rounded-lg bg-mist px-3 py-2 text-sm font-semibold text-ink"
          >
            {t('explore')}
          </Link>
          <a
            href="#"
            aria-disabled="true"
            tabIndex={-1}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-mist hover:text-ink"
          >
            {t('booked')}
          </a>
          <a
            href="#"
            aria-disabled="true"
            tabIndex={-1}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-mist hover:text-ink"
          >
            {t('teaching')}
          </a>
          <a
            href="#"
            aria-disabled="true"
            tabIndex={-1}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-mist hover:text-ink"
          >
            {t('wallet')}
          </a>
        </nav>

        {/* Right side: balance, notification bell, role toggle, avatar
            — all hidden until auth is wired in a later increment. */}
        <div className="flex shrink-0 items-center gap-2">
          {currentUser ? (
            <>
              <BalancePill />
              <NotificationButton />
              <RoleToggle />
              <AvatarPlaceholder name={currentUser.displayName} />
            </>
          ) : (
            <span
              aria-disabled="true"
              className="rounded-md px-3 py-2 text-sm font-semibold text-ink-soft"
            >
              Sign in
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

/* --- Internal helpers (kept local; not exported) --- */

function BalancePill() {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-mist px-3 py-1.5">
      <WalletIcon className="h-5 w-5 text-campus-emerald" />
      <div className="flex flex-col text-right">
        <span className="text-xs font-bold text-ink">— Cr</span>
        <span className="text-[10px] text-ink-soft">Sign in to see balance</span>
      </div>
    </div>
  );
}

function NotificationButton() {
  return (
    <button
      type="button"
      aria-label="Notifications"
      className="relative flex h-10 w-10 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-mist hover:text-ink"
    >
      <BellIcon className="h-5 w-5" />
    </button>
  );
}

function RoleToggle() {
  return (
    <div className="hidden items-center rounded-lg border border-border bg-mist p-0.5 md:flex">
      <button
        type="button"
        className="rounded bg-surface px-3 py-1 text-xs font-semibold text-ink shadow-sm"
      >
        Learner
      </button>
      <button
        type="button"
        className="rounded px-3 py-1 text-xs font-semibold text-ink-soft transition-colors hover:text-ink"
      >
        Teacher
      </button>
    </div>
  );
}

function AvatarPlaceholder({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || 'U';
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-semibold text-surface">
      {initial}
    </div>
  );
}

/* --- Inline SVG glyphs (DESIGN.md §6 don't: no icon CDN) --- */

function SchoolIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 9l9-5 9 5-9 5-9-5z" />
      <path d="M7 11v5c2 1.5 4 1.5 5 1.5s3 0 5-1.5v-5" />
    </svg>
  );
}

function WalletIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function BellIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}