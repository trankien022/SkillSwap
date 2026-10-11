import { getTranslations } from 'next-intl/server';

/**
 * Top scrim banner (server component) shown above the
 * 'Publish a class' workspace. The two halves mirror the
 * template: a left block carrying the verification copy
 * (icon + headline + body) and a right block carrying the
 * immutable-schedule rule (icon + headline + body).
 */
export async function VerificationBanner() {
  const t = await getTranslations('Teacher.publish.verificationBanner');
  return (
    <section
      className="relative overflow-hidden rounded-xl border border-border bg-mist p-6 shadow-sm"
      aria-label={t('title')}
    >
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-success-ink/10 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success-ink text-surface shadow-sm">
            <VerifiedUserIcon className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-bold text-ink">{t('title')}</h2>
            <p className="text-sm text-ink-soft">{t('body')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border-l-4 border-ink bg-surface px-4 py-2.5 shadow-sm">
          <LockClockIcon className="h-5 w-5 text-ink" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-ink">{t('ruleTitle')}</span>
            <span className="text-[11px] text-ink-soft">{t('ruleBody')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --- Inline SVG glyphs --- */

function VerifiedUserIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function LockClockIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <circle cx="12" cy="16" r="2" />
    </svg>
  );
}